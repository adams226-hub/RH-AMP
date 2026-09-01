import { DocumentArchive } from '../types/archivage';
import { ResultatAudit } from '../types/audit';
import {
  MasseSalarialeReponse,
  PyramideAgesReponse,
  SortiesReponse,
  TurnoverReponse,
} from '../types/tableauDeBord';
import { FiltresRHOverview, RHOverviewReponse } from '../types/rhOverview';
import { DemandeConge, DemandeCongeAvecEmploye, SoldeConge } from '../types/conges';
import {
  ClassificationAbsence,
  DemandeAbsence,
  DemandeAbsenceAvecEmploye,
  EvenementBareme,
  SoldePermissionExceptionnelle,
  TypeDemandeAbsence,
} from '../types/absences';
import { Mission, MissionAvecEmploye } from '../types/missions';
import { ElementVariable, TypeElementSaisissable } from '../types/elementsVariables';
import { Contrat, ContratAvecEmploye } from '../types/contrats';
import { Employe } from '../types/employe';
import { BulletinPaie, ResultatCalculMasse, ResultatSimulationNetVersBrut } from '../types/paie';
import { AnomalieAbsence, Chantier, CodeAbsencePointage, PointageMensuel, PointageMensuelAvecDetails } from '../types/pointage';
import { Departement, Filiale, Fonction, ServiceOrg } from '../types/postes';
import { CreationUtilisateur, Utilisateur } from '../types/utilisateurs';
import { ParametrePaie } from '../types/parametresPaie';
import { CreationJourFerie, JourFerie } from '../types/joursFeries';
import { CyclePaie, ResumeCyclePaie } from '../types/cyclesPaie';
import { CategorieProfessionnelle } from '../types/categoriesProfessionnelles';
import { Attestation, AttestationAvecEmploye, DonneesAttestation, Stagiaire, TypeAttestation } from '../types/attestations';
import { CodeRole } from '../context/AuthContext';

const URL_API = import.meta.env.VITE_API_URL;

interface ComposantesRemuneration {
  sursalaire?: number;
  indemniteLogement?: number;
  indemniteTransport?: number;
  indemniteFonction?: number;
  indemniteSujetion?: number;
  indemniteAstreinte?: number;
}

export class ErreurApi extends Error {
  constructor(
    public statut: number,
    message: string
  ) {
    super(message);
  }
}

