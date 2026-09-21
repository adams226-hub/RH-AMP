import { StatutDemandeConge } from '../conges/conges.types';

export type TypeDemandeAbsence = 'permission_exceptionnelle' | 'absence_hors_bareme';
export type ClassificationAbsence = 'non_deductible' | 'deductible_conge' | 'sans_solde';

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
  avisHierarchique: 'favorable' | 'defavorable' | null;
  commentaireHierarchique: string | null;
  decisionRh: 'validee' | 'rejetee' | null;
  commentaireRh: string | null;
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

export interface CreationDemandeAbsence {
  employeId: string;
  type: TypeDemandeAbsence;
  motifBareme?: string;
  motif?: string;
  dateDebut: string;
  dateFin: string;
  justificatifFourni?: boolean;
}

// Modification possible uniquement tant que statut === 'soumise' (avant l'avis hiérarchique).
export interface ModificationDemandeAbsence {
  type?: TypeDemandeAbsence;
  motifBareme?: string;
  motif?: string;
  dateDebut?: string;
  dateFin?: string;
  justificatifFourni?: boolean;
}
