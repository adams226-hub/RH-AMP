// Types saisissables à la main via l'écran "Éléments du mois", avant calcul de paie.
// 'heure_sup' est exclu : alimenté exclusivement par la validation du Pointage.
export type TypeElementSaisissable =
  | 'prime'
  | 'avance'
  | 'panier'
  | 'reliquat'
  | 'absence_injustifiee'
  | 'trop_percu'
  | 'heure_sup_50'
  | 'heure_sup_120'
  // Montant forfaitaire mensuel remplaçant le calcul horaire (cadres/manœuvres au forfait,
  // demande explicite) — jamais additionné aux heures sup calculées depuis le pointage, cf.
  // calculerBulletinPaie.ts (l'un ou l'autre, pas les deux).
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

export interface ElementVariableAvecEmploye extends ElementVariable {
  employeNom: string;
  employePrenoms: string;
  employeMatricule: string;
  filialeId: string;
}

export interface SaisieElementVariable {
  employeId: string;
  periode: string;
  type: TypeElementSaisissable;
  montant?: number;
  jours?: number;
}
