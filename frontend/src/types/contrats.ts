// cdc = Contrat à Durée de Chantier
export type TypeContrat = 'cdi' | 'cdd' | 'stage' | 'cdc';
export type StatutContrat = 'brouillon' | 'signe' | 'actif' | 'renouvele' | 'expire' | 'rompu' | 'termine';

export interface Contrat {
  id: string;
  employeId: string;
  type: TypeContrat;
  dateDebut: string;
  dateFin: string | null;
  salaireBase: number;
  sursalaire: number;
  indemniteLogement: number;
  indemniteTransport: number;
  indemniteFonction: number;
  indemniteSujetion: number;
  indemniteAstreinte: number;
  statut: StatutContrat;
  nbRenouvellements: number;
}

export interface ContratAvecEmploye extends Contrat {
  employeNom: string;
  employePrenoms: string;
  employeMatricule: string;
  filialeId: string;
}
