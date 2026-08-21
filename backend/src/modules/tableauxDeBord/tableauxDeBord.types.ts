export interface RepartitionFiliale {
  filiale: string;
  total: number;
}

export interface EffectifReponse {
  parStatut: { statut: string; total: number }[];
  parFiliale: RepartitionFiliale[];
}

export interface SortieDetail {
  id: string;
  matricule: string;
  nom: string;
  prenoms: string;
  filiale: string;
  dateSortie: string;
  motifSortie: string | null;
}

export interface SortiesReponse {
  total: number;
  parMotif: { motif: string; total: number }[];
  details: SortieDetail[];
}

export interface TrancheAge {
  tranche: string; // ex. "30-34"
  borneBasse: number;
  hommes: number;
  femmes: number;
  total: number;
}

export interface PyramideAgesReponse {
  tranches: TrancheAge[];
}

export interface MassSalarialeParSociete {
  filiale: string;
  totalBrut: number;
  totalNet: number;
  totalCoutEmployeur: number;
}

export interface MasseSalarialeMois {
  periode: string; // "YYYY-MM"
  parSociete: MassSalarialeParSociete[];
  total: number;
}

export interface MasseSalarialeReponse {
  mois: MasseSalarialeMois[];
}

export interface TurnoverReponse {
  periodeDebut: string;
  periodeFin: string;
  sorties: number;
  effectifDebut: number;
  effectifFin: number;
  effectifMoyen: number;
  tauxPourcent: number;
}
