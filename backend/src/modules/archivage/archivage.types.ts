export type CategorieDocument =
  | 'contrat'
  | 'cnib'
  | 'diplome'
  | 'certificat'
  | 'permis'
  | 'document_administratif'
  | 'bulletin_paie'
  | 'autre';

export type StatutDocument = 'valide' | 'expire' | 'a_renouveler';
export type ConfidentialiteDocument = 'standard' | 'restreinte';

export interface DocumentArchive {
  id: string;
  categorie: CategorieDocument;
  employeId: string | null;
  employeNom: string | null;
  employePrenoms: string | null;
  employeMatricule: string | null;
  filialeId: string | null;
  nomOriginal: string;
  typeMime: string;
  tailleOctets: number;
  dateExpiration: string | null;
  statut: StatutDocument;
  confidentialite: ConfidentialiteDocument;
  version: number;
  createdAt: string;
}

export interface DepotDocument {
  categorie: CategorieDocument;
  employeId?: string;
  filialeId?: string;
  dateExpiration?: string;
  confidentialite?: ConfidentialiteDocument;
}
