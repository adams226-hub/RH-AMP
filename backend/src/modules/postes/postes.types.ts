export interface Filiale {
  id: string;
  nom: string;
  ville: string | null;
  pays: string;
  // Coordonnées légales affichées en pied de bulletin de paie — une valeur par filiale.
  adresse: string | null;
  rccm: string | null;
  ifu: string | null;
  telephone: string | null;
  siteWeb: string | null;
  logoUrl: string | null;
  // Hex ('#RRGGBB'), couleur dominante du logo — bandeau/pied de page des attestations (cf.
  // attestations.pdf.ts) ; null = gris neutre par défaut.
  couleurAccent: string | null;
  actif: boolean;
}

export interface CoordonneesLegalesFiliale {
  adresse?: string;
  rccm?: string;
  ifu?: string;
  telephone?: string;
  siteWeb?: string;
  couleurAccent?: string;
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
