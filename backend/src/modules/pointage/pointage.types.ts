export interface Chantier {
  id: string;
  filialeId: string;
  nom: string;
  localisation: string | null;
  responsableId: string | null;
  actif: boolean;
}

export interface CreationChantier {
  filialeId: string;
  nom: string;
  localisation?: string;
  responsableId?: string;
}

export type StatutPointageMensuel = 'brouillon' | 'soumis' | 'valide' | 'rejete';

export type CodeAbsencePointage =
  | 'absence_injustifiee'
  | 'repos_medical'
  | 'permission_non_payee'
  | 'permission_payee'
  | 'conge_annuel'
  | 'ferie';

export interface JourPointage {
  date: string;
  heures: number | null;
  codeAbsence: CodeAbsencePointage | null;
}

export interface PointageMensuel {
  id: string;
  employeId: string;
  chantierId: string;
  periodeDebut: string;
  periodeFin: string;
  moisPaie: string;
  heuresHs15: number;
  heuresHs35: number;
  heuresHs60: number;
  joursPanier: number;
  nbJoursAbsenceInjustifiee: number;
  nbJoursReposMedical: number;
  nbJoursPermissionNonPayee: number;
  nbJoursPermissionPayee: number;
  nbJoursCongeAnnuel: number;
  statut: StatutPointageMensuel;
  soumisPar: string | null;
  soumisLe: string | null;
  validePar: string | null;
  valideLe: string | null;
  commentaireRejet: string | null;
}

export interface PointageMensuelAvecDetails extends PointageMensuel {
  employeNom: string;
  employePrenoms: string;
  employeMatricule: string;
  chantierNom: string;
  filialeId: string;
}

// Heures sup (15/35/60%), jours panier et compteurs d'absence ne se saisissent plus directement —
// ils sont recalculés automatiquement depuis `jours` par calculerPointageDepuisJours (cf.
// pointage.calcul.ts, règles fournies par l'utilisateur/CARTE_POINTAGE, jamais inventées).
export interface SaisiePointageMensuel {
  employeId: string;
  chantierId: string;
  periodeDebut: string;
  periodeFin: string;
  jours?: { date: string; heures?: number; codeAbsence?: CodeAbsencePointage }[];
}

// Effectif d'un chantier pour un mois donné — alimente l'écran de saisie « chantier d'abord » :
// on choisit le chantier/la période une fois, puis on voit qui a déjà une fiche (et son statut)
// plutôt que de rechercher chaque employé un par un.
export interface EmployeAvecPointage {
  employeId: string;
  matricule: string;
  nom: string;
  prenoms: string;
  ficheId: string | null;
  statut: StatutPointageMensuel | null;
}

export interface AnomalieAbsence {
  date: string;
  code: CodeAbsencePointage;
  message: string;
}
