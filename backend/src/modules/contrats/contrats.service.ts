import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { Contrat, ContratAvecEmploye, CreationContrat, RenouvellementContrat, RuptureContrat } from './contrats.types';

function mapLigne(l: Record<string, unknown>): Contrat {
  return {
    id: l.id as string,
    employeId: l.employe_id as string,
    type: l.type as Contrat['type'],
    dateDebut: l.date_debut as string,
    dateFin: l.date_fin as string | null,
    dureeEssaiJours: l.duree_essai_jours as number | null,
    finPeriodeEssai: l.fin_periode_essai as string | null,
    fonctionId: l.fonction_id as string | null,
    salaireBase: Number(l.salaire_base),
    sursalaire: Number(l.sursalaire),
    indemniteLogement: Number(l.indemnite_logement),
    indemniteTransport: Number(l.indemnite_transport),
    indemniteFonction: Number(l.indemnite_fonction),
    indemniteSujetion: Number(l.indemnite_sujetion),
    indemniteAstreinte: Number(l.indemnite_astreinte),
    statut: l.statut as Contrat['statut'],
    contratPrecedentId: l.contrat_precedent_id as string | null,
    nbRenouvellements: l.nb_renouvellements as number,
    motifRupture: l.motif_rupture as string | null,
    dateRupture: l.date_rupture as string | null,
    pdfUrl: l.pdf_url as string | null,
  };
}

export async function listerContratsEmploye(employeId: string): Promise<Contrat[]> {
  const { rows } = await pool.query(
    'SELECT * FROM contrats WHERE employe_id = $1 ORDER BY date_debut DESC',
    [employeId]
  );
  return rows.map(mapLigne);
}

// Vue globale (tous employés du périmètre), pour l'écran Contrats — filialesAutorisees = null
// signifie aucune restriction (super_admin, drh_holding).
export async function listerTousContrats(filialesAutorisees: string[] | null): Promise<ContratAvecEmploye[]> {
  const requeteBase = `
    SELECT c.*, e.nom AS employe_nom, e.prenoms AS employe_prenoms, e.matricule AS employe_matricule, e.filiale_id
    FROM contrats c
    JOIN employes e ON e.id = c.employe_id
  `;

  const { rows } =
    filialesAutorisees === null
      ? await pool.query(`${requeteBase} ORDER BY c.date_debut DESC`)
      : await pool.query(`${requeteBase} WHERE e.filiale_id = ANY($1) ORDER BY c.date_debut DESC`, [
          filialesAutorisees,
        ]);

  return rows.map((l) => ({
    ...mapLigne(l),
    employeNom: l.employe_nom as string,
    employePrenoms: l.employe_prenoms as string,
    employeMatricule: l.employe_matricule as string,
    filialeId: l.filiale_id as string,
  }));
}

export async function listerContratsExpirantBientot(joursSeuil: number): Promise<Contrat[]> {
  const { rows } = await pool.query(
    `SELECT * FROM contrats
     WHERE statut = 'actif' AND date_fin IS NOT NULL
       AND date_fin BETWEEN CURRENT_DATE AND CURRENT_DATE + $1::int
     ORDER BY date_fin`,
    [joursSeuil]
  );
  return rows.map(mapLigne);
}

export async function obtenirContrat(id: string): Promise<Contrat | null> {
  const { rows } = await pool.query('SELECT * FROM contrats WHERE id = $1', [id]);
  return rows[0] ? mapLigne(rows[0]) : null;
}

