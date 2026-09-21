import { StatutDemandeConge } from './conges';

export type TypeDemandeAbsence = 'permission_exceptionnelle' | 'absence_hors_bareme';
export type ClassificationAbsence = 'non_deductible' | 'deductible_conge' | 'sans_solde';

export interface EvenementBareme {
  cle: string;
  libelle: string;
  jours: number;
}

export interface DemandeAbsence {
  id: string;
  employeId: string;
  type: TypeDemandeAbsence;
  motifBareme: string | null;
  motif: string;
  dateDebut: string;
  dateFin: string;
  nbJours: number;
  nbJoursBareme: number;
  nbJoursHorsBareme: number;
  justificatifFourni: boolean;
  statut: StatutDemandeConge;
  classification: ClassificationAbsence | null;
}

export interface DemandeAbsenceAvecEmploye extends DemandeAbsence {
  employeNom: string;
  employePrenoms: string;
  employeMatricule: string;
  filialeId: string;
  chantierId: string | null;
}

export interface SoldePermissionExceptionnelle {
  employeId: string;
  annee: number;
  quota: number;
  joursConsommes: number;
  soldeDisponible: number;
}
