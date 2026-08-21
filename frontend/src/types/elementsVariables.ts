export type TypeElementSaisissable = 'prime' | 'avance' | 'panier' | 'reliquat' | 'absence_injustifiee' | 'trop_percu';

export interface ElementVariable {
  id: string;
  employeId: string;
  periode: string;
  type: TypeElementSaisissable;
  montant: number | null;
  jours: number | null;
}