async function requete<T>(chemin: string, options: RequestInit = {}, jeton?: string | null): Promise<T> {
  const reponse = await fetch(`${URL_API}${chemin}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
      ...options.headers,
    },
  });

  if (!reponse.ok) {
    const corps = await reponse.json().catch(() => ({ erreur: reponse.statusText }));
    throw new ErreurApi(reponse.status, corps.erreur ?? 'Erreur inconnue');
  }

  if (reponse.status === 204) return undefined as T;
  return reponse.json();
}

async function requeteFichier<T>(chemin: string, corps: FormData, jeton: string): Promise<T> {
  const reponse = await fetch(`${URL_API}${chemin}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jeton}` },
    body: corps,
  });

  if (!reponse.ok) {
    const erreur = await reponse.json().catch(() => ({ erreur: reponse.statusText }));
    throw new ErreurApi(reponse.status, erreur.erreur ?? 'Erreur inconnue');
  }

  return reponse.json();
}

async function requeteBlob(chemin: string, jeton: string): Promise<Blob> {
  const reponse = await fetch(`${URL_API}${chemin}`, {
    headers: { Authorization: `Bearer ${jeton}` },
  });

  if (!reponse.ok) {
    const erreur = await reponse.json().catch(() => ({ erreur: reponse.statusText }));
    throw new ErreurApi(reponse.status, erreur.erreur ?? 'Erreur inconnue');
  }

  return reponse.blob();
}

export const api = {
  connexion: (email: string, motDePasse: string) =>
    requete<{ jeton: string }>('/api/auth/connexion', {
      method: 'POST',
      body: JSON.stringify({ email, motDePasse }),
    }),

  // Employés
  listerEmployes: (jeton: string) => requete<Employe[]>('/api/employes', {}, jeton),
  rechercherEmployes: (jeton: string, recherche: string, limite = 20) =>
    requete<Employe[]>(`/api/employes?recherche=${encodeURIComponent(recherche)}&limite=${limite}`, {}, jeton),
  obtenirEmploye: (jeton: string, id: string) => requete<Employe>(`/api/employes/${id}`, {}, jeton),
  creerEmploye: (
    jeton: string,
    donnees: {
      matricule: string;
      nom: string;
      prenoms: string;
      dateNaissance: string;
      sexe: 'M' | 'F';
      nationalite: string;
      telephone: string;
      numCnib: string;
      numCnss: string;
      rib?: string;
      banque?: string;
      modePaiement?: string;
      personnesACharge?: number;
      filialeId: string;
      chantierId?: string;
      dateEmbauche: string;
      categorieProfessionnelle?: string;
    }
  ) => requete<Employe>('/api/employes', { method: 'POST', body: JSON.stringify(donnees) }, jeton),
  changerStatutEmploye: (jeton: string, id: string, statut: Employe['statut']) =>
    requete<Employe>(`/api/employes/${id}/statut`, { method: 'POST', body: JSON.stringify({ statut }) }, jeton),
  affecterChantierEmploye: (jeton: string, id: string, chantierId: string | null) =>
    requete<Employe>(`/api/employes/${id}/chantier`, { method: 'POST', body: JSON.stringify({ chantierId }) }, jeton),

  // Postes
  listerFiliales: (jeton: string, visiblesUniquement = false) =>
    requete<Filiale[]>(`/api/postes/filiales${visiblesUniquement ? '?visiblesUniquement=true' : ''}`, {}, jeton),
  creerFiliale: (jeton: string, donnees: { nom: string; ville?: string; pays?: string }) =>
    requete<Filiale>('/api/postes/filiales', { method: 'POST', body: JSON.stringify(donnees) }, jeton),
  renommerFiliale: (jeton: string, id: string, nom: string) =>
    requete<Filiale>(`/api/postes/filiales/${id}`, { method: 'PATCH', body: JSON.stringify({ nom }) }, jeton),
  archiverFiliale: (jeton: string, id: string, actif: boolean) =>
    requete<Filiale>(`/api/postes/filiales/${id}/statut`, { method: 'POST', body: JSON.stringify({ actif }) }, jeton),
  modifierCoordonneesFiliale: (
    jeton: string,
    id: string,
    donnees: { adresse?: string; rccm?: string; ifu?: string; telephone?: string; siteWeb?: string; couleurAccent?: string }
  ) => requete<Filiale>(`/api/postes/filiales/${id}/coordonnees`, { method: 'PATCH', body: JSON.stringify(donnees) }, jeton),
  uploaderLogoFiliale: (jeton: string, id: string, fichier: File) => {
    const forme = new FormData();
    forme.append('logo', fichier);
    return requeteFichier<Filiale>(`/api/postes/filiales/${id}/logo`, forme, jeton);
  },
  listerDepartements: (jeton: string, visiblesUniquement = false) =>
    requete<Departement[]>(`/api/postes/departements${visiblesUniquement ? '?visiblesUniquement=true' : ''}`, {}, jeton),
  creerDepartement: (jeton: string, donnees: { filialeId: string; nom: string }) =>
    requete<Departement>('/api/postes/departements', { method: 'POST', body: JSON.stringify(donnees) }, jeton),
  renommerDepartement: (jeton: string, id: string, nom: string) =>
    requete<Departement>(`/api/postes/departements/${id}`, { method: 'PATCH', body: JSON.stringify({ nom }) }, jeton),
  archiverDepartement: (jeton: string, id: string, actif: boolean) =>
    requete<Departement>(`/api/postes/departements/${id}/statut`, { method: 'POST', body: JSON.stringify({ actif }) }, jeton),
  listerServices: (jeton: string, visiblesUniquement = false) =>
    requete<ServiceOrg[]>(`/api/postes/services${visiblesUniquement ? '?visiblesUniquement=true' : ''}`, {}, jeton),
  creerService: (jeton: string, donnees: { departementId: string; nom: string }) =>
    requete<ServiceOrg>('/api/postes/services', { method: 'POST', body: JSON.stringify(donnees) }, jeton),
  renommerService: (jeton: string, id: string, nom: string) =>
    requete<ServiceOrg>(`/api/postes/services/${id}`, { method: 'PATCH', body: JSON.stringify({ nom }) }, jeton),
  archiverService: (jeton: string, id: string, actif: boolean) =>
    requete<ServiceOrg>(`/api/postes/services/${id}/statut`, { method: 'POST', body: JSON.stringify({ actif }) }, jeton),
  listerFonctions: (jeton: string, visiblesUniquement = false) =>
    requete<Fonction[]>(`/api/postes/fonctions${visiblesUniquement ? '?visiblesUniquement=true' : ''}`, {}, jeton),
  creerFonction: (jeton: string, donnees: { intitule: string; description?: string }) =>
    requete<Fonction>('/api/postes/fonctions', { method: 'POST', body: JSON.stringify(donnees) }, jeton),
  renommerFonction: (jeton: string, id: string, intitule: string) =>
    requete<Fonction>(`/api/postes/fonctions/${id}`, { method: 'PATCH', body: JSON.stringify({ intitule }) }, jeton),
  archiverFonction: (jeton: string, id: string, actif: boolean) =>
    requete<Fonction>(`/api/postes/fonctions/${id}/statut`, { method: 'POST', body: JSON.stringify({ actif }) }, jeton),

  // Contrats
  listerContrats: (jeton: string, employeId: string) =>
    requete<Contrat[]>(`/api/contrats?employeId=${employeId}`, {}, jeton),
  listerTousContrats: (jeton: string) => requete<ContratAvecEmploye[]>('/api/contrats', {}, jeton),
  listerContratsExpirations: (jeton: string, jours = 90) =>
    requete<Contrat[]>(`/api/contrats/expirations?jours=${jours}`, {}, jeton),
  creerContrat: (
    jeton: string,
    donnees: {
      employeId: string;
      type: string;
      dateDebut: string;
      dateFin?: string;
      salaireBase: number;
    } & ComposantesRemuneration
  ) => requete<Contrat>('/api/contrats', { method: 'POST', body: JSON.stringify(donnees) }, jeton),
  activerContrat: (jeton: string, id: string) =>
    requete<Contrat>(`/api/contrats/${id}/activer`, { method: 'POST' }, jeton),
  renouvelerContrat: (
    jeton: string,
    id: string,
    donnees: { dateDebut: string; dateFin?: string; salaireBase: number } & ComposantesRemuneration
  ) => requete<Contrat>(`/api/contrats/${id}/renouveler`, { method: 'POST', body: JSON.stringify(donnees) }, jeton),
  romprecontrat: (jeton: string, id: string, donnees: { dateRupture: string; motifRupture: string }) =>
    requete<Contrat>(`/api/contrats/${id}/rompre`, { method: 'POST', body: JSON.stringify(donnees) }, jeton),

  // Congés
  obtenirSolde: (jeton: string, employeId: string, annee: number) =>
    requete<SoldeConge>(`/api/conges/solde?employeId=${employeId}&annee=${annee}`, {}, jeton),
  listerDemandesConges: (jeton: string, employeId: string) =>
    requete<DemandeConge[]>(`/api/conges/demandes?employeId=${employeId}`, {}, jeton),
  listerToutesDemandesConges: (jeton: string) => requete<DemandeCongeAvecEmploye[]>('/api/conges/demandes', {}, jeton),
  creerDemandeConge: (
    jeton: string,
    donnees: { employeId: string; dateDebut: string; dateFin: string; motif?: string }
  ) => requete<DemandeConge>('/api/conges/demandes', { method: 'POST', body: JSON.stringify(donnees) }, jeton),
  donnerAvisConge: (jeton: string, id: string, avis: 'favorable' | 'defavorable') =>
    requete<DemandeConge>(`/api/conges/demandes/${id}/avis`, { method: 'POST', body: JSON.stringify({ avis }) }, jeton),
  deciderConge: (jeton: string, id: string, decision: 'validee' | 'rejetee') =>
    requete<DemandeConge>(`/api/conges/demandes/${id}/decision`, { method: 'POST', body: JSON.stringify({ decision }) }, jeton),

  // Absences (permissions exceptionnelles / absences hors barème)
  obtenirBaremePermissions: (jeton: string) => requete<EvenementBareme[]>('/api/absences/bareme', {}, jeton),
  obtenirSoldePermission: (jeton: string, employeId: string, annee: number) =>
    requete<SoldePermissionExceptionnelle>(
      `/api/absences/solde-permission?employeId=${employeId}&annee=${annee}`,
      {},
      jeton
    ),
  listerDemandesAbsences: (jeton: string, employeId: string) =>
    requete<DemandeAbsence[]>(`/api/absences/demandes?employeId=${employeId}`, {}, jeton),
  listerToutesDemandesAbsences: (jeton: string) =>
    requete<DemandeAbsenceAvecEmploye[]>('/api/absences/demandes', {}, jeton),
  creerDemandeAbsence: (
    jeton: string,
    donnees: {
      employeId: string;
      type: TypeDemandeAbsence;
      motifBareme?: string;
      motif: string;
      dateDebut: string;
      dateFin: string;
      justificatifFourni?: boolean;
    }
  ) => requete<DemandeAbsence>('/api/absences/demandes', { method: 'POST', body: JSON.stringify(donnees) }, jeton),
  donnerAvisAbsence: (jeton: string, id: string, avis: 'favorable' | 'defavorable') =>
    requete<DemandeAbsence>(`/api/absences/demandes/${id}/avis`, { method: 'POST', body: JSON.stringify({ avis }) }, jeton),
  deciderAbsence: (
    jeton: string,
    id: string,
    decision: 'validee' | 'rejetee',
    classification?: ClassificationAbsence
  ) =>
    requete<DemandeAbsence>(
      `/api/absences/demandes/${id}/decision`,
      { method: 'POST', body: JSON.stringify({ decision, classification }) },
      jeton
    ),
  obtenirFicheAbsencePdf: (jeton: string, id: string) => requeteBlob(`/api/absences/demandes/${id}/fiche`, jeton),

  // Missions (outil de suivi départ/retour, statut calculé)
  listerMissions: (jeton: string) => requete<MissionAvecEmploye[]>('/api/missions', {}, jeton),
  creerMission: (
    jeton: string,
    donnees: { employeId: string; destination: string; motif: string; dateDepart: string; dateRetourPrevue: string }
  ) => requete<Mission>('/api/missions', { method: 'POST', body: JSON.stringify(donnees) }, jeton),
  enregistrerRetourMission: (jeton: string, id: string, dateRetourReelle: string) =>
    requete<Mission>(`/api/missions/${id}/retour`, { method: 'POST', body: JSON.stringify({ dateRetourReelle }) }, jeton),

  // Pointage
  listerChantiers: (jeton: string, inclureArchives = false) =>
    requete<Chantier[]>(`/api/pointage/chantiers${inclureArchives ? '?inclureArchives=true' : ''}`, {}, jeton),
  creerChantier: (jeton: string, donnees: { filialeId: string; nom: string; localisation?: string }) =>
    requete<Chantier>('/api/pointage/chantiers', { method: 'POST', body: JSON.stringify(donnees) }, jeton),
  renommerChantier: (jeton: string, id: string, nom: string) =>
    requete<Chantier>(`/api/pointage/chantiers/${id}`, { method: 'PATCH', body: JSON.stringify({ nom }) }, jeton),
  archiverChantier: (jeton: string, id: string, actif: boolean) =>
    requete<Chantier>(`/api/pointage/chantiers/${id}/statut`, { method: 'POST', body: JSON.stringify({ actif }) }, jeton),
  listerFichesPointage: (jeton: string, statut?: string, moisPaie?: string) => {
    const params = new URLSearchParams();
    if (statut) params.set('statut', statut);
    if (moisPaie) params.set('moisPaie', moisPaie);
    return requete<PointageMensuelAvecDetails[]>(`/api/pointage/fiches?${params}`, {}, jeton);
  },
  obtenirFichePointageEmploye: (jeton: string, employeId: string, moisPaie: string) =>
    requete<(PointageMensuel & { jours: { date: string; heures: number | null; codeAbsence: CodeAbsencePointage | null }[] }) | null>(
      `/api/pointage/fiches/employe?employeId=${employeId}&moisPaie=${moisPaie}`,
      {},
      jeton
    ),
  // Heures sup 15/35/60%, jours panier et compteurs d'absence ne se saisissent plus ici — ils
  // sont recalculés automatiquement côté serveur depuis `jours` (grille journalière).
  enregistrerFichePointage: (
    jeton: string,
    donnees: {
      employeId: string;
      chantierId: string;
      periodeDebut: string;
      periodeFin: string;
      jours?: { date: string; heures?: number; codeAbsence?: CodeAbsencePointage }[];
    }
  ) => requete<PointageMensuel>('/api/pointage/fiches', { method: 'POST', body: JSON.stringify(donnees) }, jeton),
  soumettreFichePointage: (jeton: string, id: string) =>
    requete<PointageMensuel>(`/api/pointage/fiches/${id}/soumettre`, { method: 'POST' }, jeton),
  obtenirAnomaliesPointage: (jeton: string, id: string) =>
    requete<AnomalieAbsence[]>(`/api/pointage/fiches/${id}/anomalies`, {}, jeton),
  validerFichePointage: (jeton: string, id: string) =>
    requete<PointageMensuel>(`/api/pointage/fiches/${id}/valider`, { method: 'POST' }, jeton),
  rejeterFichePointage: (jeton: string, id: string, commentaire: string) =>
    requete<PointageMensuel>(
      `/api/pointage/fiches/${id}/rejeter`,
      { method: 'POST', body: JSON.stringify({ commentaire }) },
      jeton
    ),
  obtenirFichePointagePdf: (jeton: string, id: string) => requeteBlob(`/api/pointage/fiches/${id}/pdf`, jeton),

  // Paie
  listerBulletins: (jeton: string, employeId: string) =>
    requete<BulletinPaie[]>(`/api/paie/bulletins?employeId=${employeId}`, {}, jeton),
  calculerBulletin: (jeton: string, donnees: { employeId: string; periode: string }) =>
    requete<BulletinPaie>('/api/paie/bulletins/calculer', { method: 'POST', body: JSON.stringify(donnees) }, jeton),
  calculerMasseSalariale: (jeton: string, filialeId: string, periode: string) =>
    requete<ResultatCalculMasse>(
      '/api/paie/bulletins/calculer-masse',
      { method: 'POST', body: JSON.stringify({ filialeId, periode }) },
      jeton
    ),
  obtenirBulletinPdf: (jeton: string, id: string) => requeteBlob(`/api/paie/bulletins/${id}/fiche`, jeton),
  simulerNetVersBrut: (
    jeton: string,
    donnees: {
      netCible: number;
      categorie: 'CADRE' | 'NON_CADRE';
      personnesACharge?: number;
      ancienneteAnnees?: number;
      salaireDeBase?: number;
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
      champVariable?: 'salaireDeBase' | 'sursalaire';
    }
  ) =>
    requete<ResultatSimulationNetVersBrut>(
      '/api/paie/simuler-net-vers-brut',
      { method: 'POST', body: JSON.stringify(donnees) },
      jeton
    ),

  // Éléments du mois (saisie préalable au calcul — prime/avance/panier/reliquat/absence)
  listerElementsVariablesEmploye: (jeton: string, employeId: string, periode: string) =>
    requete<ElementVariable[]>(`/api/elements-variables?employeId=${employeId}&periode=${periode}`, {}, jeton),
  enregistrerElementVariable: (
    jeton: string,
    donnees: { employeId: string; periode: string; type: TypeElementSaisissable; montant?: number; jours?: number }
  ) => requete<ElementVariable>('/api/elements-variables', { method: 'POST', body: JSON.stringify(donnees) }, jeton),
  supprimerElementVariable: (jeton: string, id: string) =>
    requete<void>(`/api/elements-variables/${id}`, { method: 'DELETE' }, jeton),

  // Cycles de paie mensuels (ADDENDUM_JOURNAL_PAIE_AMP.md) — un cycle par (mois, filiale)
  listerCyclesPaie: (jeton: string, periode?: string) =>
    requete<CyclePaie[]>(`/api/cycles-paie${periode ? `?periode=${periode}` : ''}`, {}, jeton),
  obtenirResumeCyclePaie: (jeton: string, filialeId: string, periode: string) =>
    requete<ResumeCyclePaie>(`/api/cycles-paie/resume?filialeId=${filialeId}&periode=${periode}`, {}, jeton),
  lancerCalculCyclePaie: (jeton: string, filialeId: string, periode: string) =>
    requete<ResumeCyclePaie>(
      '/api/cycles-paie/calculer',
      { method: 'POST', body: JSON.stringify({ filialeId, periode }) },
      jeton
    ),
  marquerCyclePaieVerifie: (jeton: string, filialeId: string, periode: string) =>
    requete<CyclePaie>(
      '/api/cycles-paie/verifier',
      { method: 'POST', body: JSON.stringify({ filialeId, periode }) },
      jeton
    ),
  cloturerCyclePaie: (jeton: string, filialeId: string, periode: string) =>
    requete<CyclePaie>(
      '/api/cycles-paie/cloturer',
      { method: 'POST', body: JSON.stringify({ filialeId, periode }) },
      jeton
    ),
  reouvrirCyclePaie: (jeton: string, filialeId: string, periode: string) =>
    requete<CyclePaie>(
      '/api/cycles-paie/reouvrir',
      { method: 'POST', body: JSON.stringify({ filialeId, periode }) },
      jeton
    ),
  telechargerJournalPaie: (jeton: string, filialeId: string, periode: string, groupePar?: 'mode_paiement') =>
    requeteBlob(
      `/api/cycles-paie/journal?filialeId=${filialeId}&periode=${periode}${groupePar ? `&groupePar=${groupePar}` : ''}`,
      jeton
    ),

  // Catégories professionnelles (référentiel, gère l'abattement IUTS via estCadre)
  listerCategoriesProfessionnelles: (jeton: string, visiblesUniquement = false) =>
    requete<CategorieProfessionnelle[]>(
      `/api/categories-professionnelles${visiblesUniquement ? '?visiblesUniquement=true' : ''}`,
      {},
      jeton
    ),
  creerCategorieProfessionnelle: (jeton: string, donnees: { libelle: string; estCadre: boolean }) =>
    requete<CategorieProfessionnelle>(
      '/api/categories-professionnelles',
      { method: 'POST', body: JSON.stringify(donnees) },
      jeton
    ),
  modifierCategorieProfessionnelle: (jeton: string, id: string, donnees: { libelle: string; estCadre: boolean }) =>
    requete<CategorieProfessionnelle>(
      `/api/categories-professionnelles/${id}`,
      { method: 'PATCH', body: JSON.stringify(donnees) },
      jeton
    ),
  archiverCategorieProfessionnelle: (jeton: string, id: string, actif: boolean) =>
    requete<CategorieProfessionnelle>(
      `/api/categories-professionnelles/${id}/statut`,
      { method: 'POST', body: JSON.stringify({ actif }) },
      jeton
    ),

  // Archivage
  listerDocuments: (jeton: string, employeId?: string, categorie?: string, recherche?: string) => {
    const query = new URLSearchParams();
    if (employeId) query.set('employeId', employeId);
    if (categorie) query.set('categorie', categorie);
    if (recherche) query.set('recherche', recherche);
    const qs = query.toString();
    return requete<DocumentArchive[]>(`/api/archivage/documents${qs ? `?${qs}` : ''}`, {}, jeton);
  },
  deposerDocument: (jeton: string, fichier: File, categorie: string, employeId?: string) => {
    const forme = new FormData();
    forme.append('fichier', fichier);
    forme.append('categorie', categorie);
    if (employeId) forme.append('employeId', employeId);
    return requeteFichier<DocumentArchive>('/api/archivage/documents', forme, jeton);
  },
  telechargerDocument: (jeton: string, id: string) =>
    requete<{ url: string }>(`/api/archivage/documents/${id}/telecharger`, {}, jeton),
  supprimerDocument: (jeton: string, id: string) =>
    requete<void>(`/api/archivage/documents/${id}`, { method: 'DELETE' }, jeton),

  // Tableaux de bord
  obtenirEffectif: (jeton: string) => requete<{ parStatut: { statut: string; total: number }[]; parFiliale: { filiale: string; total: number }[] }>(
    '/api/tableaux-de-bord/effectif',
    {},
    jeton
  ),
  obtenirContratsDashboard: (jeton: string) =>
    requete<{ parType: { type: string; total: number }[]; expirantSous90Jours: number }>(
      '/api/tableaux-de-bord/contrats',
      {},
      jeton
    ),
  obtenirCongesDashboard: (jeton: string) =>
    requete<{ congesEnCours: number; soldeMoyenDisponible: number }>('/api/tableaux-de-bord/conges', {}, jeton),
  obtenirMasseSalariale: (jeton: string, periode: string) =>
    requete<{ total_brut: number; total_net: number; total_cout_employeur: number; nb_bulletins: number }>(
      `/api/tableaux-de-bord/masse-salariale?periode=${periode}`,
      {},
      jeton
    ),
  obtenirMasseSalarialeParPeriode: (jeton: string, periodeDebut: string, periodeFin: string) =>
    requete<MasseSalarialeReponse>(
      `/api/tableaux-de-bord/masse-salariale-periode?periodeDebut=${periodeDebut}&periodeFin=${periodeFin}`,
      {},
      jeton
    ),
  obtenirSorties: (jeton: string, dateDebut: string, dateFin: string) =>
    requete<SortiesReponse>(`/api/tableaux-de-bord/sorties?dateDebut=${dateDebut}&dateFin=${dateFin}`, {}, jeton),
  obtenirPyramideAges: (jeton: string) => requete<PyramideAgesReponse>('/api/tableaux-de-bord/pyramide-ages', {}, jeton),
  obtenirTurnover: (jeton: string, dateDebut: string, dateFin: string) =>
    requete<TurnoverReponse>(`/api/tableaux-de-bord/turnover?dateDebut=${dateDebut}&dateFin=${dateFin}`, {}, jeton),
  obtenirApercuRH: (jeton: string, filtres: FiltresRHOverview) => {
    const query = new URLSearchParams();
    filtres.filialeId.forEach((v) => query.append('filialeId', v));
    filtres.categorieProfessionnelle.forEach((v) => query.append('categorieProfessionnelle', v));
    filtres.sexe.forEach((v) => query.append('sexe', v));
    filtres.typeContrat.forEach((v) => query.append('typeContrat', v));
    return requete<RHOverviewReponse>(`/api/tableaux-de-bord/rh-overview?${query.toString()}`, {}, jeton);
  },

  // Audit
  listerJournalAudit: (jeton: string, params: { page: number; parPage: number; module?: string; action?: string }) => {
    const query = new URLSearchParams({ page: String(params.page), parPage: String(params.parPage) });
    if (params.module) query.set('module', params.module);
    if (params.action) query.set('action', params.action);
    return requete<ResultatAudit>(`/api/audit/journal?${query.toString()}`, {}, jeton);
  },

  // Utilisateurs
  listerUtilisateurs: (jeton: string) => requete<Utilisateur[]>('/api/utilisateurs', {}, jeton),
  creerUtilisateur: (jeton: string, donnees: CreationUtilisateur) =>
    requete<{ utilisateur: Utilisateur; motDePasseTemporaire: string }>(
      '/api/utilisateurs',
      { method: 'POST', body: JSON.stringify(donnees) },
      jeton
    ),
  changerRoleUtilisateur: (jeton: string, id: string, role: CodeRole) =>
    requete<Utilisateur>(`/api/utilisateurs/${id}/role`, { method: 'POST', body: JSON.stringify({ role }) }, jeton),
  changerStatutUtilisateur: (jeton: string, id: string, statut: Utilisateur['statut']) =>
    requete<Utilisateur>(`/api/utilisateurs/${id}/statut`, { method: 'POST', body: JSON.stringify({ statut }) }, jeton),
  reinitialiserMotDePasse: (jeton: string, id: string) =>
    requete<{ motDePasseTemporaire: string }>(`/api/utilisateurs/${id}/reinitialiser-mot-de-passe`, { method: 'POST' }, jeton),
  majPerimetreUtilisateur: (jeton: string, id: string, donnees: { filialeIds?: string[]; chantierIds?: string[] }) =>
    requete<Utilisateur>(`/api/utilisateurs/${id}/perimetre`, { method: 'PATCH', body: JSON.stringify(donnees) }, jeton),

  // Paramètres de paie
  listerParametresPaie: (jeton: string) => requete<ParametrePaie[]>('/api/parametres-paie', {}, jeton),
  definirParametrePaie: (jeton: string, cle: string, valeur: number) =>
    requete<ParametrePaie>(`/api/parametres-paie/${cle}`, { method: 'PUT', body: JSON.stringify({ valeur }) }, jeton),

  // Jours fériés
  listerJoursFeries: (jeton: string, annee?: number) =>
    requete<JourFerie[]>(`/api/jours-feries${annee ? `?annee=${annee}` : ''}`, {}, jeton),
  creerJourFerie: (jeton: string, donnees: CreationJourFerie) =>
    requete<JourFerie>('/api/jours-feries', { method: 'POST', body: JSON.stringify(donnees) }, jeton),
  supprimerJourFerie: (jeton: string, id: string) =>
    requete<void>(`/api/jours-feries/${id}`, { method: 'DELETE' }, jeton),

  // Attestations
  listerAttestations: (jeton: string, employeId?: string) =>
    requete<AttestationAvecEmploye[]>(`/api/attestations${employeId ? `?employeId=${employeId}` : ''}`, {}, jeton),
  apercuAttestation: (jeton: string, employeId: string, type: TypeAttestation) =>
    requete<DonneesAttestation>(`/api/attestations/apercu?employeId=${employeId}&type=${type}`, {}, jeton),
  genererAttestation: (jeton: string, donnees: { employeId: string; type: TypeAttestation; donnees: DonneesAttestation }) =>
    requete<Attestation>('/api/attestations', { method: 'POST', body: JSON.stringify(donnees) }, jeton),
  obtenirAttestationPdf: (jeton: string, id: string) => requeteBlob(`/api/attestations/${id}/pdf`, jeton),
  obtenirStagiaire: (jeton: string, employeId: string) =>
    requete<Stagiaire | null>(`/api/attestations/stagiaires/${employeId}`, {}, jeton),
  enregistrerStagiaire: (
    jeton: string,
    employeId: string,
    donnees: { filiereEtudes?: string; etablissement?: string; superviseurId?: string }
  ) => requete<Stagiaire>(`/api/attestations/stagiaires/${employeId}`, { method: 'POST', body: JSON.stringify(donnees) }, jeton),
};
