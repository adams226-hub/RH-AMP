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
