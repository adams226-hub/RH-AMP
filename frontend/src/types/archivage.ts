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

export interface DocumentArchive {
  id: string;
  categorie: CategorieDocument;
  employeId: string | null;
  employeNom: string | null;
  employePrenoms: string | null;
  employeMatricule: string | null;
  nomOriginal: string;
  tailleOctets: number;
  dateExpiration: string | null;
  statut: StatutDocument;
  createdAt: string;
}
