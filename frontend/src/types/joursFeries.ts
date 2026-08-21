export interface JourFerie {
  id: string;
  date: string;
  libelle: string;
  filialeId: string | null;
}

export interface CreationJourFerie {
  date: string;
  libelle: string;
  filialeId?: string;
}
