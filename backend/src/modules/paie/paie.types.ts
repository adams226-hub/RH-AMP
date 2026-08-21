export type StatutBulletin = 'brouillon' | 'calcule' | 'valide' | 'valide_drh' | 'cloture';

export interface BulletinPaie {
  id: string;
  employeId: string;
  periode: string;

  joursPrisEnCompte: number;
  personnesACharge: number;
  // Snapshot de fonctions.intitule au moment du calcul (cf. bulletins_paie.fonction_intitule) —
  // un renommage/archivage ultérieur de la fonction ne change jamais un bulletin déjà généré.
  fonctionIntitule: string | null;

  salaireBase: number;
  sursalaire: number;
  indemniteLogement: number;
  indemniteTransport: number;
  indemniteFonction: number;
  indemniteSujetion: number;
  indemniteAstreinte: number;
  ancienneteAnnees: number;
  primeAnciennete: number;
  heuresSupplementaires: number;
  primePanier: number;
  autresIndemnites: number;
  avanceAcompte: number;
  reliquat: number;
  reversementTropPercu: number;

  brut: number;
  exonerationsIndemnites: number;
  abattementForfaitaire: number;
  salaireNetImposable: number;
  baseImposable: number;
  iuts: number;
  cnssSalariale: number;
  salaireNet: number;
  fsp: number;
  autresRetenues: number;
  netAPayer: number;
  coutEmployeur: number;

  statut: StatutBulletin;
  pdfUrl: string | null;
}

export interface ElementsCalculBulletin {
  employeId: string;
  periode: string;
}

export interface EchecCalculMasse {
  employeId: string;
  nom: string;
  prenoms: string;
  motif: string;
}

export interface ResultatCalculMasse {
  periode: string;
  bulletinsCalcules: BulletinPaie[];
  echecs: EchecCalculMasse[];
}

// Simulateur Net → Brut (ADDENDUM_CALCUL_INVERSE_PAIE_AMP.md) — ne touche jamais la base ;
// mêmes champs qu'un bulletin pour l'affichage, sans id/employeId/periode/statut.
export interface DetailBulletinSimule {
  joursPrisEnCompte: number;
  personnesACharge: number;
  salaireBase: number;
  sursalaire: number;
  indemniteLogement: number;
  indemniteTransport: number;
  indemniteFonction: number;
  indemniteSujetion: number;
  indemniteAstreinte: number;
  ancienneteAnnees: number;
  primeAnciennete: number;
  heuresSupplementaires: number;
  primePanier: number;
  autresIndemnites: number;
  reliquat: number;
  reversementTropPercu: number;
  retenuesAvancesDuMois: number;
  brut: number;
  exonerationsIndemnites: number;
  abattementForfaitaire: number;
  salaireNetImposable: number;
  baseImposable: number;
  iuts: number;
  cnssSalariale: number;
  salaireNet: number;
  fsp: number;
  netAPayer: number;
}

export interface SimulationNetVersBrut {
  netCible: number;
  categorie: 'CADRE' | 'NON_CADRE';
  personnesACharge?: number;
  ancienneteAnnees?: number;
  sursalaire?: number;
  indemniteLogement?: number;
  indemniteTransport?: number;
  indemniteSujetion?: number;
  indemniteAstreinte?: number;
  indemniteFonction?: number;
  panier?: number;
  autresIndemnites?: number;
  retenuesAvancesDuMois?: number;
  reliquat?: number;
  reversementTropPercu?: number;
  joursPrisEnCompte?: number;
  champVariable?: 'salaireDeBase' | 'sursalaire';
}

export interface ResultatSimulationNetVersBrut {
  champVariable: 'salaireDeBase' | 'sursalaire';
  valeurTrouvee: number;
  convergence: boolean;
  ecartFinal: number;
  bulletin: DetailBulletinSimule;
}
