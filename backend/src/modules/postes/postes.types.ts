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

// Référentiel plat, partagé à l'échelle du groupe — plus de lien vers un service (cf. décision produit).
export interface Fonction {
  id: string;
  intitule: string;
  actif: boolean;
  description: string | null;
}

export interface CreationFiliale {
  nom: string;
  ville?: string;
  pays?: string;
}

export interface CreationDepartement {
  filialeId: string;
  nom: string;
  responsableId?: string;
}

export interface CreationServiceOrg {
  departementId: string;
  nom: string;
  responsableId?: string;
}

export interface CreationFonction {
  intitule: string;
  description?: string;
}
