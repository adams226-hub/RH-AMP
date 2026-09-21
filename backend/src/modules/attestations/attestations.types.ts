export type TypeAttestation = 'att_trav' | 'cert_trav' | 'att_stage';

export interface Stagiaire {
  employeId: string;
  filiereEtudes: string | null;
  etablissement: string | null;
  superviseurId: string | null;
}

export interface SaisieStagiaire {
  filiereEtudes?: string;
  etablissement?: string;
  superviseurId?: string;
}

// Historique d'un poste occupé (Certificat de travail — la loi impose de lister tous les postes
// successifs, pas seulement le dernier, cf. SPEC_MODULE_ATTESTATIONS_AMP.md §3).
export interface PosteOccupe {
  poste: string;
  dateDebut: string;
  dateFin: string | null;
}

// Champs communs aux 3 modèles, remplis par défaut depuis la fiche employé/filiale puis
// librement édités par le RH dans l'aperçu avant génération (jamais recalculés après coup).
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
  matricule: string;
  dateEmbauche: string;
  poste: string;
}

export interface DonneesCertificatTravail extends ChampsCommuns {
  nomPrenomsEmploye: string;
  sexe: 'M' | 'F';
  dateNaissance: string | null;
  lieuNaissance: string | null;
  matricule: string;
  dateEmbauche: string;
  dateSortie: string;
  dureeService: string;
  postesOccupes: PosteOccupe[];
}

export interface DonneesAttestationStage extends ChampsCommuns {
  nomPrenomsStagiaire: string;
  sexe: 'M' | 'F';
  dateNaissance: string | null;
  lieuNaissance: string | null;
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

export interface GenerationAttestation {
  employeId: string;
  type: TypeAttestation;
  donnees: DonneesAttestation;
}
