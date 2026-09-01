export interface CategorieProfessionnelle {
  id: string;
  code: string;
  libelle: string;
  // Pilote l'abattement forfaitaire IUTS du moteur de paie (20% si true / cadre, 25% si false /
  // non-cadre) — cf. paie.ts.
  estCadre: boolean;
  actif: boolean;
}

export interface CreationCategorieProfessionnelle {
  code: string;
  libelle: string;
  estCadre: boolean;
}

export interface ModificationCategorieProfessionnelle {
  libelle: string;
  estCadre: boolean;
}
