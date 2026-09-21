export type TypeCongeSpecial = 'maternite' | 'paternite';
export type StatutCongeSpecial = 'soumise' | 'validee' | 'rejetee';

export interface DemandeCongeSpecial {
  id: string;
  employeId: string;
  type: TypeCongeSpecial;
  dateDebut: string;
  dateFin: string;
  justificatifFourni: boolean;
  motif: string | null;
  statut: StatutCongeSpecial;
  commentaireRh: string | null;
  validePar: string | null;
  valideLe: string | null;
}

export interface DemandeCongeSpecialAvecEmploye extends DemandeCongeSpecial {
  employeNom: string;
  employePrenoms: string;
  employeMatricule: string;
  filialeId: string;
}
