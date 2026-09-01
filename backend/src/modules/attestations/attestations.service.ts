import { PoolClient } from 'pg';
import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import {
  Attestation,
  AttestationAvecEmploye,
  DonneesAttestation,
  DonneesAttestationStage,
  DonneesAttestationTravail,
  DonneesCertificatTravail,
  GenerationAttestation,
  PosteOccupe,
  SaisieStagiaire,
  Stagiaire,
  TypeAttestation,
} from './attestations.types';

const PREFIXES: Record<TypeAttestation, string> = {
  att_trav: 'ATT-TRAV',
  cert_trav: 'CERT-TRAV',
  att_stage: 'ATT-STAGE',
};

export function numeroComplet(type: TypeAttestation, numero: number, filialeNom: string, annee: number): string {
  return `${PREFIXES[type]}_${String(numero).padStart(3, '0')}/${filialeNom}/${annee}`;
}

function mapAttestation(l: Record<string, unknown>, filialeNom: string): Attestation {
  const type = l.type as TypeAttestation;
  const numero = Number(l.numero);
  const annee = Number(l.annee);
  return {
    id: l.id as string,
    type,
    numero,
    numeroComplet: numeroComplet(type, numero, filialeNom, annee),
    filialeId: l.filiale_id as string,
    annee,
    employeId: l.employe_id as string,
    dateEmission: l.date_emission as string,
    emisPar: l.emis_par as string | null,
    donnees: l.donnees as DonneesAttestation,
  };
}

// --- Stagiaires (extension d'employes pour les contrats de type 'stage') ---
// Dates de stage et service d'affectation ne sont jamais stockés ici — réutilisés depuis le
// contrat 'stage' actif et employes.service_id, cf. schema.sql.

export async function obtenirStagiaire(employeId: string): Promise<Stagiaire | null> {
  const { rows } = await pool.query('SELECT * FROM stagiaires WHERE employe_id = $1', [employeId]);
  if (!rows[0]) return null;
  const l = rows[0];
  return {
    employeId: l.employe_id as string,
    filiereEtudes: l.filiere_etudes as string | null,
    etablissement: l.etablissement as string | null,
    superviseurId: l.superviseur_id as string | null,
  };
}

export async function enregistrerStagiaire(employeId: string, donnees: SaisieStagiaire): Promise<Stagiaire> {
  const { rows } = await pool.query(
    `INSERT INTO stagiaires (employe_id, filiere_etudes, etablissement, superviseur_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (employe_id) DO UPDATE SET
       filiere_etudes = EXCLUDED.filiere_etudes, etablissement = EXCLUDED.etablissement,
       superviseur_id = EXCLUDED.superviseur_id, updated_at = now()
     RETURNING *`,
    [employeId, donnees.filiereEtudes ?? null, donnees.etablissement ?? null, donnees.superviseurId ?? null]
  );
  const l = rows[0];
  return {
    employeId: l.employe_id as string,
    filiereEtudes: l.filiere_etudes as string | null,
    etablissement: l.etablissement as string | null,
    superviseurId: l.superviseur_id as string | null,
  };
}

// --- Durée lisible (ex. "2 ans 3 mois", "45 jours") — pour dureeService/dureeStage ---

