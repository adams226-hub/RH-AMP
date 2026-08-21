export interface Chantier {
  id: string;
  filialeId: string;
  nom: string;
  localisation: string | null;
  actif: boolean;
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
  commentaireRejet: string | null;
}

export interface PointageMensuelAvecDetails extends PointageMensuel {
  employeNom: string;
  employePrenoms: string;
  employeMatricule: string;
  chantierNom: string;
  filialeId: string;
}

export interface AnomalieAbsence {
  date: string;
  code: CodeAbsencePointage;
  message: string;
}
