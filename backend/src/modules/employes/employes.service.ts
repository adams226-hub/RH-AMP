import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { CreationEmploye, Employe, StatutEmploye } from './employes.types';

function mapLigne(ligne: Record<string, unknown>): Employe {
  return {
    id: ligne.id as string,
    matricule: ligne.matricule as string,
    nom: ligne.nom as string,
    prenoms: ligne.prenoms as string,
    dateNaissance: ligne.date_naissance as string,
    sexe: ligne.sexe as Employe['sexe'],
    nationalite: ligne.nationalite as string,
    telephone: ligne.telephone as string,
    numCnib: ligne.num_cnib as string,
    numCnss: ligne.num_cnss as string,
    rib: ligne.rib as string | null,
    banque: ligne.banque as string | null,
    modePaiement: ligne.mode_paiement as string | null,
    personnesACharge: Number(ligne.personnes_a_charge),
    filialeId: ligne.filiale_id as string,
    departementId: ligne.departement_id as string | null,
    serviceId: ligne.service_id as string | null,
    fonctionId: ligne.fonction_id as string | null,
    superieurId: ligne.superieur_id as string | null,
    chantierId: ligne.chantier_id as string | null,
    dateEmbauche: ligne.date_embauche as string,
    statut: ligne.statut as Employe['statut'],
    categorieProfessionnelle: ligne.categorie_professionnelle as Employe['categorieProfessionnelle'],
  };
}

// filialesAutorisees = null signifie aucune restriction (rôles super_admin, drh_holding).
// recherche/limite optionnels : absents pour l'écran Employés (liste complète, filtrage et
// pagination déjà côté client) ; utilisés par le sélecteur à saisie progressive (des milliers
// d'employés rendent une liste déroulante complète impraticable — cf. retour utilisateur) pour
// ne renvoyer qu'un lot de correspondances plutôt que tout charger.
export async function listerEmployes(
  filialesAutorisees: string[] | null,
  recherche?: string,
  limite?: number
): Promise<Employe[]> {
  const conditions: string[] = [];
  const valeurs: unknown[] = [];

  if (filialesAutorisees !== null) {
    valeurs.push(filialesAutorisees);
    conditions.push(`filiale_id = ANY($${valeurs.length})`);
  }

  if (recherche) {
    valeurs.push(`%${recherche}%`);
    conditions.push(`(nom ILIKE $${valeurs.length} OR prenoms ILIKE $${valeurs.length} OR matricule ILIKE $${valeurs.length})`);
  }

  const clauseWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  let clauseLimite = '';
  if (limite) {
    valeurs.push(Math.min(Math.trunc(limite), 100));
    clauseLimite = `LIMIT $${valeurs.length}`;
  }

  const { rows } = await pool.query(
    `SELECT * FROM employes ${clauseWhere} ORDER BY nom, prenoms ${clauseLimite}`,
    valeurs
  );

  return rows.map(mapLigne);
}

export async function obtenirEmploye(id: string): Promise<Employe | null> {
  const { rows } = await pool.query('SELECT * FROM employes WHERE id = $1', [id]);
  return rows[0] ? mapLigne(rows[0]) : null;
}

async function verifierCategorieProfessionnelle(code: string): Promise<void> {
  const { rows } = await pool.query('SELECT 1 FROM categories_professionnelles WHERE code = $1 AND actif', [code]);
  if (!rows[0]) {
    throw new ErreurApplicative(400, "Catégorie professionnelle inconnue ou archivée — voir Paramètres > Référentiels");
  }
}

export async function creerEmploye(donnees: CreationEmploye): Promise<Employe> {
  if (donnees.categorieProfessionnelle) {
    await verifierCategorieProfessionnelle(donnees.categorieProfessionnelle);
  }

  const { rows } = await pool.query(
    `INSERT INTO employes (
       matricule, nom, prenoms, date_naissance, sexe, nationalite, telephone, num_cnib, num_cnss,
       rib, banque, mode_paiement, personnes_a_charge,
       filiale_id, departement_id, service_id, fonction_id, chantier_id, date_embauche, categorie_professionnelle
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
     RETURNING *`,
    [
      donnees.matricule,
      donnees.nom,
      donnees.prenoms,
      donnees.dateNaissance,
      donnees.sexe,
      donnees.nationalite,
      donnees.telephone,
      donnees.numCnib,
      donnees.numCnss,
      donnees.rib ?? null,
      donnees.banque ?? null,
      donnees.modePaiement ?? null,
      donnees.personnesACharge ?? 0,
      donnees.filialeId,
      donnees.departementId ?? null,
      donnees.serviceId ?? null,
      donnees.fonctionId ?? null,
      donnees.chantierId ?? null,
      donnees.dateEmbauche,
      donnees.categorieProfessionnelle ?? null,
    ]
  );

  return mapLigne(rows[0]);
}

// Lieu d'affectation par défaut (Journal de Paie, ADDENDUM_JOURNAL_PAIE_AMP.md §3) — modifiable
// indépendamment du reste de la fiche, y compris pour les employés déjà créés avant l'ajout de ce champ.
export async function affecterChantierEmploye(id: string, chantierId: string | null): Promise<Employe> {
  const { rows } = await pool.query('UPDATE employes SET chantier_id = $2, updated_at = now() WHERE id = $1 RETURNING *', [
    id,
    chantierId,
  ]);

  if (!rows[0]) {
    throw new ErreurApplicative(404, 'Employé introuvable');
  }

  return mapLigne(rows[0]);
}

export async function changerStatutEmploye(id: string, statut: StatutEmploye): Promise<Employe> {
  const { rows } = await pool.query('UPDATE employes SET statut = $2, updated_at = now() WHERE id = $1 RETURNING *', [
    id,
    statut,
  ]);

  if (!rows[0]) {
    throw new ErreurApplicative(404, 'Employé introuvable');
  }

  return mapLigne(rows[0]);
}
