export type TypeElementSaisissable =
  | 'prime'
  | 'avance'
  | 'panier'
  | 'reliquat'
  | 'absence_injustifiee'
  | 'trop_percu'
  // Montant forfaitaire mensuel remplaçant le calcul horaire (cadres/manœuvres au forfait) —
  // jamais additionné aux heures sup calculées depuis le pointage.
  | 'heure_sup_forfait'
  | 'prime_salissure'
  | 'prime_lait';

export interface ElementVariable {
  id: string;
  employeId: string;
  periode: string;
  type: TypeElementSaisissable;
  montant: number | null;
  jours: number | null;
}
