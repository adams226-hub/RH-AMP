import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import {
  CreationDemandeCongeSpecial,
  DecisionCongeSpecial,
  DemandeCongeSpecial,
  DemandeCongeSpecialAvecEmploye,
  TypeCongeSpecial,
} from './congesSpeciaux.types';

// Durées par défaut (jours calendaires, date de fin incluse) — ajustables par la RH à la
// validation, jamais figées après coup une fois la demande créée.
const DUREE_JOURS_PAR_DEFAUT: Record<TypeCongeSpecial, number> = {
  maternite: 105, // ≈ 3 mois 3 semaines
  paternite: 3,
};

function calculerDateFinParDefaut(dateDebut: string, type: TypeCongeSpecial): string {
  const date = new Date(dateDebut);
  date.setDate(date.getDate() + DUREE_JOURS_PAR_DEFAUT[type] - 1);
  return date.toISOString().slice(0, 10);
}

function mapDemande(l: Record<string, unknown>): DemandeCongeSpecial {
  return {
    id: l.id as string,
    employeId: l.employe_id as string,
    type: l.type as TypeCongeSpecial,
    dateDebut: l.date_debut as string,
    dateFin: l.date_fin as string,
    justificatifFourni: l.justificatif_fourni as boolean,
    motif: l.motif as string | null,
    statut: l.statut as DemandeCongeSpecial['statut'],
    commentaireRh: l.commentaire_rh as string | null,
    validePar: l.valide_par as string | null,
    valideLe: l.valide_le as string | null,
  };
}

// filialesAutorisees = null signifie aucune restriction (super_admin, drh_holding) — même
// convention que les autres modules (cf. conges.service.ts).
export async function listerToutesDemandes(
  filialesAutorisees: string[] | null,
  chantiersAutorisees: string[] | null = null
): Promise<DemandeCongeSpecialAvecEmploye[]> {
  const conditions: string[] = [];
  const valeurs: unknown[] = [];

  if (filialesAutorisees !== null) {
    valeurs.push(filialesAutorisees);
    const iFiliales = valeurs.length;
    valeurs.push(chantiersAutorisees ?? []);
    const iChantiers = valeurs.length;
    conditions.push(`(e.filiale_id = ANY($${iFiliales}) OR e.chantier_id = ANY($${iChantiers}))`);
  }

  const clauseWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT d.*, e.nom AS employe_nom, e.prenoms AS employe_prenoms, e.matricule AS employe_matricule, e.filiale_id
     FROM demandes_conges_speciaux d
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

export async function listerDemandesEmploye(employeId: string): Promise<DemandeCongeSpecial[]> {
  const { rows } = await pool.query(
    'SELECT * FROM demandes_conges_speciaux WHERE employe_id = $1 ORDER BY date_debut DESC',
    [employeId]
  );
  return rows.map(mapDemande);
}

export async function creerDemande(donnees: CreationDemandeCongeSpecial): Promise<DemandeCongeSpecial> {
  const dateFin = donnees.dateFin ?? calculerDateFinParDefaut(donnees.dateDebut, donnees.type);

  const { rows } = await pool.query(
    `INSERT INTO demandes_conges_speciaux (employe_id, type, date_debut, date_fin, justificatif_fourni, motif)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [donnees.employeId, donnees.type, donnees.dateDebut, dateFin, donnees.justificatifFourni ?? false, donnees.motif ?? null]
  );

  return mapDemande(rows[0]);
}

// Décision RH directe (pas d'étape d'avis hiérarchique, contrairement au congé administratif) —
// ne touche jamais soldes_conges : le congé maternité/paternité est un droit légal distinct.
export async function traiterDecision(
  id: string,
  utilisateurId: string,
  donnees: DecisionCongeSpecial
): Promise<DemandeCongeSpecial> {
  const { rows: demandeRows } = await pool.query('SELECT * FROM demandes_conges_speciaux WHERE id = $1', [id]);
  const demande = demandeRows[0] ? mapDemande(demandeRows[0]) : null;

  if (!demande || demande.statut !== 'soumise') {
    throw new ErreurApplicative(409, 'Demande introuvable ou déjà traitée');
  }

  const dateFin = donnees.dateFin ?? demande.dateFin;
  if (dateFin < demande.dateDebut) {
    throw new ErreurApplicative(400, 'La date de fin ne peut pas être antérieure à la date de début');
  }

  const { rows } = await pool.query(
    `UPDATE demandes_conges_speciaux
     SET statut = $2, date_fin = $3, commentaire_rh = $4, valide_par = $5, valide_le = now(), updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, donnees.decision, dateFin, donnees.commentaire ?? null, utilisateurId]
  );

  return mapDemande(rows[0]);
}
