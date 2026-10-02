import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import {
  CreationEmploye,
  Employe,
  ModificationEmploye,
  ResumeRhEmploye,
  SaisieTauxJournalier,
  StatutEmploye,
  TauxJournalier,
} from './employes.types';

// Correspondance champ (camelCase, API) -> colonne (snake_case, base) pour la mise à jour
// partielle de modifierEmploye — seuls les champs présents dans le corps de la requête sont
// écrits, les autres restent inchangés (contrairement à creerEmploye qui écrit une ligne complète).
const COLONNES_MODIFIABLES: Record<keyof ModificationEmploye, string> = {
  matricule: 'matricule',
  nom: 'nom',
  prenoms: 'prenoms',
  dateNaissance: 'date_naissance',
  sexe: 'sexe',
  nationalite: 'nationalite',
  telephone: 'telephone',
  numCnib: 'num_cnib',
  numCnss: 'num_cnss',
  rib: 'rib',
  banque: 'banque',
  modePaiement: 'mode_paiement',
  personnesACharge: 'personnes_a_charge',
  filialeId: 'filiale_id',
  departementId: 'departement_id',
  serviceId: 'service_id',
  fonctionId: 'fonction_id',
  chantierId: 'chantier_id',
  dateEmbauche: 'date_embauche',
  categorieProfessionnelle: 'categorie_professionnelle',
  soumisPointage: 'soumis_pointage',
  remunereAuJour: 'remunere_au_jour',
  situationMatrimoniale: 'situation_matrimoniale',
  groupeSanguin: 'groupe_sanguin',
  contactUrgenceNom: 'contact_urgence_nom',
  contactUrgenceLien: 'contact_urgence_lien',
  contactUrgenceTel: 'contact_urgence_tel',
  contactUrgenceTel2: 'contact_urgence_tel2',
  maladieParticuliere: 'maladie_particuliere',
};

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
    dateSortie: ligne.date_sortie as string | null,
    motifSortie: ligne.motif_sortie as string | null,
    categorieProfessionnelle: ligne.categorie_professionnelle as Employe['categorieProfessionnelle'],
    soumisPointage: ligne.soumis_pointage as boolean,
    remunereAuJour: ligne.remunere_au_jour as boolean,
    situationMatrimoniale: ligne.situation_matrimoniale as string | null,
    groupeSanguin: ligne.groupe_sanguin as string | null,
    contactUrgenceNom: ligne.contact_urgence_nom as string | null,
    contactUrgenceLien: ligne.contact_urgence_lien as string | null,
    contactUrgenceTel: ligne.contact_urgence_tel as string | null,
    contactUrgenceTel2: ligne.contact_urgence_tel2 as string | null,
    maladieParticuliere: ligne.maladie_particuliere as string | null,
  };
}

