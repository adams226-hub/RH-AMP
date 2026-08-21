export type StatutDemandeConge =
  | 'brouillon'
  | 'soumise'
  | 'avis_favorable'
  | 'avis_defavorable'
  | 'validee_rh'
  | 'rejetee_rh'
  | 'annulee';

export interface DemandeConge {
  id: string;
  employeId: string;
  dateDebut: string;
  dateFin: string;
  nbJours: number;
  motif: string | null;
  statut: StatutDemandeConge;
  avisHierarchique: 'favorable' | 'defavorable' | null;
  commentaireHierarchique: string | null;
  decisionRh: 'validee' | 'rejetee' | null;
  commentaireRh: string | null;
}

export interface DemandeCongeAvecEmploye extends DemandeConge {
  employeNom: string;
  employePrenoms: string;
  employeMatricule: string;
  filialeId: string;
}

export interface SoldeConge {
  employeId: string;
  annee: number;
  soldeInitial: number;
  joursAcquis: number;
  joursConsommes: number;
  joursDeduits: number;
  soldeDisponible: number;
}

export interface CreationDemandeConge {
  employeId: string;
  dateDebut: string;
  dateFin: string;
  motif?: string;
}