function formaterDuree(debut: string, fin: string): string {
  const d = new Date(debut);
  const f = new Date(fin);
  let mois = (f.getFullYear() - d.getFullYear()) * 12 + (f.getMonth() - d.getMonth());
  if (f.getDate() < d.getDate()) mois -= 1;
  if (mois < 1) {
    const jours = Math.max(1, Math.round((f.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
    return `${jours} jour${jours > 1 ? 's' : ''}`;
  }
  const annees = Math.floor(mois / 12);
  const moisRestants = mois % 12;
  const parties = [];
  if (annees > 0) parties.push(`${annees} an${annees > 1 ? 's' : ''}`);
  if (moisRestants > 0) parties.push(`${moisRestants} mois`);
  return parties.join(' ') || '1 mois';
}

interface EmployePourAttestation {
  nom: string;
  prenoms: string;
  sexe: 'M' | 'F';
  dateNaissance: string | null;
  lieuNaissance: string | null;
  numCnib: string;
  dateEmbauche: string;
  dateSortie: string | null;
  statut: string;
  filialeId: string;
  filialeNom: string;
  chantierNom: string | null;
  serviceNom: string | null;
}

async function chargerEmploye(employeId: string): Promise<EmployePourAttestation> {
  const { rows } = await pool.query(
    `SELECT e.nom, e.prenoms, e.sexe, e.date_naissance, e.lieu_naissance, e.num_cnib, e.date_embauche,
            e.date_sortie, e.statut, e.filiale_id, f.nom AS filiale_nom, c.nom AS chantier_nom,
            s.nom AS service_nom
     FROM employes e
     JOIN filiales f ON f.id = e.filiale_id
     LEFT JOIN chantiers c ON c.id = e.chantier_id
     LEFT JOIN services s ON s.id = e.service_id
     WHERE e.id = $1`,
    [employeId]
  );
  if (!rows[0]) throw new ErreurApplicative(404, 'Employé introuvable');
  const l = rows[0];
  return {
    nom: l.nom,
    prenoms: l.prenoms,
    sexe: l.sexe,
    dateNaissance: l.date_naissance,
    lieuNaissance: l.lieu_naissance,
    numCnib: l.num_cnib,
    dateEmbauche: l.date_embauche,
    dateSortie: l.date_sortie,
    statut: l.statut,
    filialeId: l.filiale_id,
    filialeNom: l.filiale_nom,
    chantierNom: l.chantier_nom,
    serviceNom: l.service_nom,
  };
}

// Aperçu pré-rempli depuis la fiche employé/contrat — champs de jugement (dirigeant,
// signataire, motif de départ, appréciation, description des missions) volontairement laissés
// vides : à la charge du RH dans l'aperçu éditable avant génération (cf. décision produit,
// jamais de mention par défaut sur un motif de rupture ou une appréciation).
export async function preparerApercu(employeId: string, type: TypeAttestation): Promise<DonneesAttestation> {
  const employe = await chargerEmploye(employeId);
  const communs = {
    nomDirigeant: '',
    fonctionDirigeant: '',
    fonctionSignataire: '',
    entreprise: employe.filialeNom,
    dateEmission: new Date().toISOString().slice(0, 10),
  };

  if (type === 'att_trav') {
    const { rows } = await pool.query(
      `SELECT c.type, fo.intitule AS fonction_intitule
       FROM contrats c LEFT JOIN fonctions fo ON fo.id = c.fonction_id
       WHERE c.employe_id = $1 AND c.statut = 'actif' ORDER BY c.date_debut DESC LIMIT 1`,
      [employeId]
    );
    const contrat = rows[0];
    if (!contrat) throw new ErreurApplicative(409, 'Aucun contrat actif — impossible de préparer cette attestation');

    const donnees: DonneesAttestationTravail = {
      ...communs,
      nomPrenomsEmploye: `${employe.nom} ${employe.prenoms}`,
      sexe: employe.sexe,
      dateNaissance: employe.dateNaissance,
      lieuNaissance: employe.lieuNaissance,
      numeroPiece: employe.numCnib,
      dateEmbauche: employe.dateEmbauche,
      poste: contrat.fonction_intitule ?? '',
      typeContrat: String(contrat.type).toUpperCase(),
      filiale: employe.filialeNom,
      lieuAffectation: employe.chantierNom ?? 'Siège',
    };
    return donnees;
  }

  if (type === 'cert_trav') {
    const { rows: contratsRows } = await pool.query(
      `SELECT fo.intitule AS fonction_intitule, c.date_debut, c.date_fin
       FROM contrats c LEFT JOIN fonctions fo ON fo.id = c.fonction_id
       WHERE c.employe_id = $1 ORDER BY c.date_debut ASC`,
      [employeId]
    );
    const postesOccupes: PosteOccupe[] = contratsRows.map((r) => ({
      poste: r.fonction_intitule ?? '—',
      dateDebut: r.date_debut,
      dateFin: r.date_fin,
    }));
    const dateSortie = employe.dateSortie ?? new Date().toISOString().slice(0, 10);

    const donnees: DonneesCertificatTravail = {
      ...communs,
      nomPrenomsEmploye: `${employe.nom} ${employe.prenoms}`,
      sexe: employe.sexe,
      dateEmbauche: employe.dateEmbauche,
      dateSortie,
      dureeService: formaterDuree(employe.dateEmbauche, dateSortie),
      postesOccupes,
      motifDepart: '',
    };
    return donnees;
  }

  // att_stage
  const stagiaire = await obtenirStagiaire(employeId);
  const { rows: contratStageRows } = await pool.query(
    `SELECT date_debut, date_fin FROM contrats WHERE employe_id = $1 AND type = 'stage'
     ORDER BY date_debut DESC LIMIT 1`,
    [employeId]
  );
  const contratStage = contratStageRows[0];
  if (!contratStage) {
    throw new ErreurApplicative(409, 'Aucun contrat de stage trouvé pour cet employé');
  }

  let superviseurNom = '';
  if (stagiaire?.superviseurId) {
    const { rows: supRows } = await pool.query('SELECT nom, prenoms FROM employes WHERE id = $1', [
      stagiaire.superviseurId,
    ]);
    if (supRows[0]) superviseurNom = `${supRows[0].nom} ${supRows[0].prenoms}`;
  }

  const dateFinStage = contratStage.date_fin ?? new Date().toISOString().slice(0, 10);

  const donnees: DonneesAttestationStage = {
    ...communs,
    nomPrenomsStagiaire: `${employe.nom} ${employe.prenoms}`,
    sexe: employe.sexe,
    filiereEtudes: stagiaire?.filiereEtudes ?? '',
    etablissement: stagiaire?.etablissement ?? '',
    dateDebutStage: contratStage.date_debut,
    dateFinStage,
    dureeStage: formaterDuree(contratStage.date_debut, dateFinStage),
    service: employe.serviceNom ?? '',
    superviseur: superviseurNom,
    descriptionMissions: '',
    appreciation: '',
  };
  return donnees;
}

// Numéro atomique par (type, filiale, année) — UPSERT plutôt que MAX(numero)+1 pour éviter toute
// collision sous accès concurrent (cf. schema.sql, commentaire de compteurs_attestations).
async function prochainNumero(client: PoolClient, type: TypeAttestation, filialeId: string, annee: number): Promise<number> {
  const { rows } = await client.query(
    `INSERT INTO compteurs_attestations (type, filiale_id, annee, dernier_numero)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (type, filiale_id, annee) DO UPDATE SET dernier_numero = compteurs_attestations.dernier_numero + 1
     RETURNING dernier_numero`,
    [type, filialeId, annee]
  );
  return Number(rows[0].dernier_numero);
}

// Fige le document : numéro officiel attribué, `donnees` enregistrées telles qu'éditées dans
// l'aperçu — non modifiable ensuite (pas de fonction de mise à jour dans ce module, cf. décision
// produit, même principe d'intégrité que les bulletins de paie déjà générés).
export async function genererAttestation(saisie: GenerationAttestation, utilisateurId: string): Promise<Attestation> {
  const employe = await chargerEmploye(saisie.employeId);
  const annee = new Date().getFullYear();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const numero = await prochainNumero(client, saisie.type, employe.filialeId, annee);

    const { rows } = await client.query(
      `INSERT INTO attestations (type, numero, filiale_id, annee, employe_id, emis_par, donnees)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [saisie.type, numero, employe.filialeId, annee, saisie.employeId, utilisateurId, JSON.stringify(saisie.donnees)]
    );

    await client.query('COMMIT');
    return mapAttestation(rows[0], employe.filialeNom);
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
}

export async function listerAttestations(
  filialesAutorisees: string[] | null,
  employeId?: string
): Promise<AttestationAvecEmploye[]> {
  const conditions: string[] = [];
  const valeurs: unknown[] = [];

  if (employeId) {
    valeurs.push(employeId);
    conditions.push(`a.employe_id = $${valeurs.length}`);
  }
  if (filialesAutorisees !== null) {
    valeurs.push(filialesAutorisees);
    conditions.push(`a.filiale_id = ANY($${valeurs.length})`);
  }
  const clauseWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT a.*, f.nom AS filiale_nom, e.nom AS employe_nom, e.prenoms AS employe_prenoms, e.matricule AS employe_matricule
     FROM attestations a
     JOIN filiales f ON f.id = a.filiale_id
     JOIN employes e ON e.id = a.employe_id
     ${clauseWhere}
     ORDER BY a.created_at DESC`,
    valeurs
  );

  return rows.map((l) => ({
    ...mapAttestation(l, l.filiale_nom as string),
    employeNom: l.employe_nom as string,
    employePrenoms: l.employe_prenoms as string,
    employeMatricule: l.employe_matricule as string,
  }));
}

export async function obtenirAttestation(id: string): Promise<Attestation & { filialeNom: string }> {
  const { rows } = await pool.query(
    `SELECT a.*, f.nom AS filiale_nom FROM attestations a JOIN filiales f ON f.id = a.filiale_id WHERE a.id = $1`,
    [id]
  );
  if (!rows[0]) throw new ErreurApplicative(404, 'Attestation introuvable');
  return { ...mapAttestation(rows[0], rows[0].filiale_nom as string), filialeNom: rows[0].filiale_nom as string };
}