// filialesAutorisees = null signifie aucune restriction (rôles super_admin, drh_holding).
// chantiersAutorisees couvre le Responsable RH Chantier, jamais rattaché à une filiale (toujours
// [] côté filialesAutoriseesPour) — sans ce second filtre en OR, ce rôle ne voit jamais aucun
// employé alors qu'il devrait voir ceux de son/ses chantier(s), cf. middleware/autorisation.ts.
// recherche/limite optionnels : absents pour l'écran Employés (liste complète, filtrage et
// pagination déjà côté client) ; utilisés par le sélecteur à saisie progressive (des milliers
// d'employés rendent une liste déroulante complète impraticable — cf. retour utilisateur) pour
// ne renvoyer qu'un lot de correspondances plutôt que tout charger.
export async function listerEmployes(
  filialesAutorisees: string[] | null,
  chantiersAutorisees: string[] | null = null,
  recherche?: string,
  limite?: number
): Promise<Employe[]> {
  const conditions: string[] = [];
  const valeurs: unknown[] = [];

  if (filialesAutorisees !== null) {
    valeurs.push(filialesAutorisees);
    const iFiliales = valeurs.length;
    valeurs.push(chantiersAutorisees ?? []);
    const iChantiers = valeurs.length;
    conditions.push(`(filiale_id = ANY($${iFiliales}) OR chantier_id = ANY($${iChantiers}))`);
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

// Résumé RH affiché sur la fiche employé — année en cours uniquement, absences validées par la
// RH seulement (cf. commentaire sur ResumeRhEmploye). « En mission » = une mission dont la date
// de retour réelle n'est pas encore renseignée et dont le départ est déjà passé (même logique
// que missions.service.ts, qui ne stocke jamais de statut et le déduit toujours des 3 dates).
export async function obtenirResumeRhEmploye(id: string): Promise<ResumeRhEmploye> {
  const annee = new Date().getFullYear();

  const { rows: soldeRows } = await pool.query(
    'SELECT jours_consommes, solde_disponible FROM soldes_conges WHERE employe_id = $1 AND annee = $2',
    [id, annee]
  );

  const { rows: absenceRows } = await pool.query(
    `SELECT COALESCE(SUM(nb_jours), 0) AS total FROM demandes_absences
     WHERE employe_id = $1 AND decision_rh = 'validee' AND EXTRACT(YEAR FROM date_debut) = $2`,
    [id, annee]
  );

  const { rows: missionRows } = await pool.query(
    `SELECT destination, date_retour_prevue FROM missions
     WHERE employe_id = $1 AND date_retour_reelle IS NULL AND date_depart <= CURRENT_DATE
     ORDER BY date_depart DESC LIMIT 1`,
    [id]
  );

  return {
    annee,
    joursAbsenceValides: Number(absenceRows[0]?.total ?? 0),
    congesPris: Number(soldeRows[0]?.jours_consommes ?? 0),
    soldeConges: Number(soldeRows[0]?.solde_disponible ?? 0),
    enMission: missionRows.length > 0,
    missionDestination: (missionRows[0]?.destination as string | undefined) ?? null,
    missionDateRetourPrevue: (missionRows[0]?.date_retour_prevue as string | undefined) ?? null,
  };
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
       filiale_id, departement_id, service_id, fonction_id, chantier_id, date_embauche, categorie_professionnelle,
       soumis_pointage, remunere_au_jour, situation_matrimoniale, groupe_sanguin,
       contact_urgence_nom, contact_urgence_lien, contact_urgence_tel, contact_urgence_tel2, maladie_particuliere
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
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
      donnees.soumisPointage ?? false,
      donnees.remunereAuJour ?? false,
      donnees.situationMatrimoniale ?? null,
      donnees.groupeSanguin ?? null,
      donnees.contactUrgenceNom ?? null,
      donnees.contactUrgenceLien ?? null,
      donnees.contactUrgenceTel ?? null,
      donnees.contactUrgenceTel2 ?? null,
      donnees.maladieParticuliere ?? null,
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

// Décision RH indépendante du chantier/contrat — cf. commentaire soumis_pointage sur la table
// employes (schema.sql) et paie.ts qui lit ce champ pour décider du blocage de paie.
export async function definirSoumisPointage(id: string, soumisPointage: boolean): Promise<Employe> {
  const { rows } = await pool.query(
    'UPDATE employes SET soumis_pointage = $2, updated_at = now() WHERE id = $1 RETURNING *',
    [id, soumisPointage]
  );

  if (!rows[0]) {
    throw new ErreurApplicative(404, 'Employé introuvable');
  }

  return mapLigne(rows[0]);
}

export async function modifierEmploye(id: string, donnees: ModificationEmploye): Promise<Employe> {
  if (donnees.categorieProfessionnelle) {
    await verifierCategorieProfessionnelle(donnees.categorieProfessionnelle);
  }

  const entrees = (Object.entries(donnees) as [keyof ModificationEmploye, unknown][]).filter(
    ([, valeur]) => valeur !== undefined
  );

  if (entrees.length === 0) {
    const actuel = await obtenirEmploye(id);
    if (!actuel) throw new ErreurApplicative(404, 'Employé introuvable');
    return actuel;
  }

  const clauses: string[] = [];
  const valeurs: unknown[] = [];
  for (const [cle, valeur] of entrees) {
    valeurs.push(valeur);
    clauses.push(`${COLONNES_MODIFIABLES[cle]} = $${valeurs.length}`);
  }
  valeurs.push(id);

  const { rows } = await pool.query(
    `UPDATE employes SET ${clauses.join(', ')}, updated_at = now() WHERE id = $${valeurs.length} RETURNING *`,
    valeurs
  );

  if (!rows[0]) {
    throw new ErreurApplicative(404, 'Employé introuvable');
  }

  return mapLigne(rows[0]);
}

// dateSortie/motifSortie : renseignés uniquement pour statut='sorti' (contrôlé côté contrôleur) —
// remis à null pour tout autre statut (ex. réactivation après une sortie saisie par erreur), pour
// ne jamais laisser une date de sortie orpheline sur un employé redevenu actif/suspendu.
export async function changerStatutEmploye(
  id: string,
  statut: StatutEmploye,
  dateSortie?: string,
  motifSortie?: string
): Promise<Employe> {
  const { rows } = await pool.query(
    `UPDATE employes SET statut = $2, date_sortie = $3, motif_sortie = $4, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, statut, statut === 'sorti' ? (dateSortie ?? null) : null, statut === 'sorti' ? (motifSortie ?? null) : null]
  );

  if (!rows[0]) {
    throw new ErreurApplicative(404, 'Employé introuvable');
  }

  return mapLigne(rows[0]);
}

function mapTauxJournalier(l: Record<string, unknown>): TauxJournalier {
  return {
    employeId: l.employe_id as string,
    salaireBaseMensuel: Number(l.salaire_base_mensuel),
    indemniteTransportMensuel: Number(l.indemnite_transport_mensuel),
    primeLaitMensuel: Number(l.prime_lait_mensuel),
    primeSalissureMensuel: Number(l.prime_salissure_mensuel),
  };
}

export async function obtenirTauxJournalier(employeId: string): Promise<TauxJournalier | null> {
  const { rows } = await pool.query('SELECT * FROM taux_journaliers WHERE employe_id = $1', [employeId]);
  return rows[0] ? mapTauxJournalier(rows[0]) : null;
}

// Upsert (une seule ligne par employé, cf. contrainte UNIQUE employe_id) — pas d'historique de
// date d'effet : les bulletins déjà calculés conservent leurs propres montants, indépendants
// d'un changement de taux ultérieur (cf. commentaire de la table).
export async function definirTauxJournalier(
  employeId: string,
  donnees: SaisieTauxJournalier
): Promise<TauxJournalier> {
  const { rows } = await pool.query(
    `INSERT INTO taux_journaliers (employe_id, salaire_base_mensuel, indemnite_transport_mensuel, prime_lait_mensuel, prime_salissure_mensuel)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (employe_id) DO UPDATE SET
       salaire_base_mensuel = EXCLUDED.salaire_base_mensuel,
       indemnite_transport_mensuel = EXCLUDED.indemnite_transport_mensuel,
       prime_lait_mensuel = EXCLUDED.prime_lait_mensuel,
       prime_salissure_mensuel = EXCLUDED.prime_salissure_mensuel,
       updated_at = now()
     RETURNING *`,
    [
      employeId,
      donnees.salaireBaseMensuel,
      donnees.indemniteTransportMensuel,
      donnees.primeLaitMensuel,
      donnees.primeSalissureMensuel,
    ]
  );
  return mapTauxJournalier(rows[0]);
}
