import { PoolClient } from 'pg';
import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import {
  ClassificationAbsence,
  CreationDemandeAbsence,
  DemandeAbsence,
  DemandeAbsenceAvecEmploye,
  SoldePermissionExceptionnelle,
} from './absences.types';

// Barème des permissions exceptionnelles — Note de service N°RH 013/DAF/2026 du 03/08/2026.
// Port fidèle : ne pas modifier sans nouvelle note de service.
export const BAREME_PERMISSIONS_EXCEPTIONNELLES: { cle: string; libelle: string; jours: number }[] = [
  { cle: 'mariage_travailleur', libelle: 'Mariage du travailleur', jours: 2 },
  { cle: 'deces_conjoint_descendant', libelle: 'Décès conjoint ou descendant en ligne directe', jours: 2 },
  { cle: 'mariage_enfant_frere_soeur', libelle: "Mariage d'un enfant, frère ou sœur", jours: 2 },
  { cle: 'deces_ascendant_frere_soeur', libelle: 'Décès ascendant en ligne directe, frère ou sœur', jours: 2 },
  { cle: 'deces_beau_parent', libelle: 'Décès beau-père ou belle-mère', jours: 2 },
  { cle: "naissance_enfant", libelle: "Naissance d'un enfant", jours: 3 },
];

// Ancienneté minimale requise pour être éligible à une permission exceptionnelle (note de service).
const ANCIENNETE_MINIMALE_MOIS = 6;

function mapDemande(l: Record<string, unknown>): DemandeAbsence {
  return {
    id: l.id as string,
    employeId: l.employe_id as string,
    type: l.type as DemandeAbsence['type'],
    motifBareme: l.motif_bareme as string | null,
    motif: l.motif as string,
    dateDebut: l.date_debut as string,
    dateFin: l.date_fin as string,
    nbJours: Number(l.nb_jours),
    nbJoursBareme: Number(l.nb_jours_bareme),
    nbJoursHorsBareme: Number(l.nb_jours_hors_bareme),
    justificatifFourni: l.justificatif_fourni as boolean,
    statut: l.statut as DemandeAbsence['statut'],
    avisHierarchique: l.avis_hierarchique as DemandeAbsence['avisHierarchique'],
    commentaireHierarchique: l.commentaire_hierarchique as string | null,
    decisionRh: l.decision_rh as DemandeAbsence['decisionRh'],
    commentaireRh: l.commentaire_rh as string | null,
    classification: l.classification as ClassificationAbsence | null,
  };
}

function mapSoldePermission(l: Record<string, unknown>): SoldePermissionExceptionnelle {
  return {
    employeId: l.employe_id as string,
    annee: l.annee as number,
    quota: Number(l.quota),
    joursConsommes: Number(l.jours_consommes),
    soldeDisponible: Number(l.solde_disponible),
  };
}

