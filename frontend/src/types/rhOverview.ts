export interface FiltresRHOverview {
  filialeId: string[];
  categorieProfessionnelle: string[];
  sexe: ('M' | 'F')[];
  typeContrat: string[];
}

export interface RepartitionParSexe {
  cle: string;
  hommes: number;
  femmes: number;
  total: number;
}

export interface TrancheAgeRH {
  tranche: string;
  borneBasse: number;
  hommes: number;
  femmes: number;
}

export interface RHOverviewReponse {
  kpi: {
    effectifTotal: number;
    effectifHommes: number;
    effectifFemmes: number;
    remunerationMoyenne: number;
    remunerationTotale: number;
  };
  sexe: { hommes: number; femmes: number };
  parCategorie: RepartitionParSexe[];
  parNationalite: RepartitionParSexe[];
  parEntreprise: RepartitionParSexe[];
  parTypeContrat: RepartitionParSexe[];
  parAnciennete: RepartitionParSexe[];
  pyramideAges: TrancheAgeRH[];
}

export const FILTRES_VIDES: FiltresRHOverview = {
  filialeId: [],
  categorieProfessionnelle: [],
  sexe: [],
  typeContrat: [],
};
