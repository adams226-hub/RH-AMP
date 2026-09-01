export type TypeAttestation = 'att_trav' | 'cert_trav' | 'att_stage';

export interface Stagiaire {
  employeId: string;
  filiereEtudes: string | null;
  etablissement: string | null;
  superviseurId: string | null;
}

export interface PosteOccupe {
  poste: string;
  dateDebut: string;
  dateFin: string | null;
}

interface ChampsCommuns {
  nomDirigeant: string;
  fonctionDirigeant: string;
  fonctionSignataire: string;
  entreprise: string;
  dateEmission: string;
}

export interface DonneesAttestationTravail extends ChampsCommuns {
  nomPrenomsEmploye: string;
  sexe: 'M' | 'F';
  dateNaissance: string | null;
  lieuNaissance: string | null;
  numeroPiece: string;
  dateEmbauche: string;
  poste: string;
  typeContrat: string;
  filiale: string;
  lieuAffectation: string;
}

export interface DonneesCertificatTravail extends ChampsCommuns {
  nomPrenomsEmploye: string;
  sexe: 'M' | 'F';
  dateEmbauche: string;
  dateSortie: string;
  dureeService: string;
  postesOccupes: PosteOccupe[];
  motifDepart: string;
}

export interface DonneesAttestationStage extends ChampsCommuns {
  nomPrenomsStagiaire: string;
  sexe: 'M' | 'F';
  filiereEtudes: string;
  etablissement: string;
  dateDebutStage: string;
  dateFinStage: string;
  dureeStage: string;
  service: string;
  superviseur: string;
  descriptionMissions: string;
  appreciation: string;
}

export type DonneesAttestation = DonneesAttestationTravail | DonneesCertificatTravail | DonneesAttestationStage;

export interface Attestation {
  id: string;
  type: TypeAttestation;
  numero: number;
  numeroComplet: string;
  filialeId: string;
  annee: number;
  employeId: string;
  dateEmission: string;
  emisPar: string | null;
  donnees: DonneesAttestation;
}

export interface AttestationAvecEmploye extends Attestation {
  employeNom: string;
  employePrenoms: string;
  employeMatricule: string;
}
