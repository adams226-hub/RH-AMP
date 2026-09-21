export type StatutEmploye = 'en_cours_creation' | 'actif' | 'suspendu' | 'sorti';
// Référence categories_professionnelles.code (référentiel géré depuis Paramètres > Référentiels,
// plus un ENUM figé) — simple chaîne libre côté types, validée par la FK en base.

export interface Employe {
  id: string;
  matricule: string;
  nom: string;
  prenoms: string;
  dateNaissance: string;
  sexe: 'M' | 'F';
  nationalite: string;
  telephone: string;
  numCnib: string;
  numCnss: string;
  rib: string | null;
  banque: string | null;
  modePaiement: string | null;
  personnesACharge: number;
  filialeId: string;
  departementId: string | null;
  serviceId: string | null;
  fonctionId: string | null;
  superieurId: string | null;
  chantierId: string | null;
  dateEmbauche: string;
  statut: StatutEmploye;
  dateSortie: string | null;
  motifSortie: string | null;
  categorieProfessionnelle: string | null;
  // Indépendant de chantierId et de l'existence d'un contrat — décision RH explicite, pilote le
  // blocage de paie tant que le pointage du mois n'est pas validé (cf. paie.ts).
  soumisPointage: boolean;
  situationMatrimoniale: string | null;
  groupeSanguin: string | null;
  contactUrgenceNom: string | null;
  contactUrgenceLien: string | null;
  contactUrgenceTel: string | null;
  contactUrgenceTel2: string | null;
  maladieParticuliere: string | null;
}

// Résumé affiché sur la fiche employé (écran Employés) — congés/absences de l'année en cours
// uniquement, et seulement les absences validées par la RH (une demande en brouillon ou en
// attente ne doit pas apparaître comme un fait acquis).
export interface ResumeRhEmploye {
  annee: number;
  joursAbsenceValides: number;
  congesPris: number;
  soldeConges: number;
  enMission: boolean;
  missionDestination: string | null;
  missionDateRetourPrevue: string | null;
}

export interface CreationEmploye {
  matricule: string;
  nom: string;
  prenoms: string;
  dateNaissance: string;
  sexe: 'M' | 'F';
  nationalite: string;
  telephone: string;
  numCnib: string;
  numCnss: string;
  rib?: string;
  banque?: string;
  modePaiement?: string;
  personnesACharge?: number;
  filialeId: string;
  departementId?: string;
  serviceId?: string;
  fonctionId?: string;
  chantierId?: string;
  dateEmbauche: string;
  categorieProfessionnelle?: string;
  soumisPointage?: boolean;
  situationMatrimoniale?: string;
  groupeSanguin?: string;
  contactUrgenceNom?: string;
  contactUrgenceLien?: string;
  contactUrgenceTel?: string;
  contactUrgenceTel2?: string;
  maladieParticuliere?: string;
}

// Édition d'une fiche existante — tous les champs de création redeviennent optionnels
// (mise à jour partielle) ; employeId/matricule restent modifiables (correction d'erreur de saisie).
export type ModificationEmploye = Partial<CreationEmploye>;
