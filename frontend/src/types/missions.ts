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

// ----------------------------------------------------------------------------
// Maisons d'hôte — intégré au module Missions.
// ----------------------------------------------------------------------------

export interface MaisonHote {
  id: string;
  filialeId: string;
  nom: string;
  ville: string | null;
  actif: boolean;
}

export type CategorieTarifHebergement = 'cadre' | 'cadre_superieur';

export interface CreationSejourMaisonHote {
  maisonId: string;
  dateArrivee: string;
  dateDepart: string;
  nouvelleDateFin?: string;
  motifProlongation?: string;
  centreImputation?: string;
  categorieTarif: CategorieTarifHebergement;
}

export interface SejourMaisonHoteAvecDetails {
  id: string;
  missionId: string;
  maisonId: string;
  maisonNom: string;
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
  employeId: string;
  employeNom: string;
  employePrenoms: string;
  employeTelephone: string;
  employeCategorie: string | null;
  employeFonction: string | null;
  numeroOrdreMission: string | null;
  motifMission: string;
}
