export type StatutMission = 'a_venir' | 'en_cours' | 'en_retard' | 'terminee';

export interface Mission {
  id: string;
  employeId: string;
  numeroOrdreMission: string | null;
  destination: string;
  motif: string;
  dateDepart: string;
  dateRetourPrevue: string;
  dateRetourReelle: string | null;
  montantHebergement: number;
  montantRestauration: number;
  statut: StatutMission;
}

export interface MissionAvecEmploye extends Mission {
  employeNom: string;
  employePrenoms: string;
  employeMatricule: string;
  filialeId: string;
}

export interface CreationMission {
  employeId: string;
  numeroOrdreMission: string;
  destination: string;
  motif: string;
  dateDepart: string;
  dateRetourPrevue: string;
  montantHebergement?: number;
  montantRestauration?: number;
  hebergement?: CreationSejourMaisonHote;
}

// ----------------------------------------------------------------------------
// Maisons d'hôte — intégré au module Missions (pas de module séparé, décision produit).
// ----------------------------------------------------------------------------

export interface MaisonHote {
  id: string;
  filialeId: string;
  nom: string;
  ville: string | null;
  actif: boolean;
}

export interface CreationMaisonHote {
  filialeId: string;
  nom: string;
  ville?: string;
}

export interface ModificationMaisonHote {
  nom: string;
  ville?: string;
}

export type CategorieTarifHebergement = 'cadre' | 'cadre_superieur';

export interface SejourMaisonHote {
  id: string;
  missionId: string;
  maisonId: string;
  dateArrivee: string;
  dateDepart: string;
  nouvelleDateFin: string | null;
  motifProlongation: string | null;
  centreImputation: string | null;
  categorieTarif: CategorieTarifHebergement;
  tarifNuitee: number;
  nuitees: number;
  nuiteesProlongation: number;
  forfaitTotal: number;
}

export interface SejourMaisonHoteAvecDetails extends SejourMaisonHote {
  maisonNom: string;
  employeId: string;
  employeNom: string;
  employePrenoms: string;
  employeTelephone: string;
  employeCategorie: string | null;
  employeFonction: string | null;
  numeroOrdreMission: string | null;
  motifMission: string;
}

// Sans mission_id : rattaché à la mission au moment de la création de celle-ci
// (calculerEtEnregistrerSejour reçoit le mission_id séparément).
export interface CreationSejourMaisonHote {
  maisonId: string;
  dateArrivee: string;
  dateDepart: string;
  nouvelleDateFin?: string;
  motifProlongation?: string;
  centreImputation?: string;
  categorieTarif: CategorieTarifHebergement;
}
