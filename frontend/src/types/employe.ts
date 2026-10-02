export type StatutEmploye = 'en_cours_creation' | 'actif' | 'suspendu' | 'sorti';

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
  // Référence categories_professionnelles.code (référentiel géré depuis Paramètres).
  categorieProfessionnelle: string | null;
  // Décision RH indépendante du chantier/contrat — pilote le blocage de paie tant que le
  // pointage du mois n'est pas validé.
  soumisPointage: boolean;
  // Ouvrier sans contrat, payé uniquement au jour pointé (cf. TauxJournalier) — le calcul de
  // paie saute alors l'exigence de contrat actif.
  remunereAuJour: boolean;
  situationMatrimoniale: string | null;
  groupeSanguin: string | null;
  contactUrgenceNom: string | null;
  contactUrgenceLien: string | null;
  contactUrgenceTel: string | null;
  contactUrgenceTel2: string | null;
  maladieParticuliere: string | null;
}

// Montants mensuels de référence d'un employé rémunéré au jour (Employe.remunereAuJour) — chaque
// rubrique est proratisée par jours pointés / 30 lors du calcul de paie, comme un salarié sous
// contrat, mais à la place d'un contrat.
export interface TauxJournalier {
  employeId: string;
  salaireBaseMensuel: number;
  indemniteTransportMensuel: number;
  primeLaitMensuel: number;
  primeSalissureMensuel: number;
}

// Résumé RH affiché sur la fiche employé — année en cours, absences validées par la RH
// uniquement (cf. backend/src/modules/employes/employes.types.ts).
export interface ResumeRhEmploye {
  annee: number;
  joursAbsenceValides: number;
  congesPris: number;
  soldeConges: number;
  enMission: boolean;
  missionDestination: string | null;
  missionDateRetourPrevue: string | null;
}
