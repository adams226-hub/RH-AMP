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
}