export async function creerContrat(donnees: CreationContrat): Promise<Contrat> {
  if (donnees.type !== 'cdi' && !donnees.dateFin) {
    throw new ErreurApplicative(400, 'date_fin est obligatoire pour un CDD ou un Stage');
  }

  const { rows } = await pool.query(
    `INSERT INTO contrats (
       employe_id, type, date_debut, date_fin, duree_essai_jours, fonction_id, salaire_base,
       sursalaire, indemnite_logement, indemnite_transport, indemnite_fonction, indemnite_sujetion, indemnite_astreinte,
       statut
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'brouillon')
     RETURNING *`,
    [
      donnees.employeId,
      donnees.type,
      donnees.dateDebut,
      donnees.dateFin ?? null,
      donnees.dureeEssaiJours ?? null,
      donnees.fonctionId ?? null,
      donnees.salaireBase,
      donnees.sursalaire ?? 0,
      donnees.indemniteLogement ?? 0,
      donnees.indemniteTransport ?? 0,
      donnees.indemniteFonction ?? 0,
      donnees.indemniteSujetion ?? 0,
      donnees.indemniteAstreinte ?? 0,
    ]
  );

  return mapLigne(rows[0]);
}

// Aucune UI ne permettait jusqu'ici de faire passer un contrat de "brouillon" à "actif" —
// seuls Renouveler/Rompre existaient, et ils ne s'affichent que sur un contrat déjà actif.
// Un contrat fraîchement créé restait donc bloqué en brouillon indéfiniment.
export async function activerContrat(id: string): Promise<Contrat> {
  const contrat = await obtenirContrat(id);

  if (!contrat) {
    throw new ErreurApplicative(404, 'Contrat introuvable');
  }

  if (contrat.statut !== 'brouillon' && contrat.statut !== 'signe') {
    throw new ErreurApplicative(409, `Impossible d'activer un contrat au statut « ${contrat.statut} »`);
  }

  const { rows: autreActif } = await pool.query(
    "SELECT id FROM contrats WHERE employe_id = $1 AND statut = 'actif' AND id != $2",
    [contrat.employeId, id]
  );
  if (autreActif[0]) {
    throw new ErreurApplicative(409, 'Cet employé a déjà un contrat actif — rompez-le ou renouvelez-le avant');
  }

  const { rows } = await pool.query(
    "UPDATE contrats SET statut = 'actif', updated_at = now() WHERE id = $1 RETURNING *",
    [id]
  );

  return mapLigne(rows[0]);
}

export async function renouvelerContrat(id: string, donnees: RenouvellementContrat): Promise<Contrat> {
  const contratActuel = await obtenirContrat(id);

  if (!contratActuel) {
    throw new ErreurApplicative(404, 'Contrat introuvable');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query("UPDATE contrats SET statut = 'renouvele', updated_at = now() WHERE id = $1", [id]);

    const { rows } = await client.query(
      `INSERT INTO contrats (
         employe_id, type, date_debut, date_fin, fonction_id, salaire_base,
         sursalaire, indemnite_logement, indemnite_transport, indemnite_fonction, indemnite_sujetion, indemnite_astreinte,
         statut, contrat_precedent_id, nb_renouvellements
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'brouillon', $13, $14)
       RETURNING *`,
      [
        contratActuel.employeId,
        contratActuel.type,
        donnees.dateDebut,
        donnees.dateFin ?? null,
        contratActuel.fonctionId,
        donnees.salaireBase,
        // Hérite du contrat précédent si non précisé — évite une remise à zéro silencieuse
        // des indemnités à chaque renouvellement.
        donnees.sursalaire ?? contratActuel.sursalaire,
        donnees.indemniteLogement ?? contratActuel.indemniteLogement,
        donnees.indemniteTransport ?? contratActuel.indemniteTransport,
        donnees.indemniteFonction ?? contratActuel.indemniteFonction,
        donnees.indemniteSujetion ?? contratActuel.indemniteSujetion,
        donnees.indemniteAstreinte ?? contratActuel.indemniteAstreinte,
        contratActuel.id,
        contratActuel.nbRenouvellements + 1,
      ]
    );

    await client.query('COMMIT');
    return mapLigne(rows[0]);
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
}

export async function romprecontrat(id: string, donnees: RuptureContrat): Promise<Contrat> {
  const { rows } = await pool.query(
    `UPDATE contrats SET statut = 'rompu', date_rupture = $2, motif_rupture = $3, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, donnees.dateRupture, donnees.motifRupture]
  );

  if (!rows[0]) {
    throw new ErreurApplicative(404, 'Contrat introuvable');
  }

  return mapLigne(rows[0]);
}
