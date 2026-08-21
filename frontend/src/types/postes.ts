export interface Filiale {
  id: string;
  nom: string;
  ville: string | null;
  pays: string;
  actif: boolean;
}

export interface Departement {
  id: string;
  filialeId: string;
  nom: string;
  actif: boolean;
  responsableId: string | null;
}

export interface ServiceOrg {
  id: string;
  departementId: string;
  nom: string;
  actif: boolean;
  responsableId: string | null;
}

// Référentiel plat, partagé à l'échelle du groupe — pas de lien vers un service.
export interface Fonction {
  id: string;
  intitule: string;
  actif: boolean;
  description: string | null;
}
