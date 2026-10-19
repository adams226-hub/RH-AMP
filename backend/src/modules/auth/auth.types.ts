export type CodeRole =
  | 'super_admin'
  | 'drh_holding'
  | 'rh_filiale'
  | 'chef_service'
  | 'employe'
  | 'responsable_rh_chantier'
  | 'gestionnaire_conges_absences'
  | 'gestionnaire_contrats_attestations'
  | 'gestionnaire_paie'
  | 'gestionnaire_temps_presences'
  | 'gestionnaire_personnel_pointage';

export interface PayloadJwt {
  sub: string; // id utilisateur
  role: CodeRole;
  employeId: string | null;
  filiales: string[] | null; // null = accès à toutes les filiales (super_admin, drh_holding)
}
