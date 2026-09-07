// cdc = Contrat à Durée de Chantier
export type TypeContrat = 'cdi' | 'cdd' | 'stage' | 'cdc';
export type StatutContrat = 'brouillon' | 'signe' | 'actif' | 'renouvele' | 'expire' | 'rompu' | 'termine';

export interface Contrat {
  id: string;
  employeId: string;
  type: TypeContrat;
  dateDebut: string;
  dateFin: string | null;
  dureeEssaiJours: number | null;
  finPeriodeEssai: string | null;
  fonctionId: string | null;
  salaireBase: number;
  sursalaire: number;
  indemniteLogement: number;
  indemniteTransport: number;
  indemniteFonction: number;
  indemniteSujetion: number;
  indemniteAstreinte: number;
  statut: StatutContrat;
  contratPrecedentId: string | null;
  nbRenouvellements: number;
  motifRupture: string | null;
  dateRupture: string | null;
  pdfUrl: string | null;
}

export interface ContratAvecEmploye extends Contrat {
  employeNom: string;
  employePrenoms: string;
  employeMatricule: string;
  filialeId: string;
}

interface ComposantesRemuneration {
  sursalaire?: number;
  indemniteLogement?: number;
  indemniteTransport?: number;
  indemniteFonction?: number;
  indemniteSujetion?: number;
  indemniteAstreinte?: number;
}

export interface CreationContrat extends ComposantesRemuneration {
  employeId: string;
  type: TypeContrat;
  dateDebut: string;
  dateFin?: string;
  dureeEssaiJours?: number;
  fonctionId?: string;
  salaireBase: number;
}

export interface RenouvellementContrat extends ComposantesRemuneration {
  dateDebut: string;
  dateFin?: string;
  salaireBase: number;
}

export interface RuptureContrat {
  dateRupture: string;
  motifRupture: string;
}
