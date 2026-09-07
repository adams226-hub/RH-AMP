import { PoolClient } from 'pg';
import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { CreationDemandeConge, DemandeConge, DemandeCongeAvecEmploye, SoldeConge } from './conges.types';

function mapDemande(l: Record<string, unknown>): DemandeConge {
  return {
    id: l.id as string,
    employeId: l.employe_id as string,
    dateDebut: l.date_debut as string,
    dateFin: l.date_fin as string,
    nbJours: Number(l.nb_jours),
    motif: l.motif as string | null,
    statut: l.statut as DemandeConge['statut'],
    avisHierarchique: l.avis_hierarchique as DemandeConge['avisHierarchique'],
    commentaireHierarchique: l.commentaire_hierarchique as string | null,
    decisionRh: l.decision_rh as DemandeConge['decisionRh'],
    commentaireRh: l.commentaire_rh as string | null,
  };
}

function mapSolde(l: Record<string, unknown>): SoldeConge {
  return {
    employeId: l.employe_id as string,
    annee: l.annee as number,
    soldeInitial: Number(l.solde_initial),
    joursAcquis: Number(l.jours_acquis),
    joursConsommes: Number(l.jours_consommes),
    joursDeduits: Number(l.jours_deduits),
    soldeDisponible: Number(l.solde_disponible),
  };
}

// Jours ouvrés (hors week-ends et jours fériés) entre deux dates incluses.
async function calculerNbJoursOuvres(client: PoolClient, dateDebut: string, dateFin: string): Promise<number> {
  const { rows: feries } = await client.query('SELECT date FROM jours_feries WHERE date BETWEEN $1 AND $2', [
    dateDebut,
    dateFin,
  ]);
  const datesFeriees = new Set(feries.map((f) => (f.date as Date).toISOString().slice(0, 10)));

  let nbJours = 0;
  const curseur = new Date(dateDebut);
  const fin = new Date(dateFin);

  while (curseur <= fin) {
    const jourSemaine = curseur.getDay();
    const iso = curseur.toISOString().slice(0, 10);

    if (jourSemaine !== 0 && jourSemaine !== 6 && !datesFeriees.has(iso)) {
      nbJours += 1;
    }

    curseur.setDate(curseur.getDate() + 1);
  }

  return nbJours;
}

async function obtenirOuCreerSolde(client: PoolClient, employeId: string, annee: number): Promise<SoldeConge> {
  const { rows } = await client.query('SELECT * FROM soldes_conges WHERE employe_id = $1 AND annee = $2', [
    employeId,
    annee,
  ]);

  if (rows[0]) return mapSolde(rows[0]);

  // Montant d'acquisition annuelle fixé à 30 j — méthode de proratisation mensuelle non tranchée, cf. specs Congés §7.
  const { rows: creees } = await client.query(
    `INSERT INTO soldes_conges (employe_id, annee, jours_acquis) VALUES ($1, $2, 30) RETURNING *`,
    [employeId, annee]
  );

  return mapSolde(creees[0]);
}

export async function obtenirSolde(employeId: string, annee: number): Promise<SoldeConge> {
  const client = await pool.connect();
  try {
    return await obtenirOuCreerSolde(client, employeId, annee);
  } finally {
    client.release();
  }
}

export async function listerDemandesEmploye(employeId: string): Promise<DemandeConge[]> {
  const { rows } = await pool.query(
    'SELECT * FROM demandes_conges WHERE employe_id = $1 ORDER BY date_debut DESC',
    [employeId]
  );
  return rows.map(mapDemande);
}