// Jours calendaires inclusifs — le barème (2-3 j liés à un événement court) ne fait pas
// référence aux jours ouvrés dans la note de service, à la différence du congé administratif.
function calculerNbJoursCalendaires(dateDebut: string, dateFin: string): number {
  const debut = new Date(dateDebut);
  const fin = new Date(dateFin);
  return Math.round((fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

async function obtenirOuCreerSoldePermission(
  client: PoolClient,
  employeId: string,
  annee: number
): Promise<SoldePermissionExceptionnelle> {
  const { rows } = await client.query(
    'SELECT * FROM soldes_permissions_exceptionnelles WHERE employe_id = $1 AND annee = $2',
    [employeId, annee]
  );

  if (rows[0]) return mapSoldePermission(rows[0]);

  const { rows: creees } = await client.query(
    `INSERT INTO soldes_permissions_exceptionnelles (employe_id, annee) VALUES ($1, $2) RETURNING *`,
    [employeId, annee]
  );

  return mapSoldePermission(creees[0]);
}

export async function obtenirSoldePermission(employeId: string, annee: number): Promise<SoldePermissionExceptionnelle> {
  const client = await pool.connect();
  try {
    return await obtenirOuCreerSoldePermission(client, employeId, annee);
  } finally {
    client.release();
  }
}

export async function obtenirDemandePourAcces(id: string): Promise<{ employeId: string; filialeId: string } | null> {
  const { rows } = await pool.query(
    `SELECT d.employe_id, e.filiale_id FROM demandes_absences d JOIN employes e ON e.id = d.employe_id WHERE d.id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  return { employeId: rows[0].employe_id as string, filialeId: rows[0].filiale_id as string };
}

export async function listerDemandesEmploye(employeId: string): Promise<DemandeAbsence[]> {
  const { rows } = await pool.query(
    'SELECT * FROM demandes_absences WHERE employe_id = $1 ORDER BY date_debut DESC',
    [employeId]
  );
  return rows.map(mapDemande);
}

export async function listerToutesDemandes(
  filialesAutorisees: string[] | null,
  statut?: string
): Promise<DemandeAbsenceAvecEmploye[]> {
  const conditions: string[] = [];
  const valeurs: unknown[] = [];

  if (filialesAutorisees !== null) {
    valeurs.push(filialesAutorisees);
    conditions.push(`e.filiale_id = ANY($${valeurs.length})`);
  }

  if (statut) {
    valeurs.push(statut);
    conditions.push(`d.statut = $${valeurs.length}`);
  }

  const clauseWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT d.*, e.nom AS employe_nom, e.prenoms AS employe_prenoms, e.matricule AS employe_matricule, e.filiale_id
     FROM demandes_absences d
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

export async function creerDemande(donnees: CreationDemandeAbsence): Promise<DemandeAbsence> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const nbJours = calculerNbJoursCalendaires(donnees.dateDebut, donnees.dateFin);
    const annee = new Date(donnees.dateDebut).getFullYear();

    let nbJoursBareme = 0;
    let nbJoursHorsBareme = nbJours;
    let motifBareme: string | null = null;

    if (donnees.type === 'permission_exceptionnelle') {
      const evenement = BAREME_PERMISSIONS_EXCEPTIONNELLES.find((e) => e.cle === donnees.motifBareme);
      if (!evenement) {
        throw new ErreurApplicative(400, "motifBareme invalide pour une permission exceptionnelle");
      }
      motifBareme = evenement.cle;

      const { rows: employeRows } = await client.query('SELECT date_embauche FROM employes WHERE id = $1', [
        donnees.employeId,
      ]);
      if (!employeRows[0]) {
        throw new ErreurApplicative(404, 'Employé introuvable');
      }

      const dateEmbauche = new Date(employeRows[0].date_embauche as Date);
      const dateMinimale = new Date(dateEmbauche);
      dateMinimale.setMonth(dateMinimale.getMonth() + ANCIENNETE_MINIMALE_MOIS);
      if (new Date(donnees.dateDebut) < dateMinimale) {
        throw new ErreurApplicative(
          400,
          `Ancienneté insuffisante : ${ANCIENNETE_MINIMALE_MOIS} mois minimum requis pour une permission exceptionnelle`
        );
      }

      nbJoursBareme = Math.min(nbJours, evenement.jours);
      nbJoursHorsBareme = Math.max(0, nbJours - evenement.jours);

      const solde = await obtenirOuCreerSoldePermission(client, donnees.employeId, annee);
      if (nbJoursBareme > solde.soldeDisponible) {
        throw new ErreurApplicative(
          400,
          `Solde de permissions exceptionnelles insuffisant : ${nbJoursBareme} jours demandés pour ${solde.soldeDisponible} jours disponibles cette année`
        );
      }
    }

    // Snapshot des noms département/service/fonction au moment du dépôt (même principe que
    // bulletins_paie.fonction_intitule) — la fiche PDF affichait ces noms en direct, donc un
    // renommage ultérieur changeait rétroactivement une fiche déjà déposée.
    const { rows: contexteRows } = await client.query(
      `SELECT dep.nom AS departement_nom, s.nom AS service_nom, fo.intitule AS fonction_intitule
       FROM employes e
       LEFT JOIN departements dep ON dep.id = e.departement_id
       LEFT JOIN services s ON s.id = e.service_id
       LEFT JOIN fonctions fo ON fo.id = e.fonction_id
       WHERE e.id = $1`,
      [donnees.employeId]
    );
    const contexte = contexteRows[0] ?? { departement_nom: null, service_nom: null, fonction_intitule: null };

    const { rows } = await client.query(
      `INSERT INTO demandes_absences
        (employe_id, type, motif_bareme, motif, date_debut, date_fin, nb_jours, nb_jours_bareme, nb_jours_hors_bareme,
         justificatif_fourni, statut, departement_nom, service_nom, fonction_intitule)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'soumise', $11, $12, $13)
       RETURNING *`,
      [
        donnees.employeId,
        donnees.type,
        motifBareme,
        donnees.motif,
        donnees.dateDebut,
        donnees.dateFin,
        nbJours,
        nbJoursBareme,
        nbJoursHorsBareme,
        donnees.justificatifFourni ?? false,
        contexte.departement_nom,
        contexte.service_nom,
        contexte.fonction_intitule,
      ]
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
): Promise<DemandeAbsence> {
  const { rows } = await pool.query(
    `UPDATE demandes_absences
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
  classification: ClassificationAbsence | undefined,
  commentaire?: string
): Promise<DemandeAbsence> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: demandeRows } = await client.query('SELECT * FROM demandes_absences WHERE id = $1 FOR UPDATE', [
      id,
    ]);
    const demande = demandeRows[0] ? mapDemande(demandeRows[0]) : null;

    if (!demande || !['avis_favorable', 'avis_defavorable'].includes(demande.statut)) {
      throw new ErreurApplicative(409, "Demande introuvable ou pas encore soumise à l'avis hiérarchique");
    }

    let classificationRetenue: ClassificationAbsence | null = null;

    if (decision === 'validee') {
      if (demande.nbJoursHorsBareme === 0) {
        // Entièrement couvert par le barème : non déductible et sans retenue, par construction.
        classificationRetenue = 'non_deductible';
      } else {
        if (!classification || classification === 'non_deductible') {
          throw new ErreurApplicative(
            400,
            'Une classification (déductible des congés ou sans solde) est requise pour la portion hors barème'
          );
        }
        classificationRetenue = classification;
      }
    }

    const { rows } = await client.query(
      `UPDATE demandes_absences
       SET statut = $2, decision_rh = $3, commentaire_rh = $4, classification = $5, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, decision === 'validee' ? 'validee_rh' : 'rejetee_rh', decision, commentaire ?? null, classificationRetenue]
    );

    if (decision === 'validee') {
      const annee = new Date(demande.dateDebut).getFullYear();

      if (demande.type === 'permission_exceptionnelle' && demande.nbJoursBareme > 0) {
        await obtenirOuCreerSoldePermission(client, demande.employeId, annee);
        await client.query(
          'UPDATE soldes_permissions_exceptionnelles SET jours_consommes = jours_consommes + $3 WHERE employe_id = $1 AND annee = $2',
          [demande.employeId, annee, demande.nbJoursBareme]
        );
      }

      if (demande.nbJoursHorsBareme > 0 && classificationRetenue === 'deductible_conge') {
        const { rows: soldeCongeRows } = await client.query(
          'SELECT * FROM soldes_conges WHERE employe_id = $1 AND annee = $2',
          [demande.employeId, annee]
        );
        if (!soldeCongeRows[0]) {
          await client.query(
            `INSERT INTO soldes_conges (employe_id, annee, jours_acquis) VALUES ($1, $2, 30)`,
            [demande.employeId, annee]
          );
        }
        await client.query(
          'UPDATE soldes_conges SET jours_deduits = jours_deduits + $3 WHERE employe_id = $1 AND annee = $2',
          [demande.employeId, annee, demande.nbJoursHorsBareme]
        );
      }
      // classificationRetenue === 'sans_solde' : impact sur le salaire du mois non calculé ici,
      // cf. formule absence injustifiée du module Paie — intégration Absences → Paie hors périmètre actuel.
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
