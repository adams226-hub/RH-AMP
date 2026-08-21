export type CategorieProfessionnelle = 'ouvrier' | 'employe' | 'agent_maitrise' | 'cadre';

export interface FiltresRHOverview {
  filialeId?: string[];
  categorieProfessionnelle?: CategorieProfessionnelle[];
  sexe?: ('M' | 'F')[];
  typeContrat?: string[];
}

interface RepartitionParSexe {
  cle: string;
  hommes: number;
  femmes: number;
  total: number;
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
  pyramideAges: { tranche: string; borneBasse: number; hommes: number; femmes: number }[];
}