// Vue globale (tous employés du périmètre) — alimente l'écran Congés et la file
// d'approbation (avis hiérarchique / décision RH). filialesAutorisees = null = aucune restriction.
// chantiersAutorisees couvre le Responsable RH Chantier, jamais rattaché à une filiale (cf.
// employes.service.ts / middleware/autorisation.ts pour le même raisonnement).
export async function listerToutesDemandes(
  filialesAutorisees: string[] | null,
  chantiersAutorisees: string[] | null = null,
  statut?: string
): Promise<DemandeCongeAvecEmploye[]> {
  const conditions: string[] = [];
  const valeurs: unknown[] = [];

  if (filialesAutorisees !== null) {
    valeurs.push(filialesAutorisees);
    const iFiliales = valeurs.length;
    valeurs.push(chantiersAutorisees ?? []);
    const iChantiers = valeurs.length;
    conditions.push(`(e.filiale_id = ANY($${iFiliales}) OR e.chantier_id = ANY($${iChantiers}))`);
  }

  if (statut) {
    valeurs.push(statut);
    conditions.push(`d.statut = $${valeurs.length}`);
  }

  const clauseWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT d.*, e.nom AS employe_nom, e.prenoms AS employe_prenoms, e.matricule AS employe_matricule, e.filiale_id
     FROM demandes_conges d
     JOIN employes e ON e.id = d.employe_id
     ${clauseWhere}
     ORDER BY d.date_debut DESC`,
    valeurs
  );

  return rows.map((l) => ({
    ...mapDemande(l),
    employeNom: l.employe_nom as string,
    employePrenoms: l.employe_prenoms as string,
    employeMatricule: l.employe_matricule as string,
    filialeId: l.filiale_id as string,
  }));
}

export async function creerDemande(donnees: CreationDemandeConge): Promise<DemandeConge> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const nbJours = await calculerNbJoursOuvres(client, donnees.dateDebut, donnees.dateFin);
    const annee = new Date(donnees.dateDebut).getFullYear();
    const solde = await obtenirOuCreerSolde(client, donnees.employeId, annee);

    if (nbJours > solde.soldeDisponible) {
      throw new ErreurApplicative(
        400,
        `Solde insuffisant : ${nbJours} jours demandés pour ${solde.soldeDisponible} jours disponibles`
      );
    }

    const { rows } = await client.query(
      `INSERT INTO demandes_conges (employe_id, date_debut, date_fin, nb_jours, motif, statut)
       VALUES ($1, $2, $3, $4, $5, 'soumise')
       RETURNING *`,
      [donnees.employeId, donnees.dateDebut, donnees.dateFin, nbJours, donnees.motif ?? null]
    );

    await client.query('COMMIT');
    return mapDemande(rows[0]);
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
}

export async function donnerAvisHierarchique(
  id: string,
  avis: 'favorable' | 'defavorable',
  commentaire?: string
): Promise<DemandeConge> {
  const { rows } = await pool.query(
    `UPDATE demandes_conges
     SET statut = $2, avis_hierarchique = $3, commentaire_hierarchique = $4, updated_at = now()
     WHERE id = $1 AND statut = 'soumise'
     RETURNING *`,
    [id, avis === 'favorable' ? 'avis_favorable' : 'avis_defavorable', avis, commentaire ?? null]
  );

  if (!rows[0]) {
    throw new ErreurApplicative(409, 'Demande introuvable ou déjà traitée par le supérieur hiérarchique');
  }

  return mapDemande(rows[0]);
}

export async function traiterDecisionRh(
  id: string,
  decision: 'validee' | 'rejetee',
  commentaire?: string
): Promise<DemandeConge> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: demandeRows } = await client.query('SELECT * FROM demandes_conges WHERE id = $1 FOR UPDATE', [id]);
    const demande = demandeRows[0] ? mapDemande(demandeRows[0]) : null;

    if (!demande || !['avis_favorable', 'avis_defavorable'].includes(demande.statut)) {
      throw new ErreurApplicative(409, "Demande introuvable ou pas encore soumise à l'avis hiérarchique");
    }

    const { rows } = await client.query(
      `UPDATE demandes_conges SET statut = $2, decision_rh = $3, commentaire_rh = $4, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, decision === 'validee' ? 'validee_rh' : 'rejetee_rh', decision, commentaire ?? null]
    );

    if (decision === 'validee') {
      const annee = new Date(demande.dateDebut).getFullYear();
      await obtenirOuCreerSolde(client, demande.employeId, annee);
      await client.query(
        'UPDATE soldes_conges SET jours_consommes = jours_consommes + $3 WHERE employe_id = $1 AND annee = $2',
        [demande.employeId, annee, demande.nbJours]
      );
    }

    await client.query('COMMIT');
    return mapDemande(rows[0]);
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
}
