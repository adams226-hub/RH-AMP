export type StatutBulletin = 'brouillon' | 'calcule' | 'valide' | 'valide_drh' | 'cloture';

export interface BulletinPaie {
  id: string;
  employeId: string;
  periode: string;

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
}

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

export interface ResultatSimulationNetVersBrut {
  champVariable: 'salaireDeBase' | 'sursalaire';
  valeurTrouvee: number;
  convergence: boolean;
  ecartFinal: number;
  bulletin: DetailBulletinSimule;
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
