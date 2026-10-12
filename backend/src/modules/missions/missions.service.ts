import { PoolClient } from 'pg';
import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { obtenirValeurParametre } from '../parametresPaie/parametresPaie.service';
import {
  CategorieTarifHebergement,
  CreationMaisonHote,
  CreationMission,
  CreationSejourMaisonHote,
  MaisonHote,
  Mission,
  MissionAvecEmploye,
  ModificationMaisonHote,
  SejourMaisonHote,
  SejourMaisonHoteAvecDetails,
  StatutMission,
} from './missions.types';

function dateDuJour(): string {
  return new Date().toISOString().slice(0, 10);
}

// Le statut n'est jamais stocké : il est déduit des 3 dates à chaque lecture.
function calculerStatut(dateDepart: string, dateRetourPrevue: string, dateRetourReelle: string | null): StatutMission {
  if (dateRetourReelle !== null) return 'terminee';

  const aujourdhui = dateDuJour();
  if (aujourdhui < dateDepart) return 'a_venir';
  if (aujourdhui <= dateRetourPrevue) return 'en_cours';
  return 'en_retard';
}

function mapMission(l: Record<string, unknown>): Mission {
  const dateDepart = l.date_depart as string;
  const dateRetourPrevue = l.date_retour_prevue as string;
  const dateRetourReelle = (l.date_retour_reelle as string | null) ?? null;

  return {
    id: l.id as string,
    employeId: l.employe_id as string,
    numeroOrdreMission: (l.numero_ordre_mission as string | null) ?? null,
    destination: l.destination as string,
    motif: l.motif as string,
    dateDepart,
    dateRetourPrevue,
    dateRetourReelle,
    montantHebergement: Number(l.montant_hebergement),
    montantRestauration: Number(l.montant_restauration),
    statut: calculerStatut(dateDepart, dateRetourPrevue, dateRetourReelle),
  };
}

// chantiersAutorisees couvre le Responsable RH Chantier, jamais rattaché à une filiale (cf.
// employes.service.ts / middleware/autorisation.ts pour le même raisonnement).
export async function listerMissions(
  filialesAutorisees: string[] | null,
  chantiersAutorisees: string[] | null = null
): Promise<MissionAvecEmploye[]> {
  const conditions: string[] = [];
  const valeurs: unknown[] = [];

  if (filialesAutorisees !== null) {
    valeurs.push(filialesAutorisees);
    const iFiliales = valeurs.length;
    valeurs.push(chantiersAutorisees ?? []);
    const iChantiers = valeurs.length;
    conditions.push(`(e.filiale_id = ANY($${iFiliales}) OR e.chantier_id = ANY($${iChantiers}))`);
  }

  const clauseWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT m.*, e.nom AS employe_nom, e.prenoms AS employe_prenoms, e.matricule AS employe_matricule, e.filiale_id
     FROM missions m
     JOIN employes e ON e.id = m.employe_id
     ${clauseWhere}
     ORDER BY m.date_depart DESC`,
    valeurs
  );

  return rows.map((l) => ({
    ...mapMission(l),
    employeNom: l.employe_nom as string,
    employePrenoms: l.employe_prenoms as string,
    employeMatricule: l.employe_matricule as string,
    filialeId: l.filiale_id as string,
  }));
}

export async function creerMission(donnees: CreationMission): Promise<Mission> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO missions (
         employe_id, numero_ordre_mission, destination, motif, date_depart, date_retour_prevue,
         montant_hebergement, montant_restauration
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        donnees.employeId,
        donnees.numeroOrdreMission,
        donnees.destination,
        donnees.motif,
        donnees.dateDepart,
        donnees.dateRetourPrevue,
        donnees.montantHebergement ?? 0,
        donnees.montantRestauration ?? 0,
      ]
    );
    const mission = mapMission(rows[0]);

    if (donnees.hebergement) {
      await creerSejourMaisonHote(client, mission.id, donnees.hebergement);
    }

    await client.query('COMMIT');
    return mission;
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
}

// Ajustement manuel des frais (hébergement/restauration) après création — ex. mission prolongée
// au-delà du retour prévu. Décision produit explicite : pas de recalcul automatique à partir de la
// durée réelle, c'est le RH qui saisit lui-même le nouveau montant.
export async function modifierFrais(
  id: string,
  donnees: { montantHebergement: number; montantRestauration: number }
): Promise<Mission> {
  const { rows } = await pool.query(
    `UPDATE missions SET montant_hebergement = $2, montant_restauration = $3, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, donnees.montantHebergement, donnees.montantRestauration]
  );

  if (!rows[0]) {
    throw new ErreurApplicative(404, 'Mission introuvable');
  }

  return mapMission(rows[0]);
}

export async function enregistrerRetour(id: string, dateRetourReelle: string): Promise<Mission> {
  const { rows } = await pool.query(
    `UPDATE missions SET date_retour_reelle = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, dateRetourReelle]
  );

  if (!rows[0]) {
    throw new ErreurApplicative(404, 'Mission introuvable');
  }

  return mapMission(rows[0]);
}

// ----------------------------------------------------------------------------
// Maisons d'hôte — référentiel (Paramètres), toujours dans le module Missions.
// ----------------------------------------------------------------------------

function mapMaisonHote(l: Record<string, unknown>): MaisonHote {
  return {
    id: l.id as string,
    filialeId: l.filiale_id as string,
    nom: l.nom as string,
    ville: (l.ville as string | null) ?? null,
    actif: l.actif as boolean,
  };
}

export async function listerMaisonsHote(inclureArchives = false): Promise<MaisonHote[]> {
  const clauseWhere = inclureArchives ? '' : 'WHERE actif';
  const { rows } = await pool.query(`SELECT * FROM maisons_hote ${clauseWhere} ORDER BY nom`);
  return rows.map(mapMaisonHote);
}

export async function creerMaisonHote(donnees: CreationMaisonHote): Promise<MaisonHote> {
  const { rows } = await pool.query(
    'INSERT INTO maisons_hote (filiale_id, nom, ville) VALUES ($1, $2, $3) RETURNING *',
    [donnees.filialeId, donnees.nom, donnees.ville ?? null]
  );
  return mapMaisonHote(rows[0]);
}

export async function modifierMaisonHote(id: string, donnees: ModificationMaisonHote): Promise<MaisonHote> {
  const { rows } = await pool.query('UPDATE maisons_hote SET nom = $2, ville = $3 WHERE id = $1 RETURNING *', [
    id,
    donnees.nom,
    donnees.ville ?? null,
  ]);
  if (!rows[0]) throw new ErreurApplicative(404, 'Maison d’hôte introuvable');
  return mapMaisonHote(rows[0]);
}

export async function archiverMaisonHote(id: string, actif: boolean): Promise<MaisonHote> {
  const { rows } = await pool.query('UPDATE maisons_hote SET actif = $2 WHERE id = $1 RETURNING *', [id, actif]);
  if (!rows[0]) throw new ErreurApplicative(404, 'Maison d’hôte introuvable');
  return mapMaisonHote(rows[0]);
}

// Suppression réelle réservée à une maison jamais utilisée (même logique que supprimerChantier) —
// archiverMaisonHote() est le bon outil dès qu'au moins un séjour existe, pour ne jamais faire
// disparaître une maison citée dans un export déjà généré.
export async function supprimerMaisonHote(id: string): Promise<void> {
  const { rows } = await pool.query('SELECT 1 FROM sejours_maison_hote WHERE maison_id = $1 LIMIT 1', [id]);
  if (rows.length > 0) {
    throw new ErreurApplicative(409, 'Cette maison a des séjours enregistrés — archivez-la au lieu de la supprimer.');
  }
  const { rowCount } = await pool.query('DELETE FROM maisons_hote WHERE id = $1', [id]);
  if (rowCount === 0) throw new ErreurApplicative(404, 'Maison d’hôte introuvable');
}

// ----------------------------------------------------------------------------
// Séjours en maison d'hôte — un séjour optionnel par mission (bloc "Hébergement" de la fiche).
// ----------------------------------------------------------------------------

const CLES_TARIF: Record<CategorieTarifHebergement, string> = {
  cadre: 'tarif_nuitee_cadre',
  cadre_superieur: 'tarif_nuitee_cadre_superieur',
};

// GET /api/parametres-paie est réservé à super_admin/drh_holding (taux sensibles) — mais RH
// Filiale, qui saisit les missions, a besoin de voir ces deux tarifs pour remplir le bloc
// Hébergement. D'où cet accès dédié, sans les autres taux de paie.
export async function obtenirTarifsNuitee(): Promise<Record<CategorieTarifHebergement, number | null>> {
  const [cadre, cadreSuperieur] = await Promise.all([
    obtenirValeurParametre(CLES_TARIF.cadre),
    obtenirValeurParametre(CLES_TARIF.cadre_superieur),
  ]);
  return { cadre, cadre_superieur: cadreSuperieur };
}

function joursEntre(debut: string, fin: string): number {
  return Math.round((new Date(fin).getTime() - new Date(debut).getTime()) / 86_400_000);
}

// Appelé dans la même transaction que creerMission (cf. plus haut) — jamais en dehors, d'où le
// PoolClient reçu en paramètre plutôt que d'utiliser `pool` directement.
async function creerSejourMaisonHote(
  client: PoolClient,
  missionId: string,
  donnees: CreationSejourMaisonHote
): Promise<SejourMaisonHote> {
  const nuitees = joursEntre(donnees.dateArrivee, donnees.dateDepart);
  if (nuitees <= 0) {
    throw new ErreurApplicative(400, 'La date de départ de la maison d’hôte doit être après la date d’arrivée');
  }

  let nuiteesProlongation = 0;
  if (donnees.nouvelleDateFin) {
    nuiteesProlongation = joursEntre(donnees.dateDepart, donnees.nouvelleDateFin);
    if (nuiteesProlongation <= 0) {
      throw new ErreurApplicative(400, 'La nouvelle date de fin doit être après la date de départ initiale');
    }
  }

  const tarifNuitee = await obtenirValeurParametre(CLES_TARIF[donnees.categorieTarif]);
  if (tarifNuitee === null) {
    throw new ErreurApplicative(
      409,
      `Tarif de nuitée (${donnees.categorieTarif === 'cadre' ? 'Cadre' : 'Cadre Supérieur'}) non configuré — Paramètres > Paramètres de paie`
    );
  }

  const forfaitTotal = (nuitees + nuiteesProlongation) * tarifNuitee;

  const { rows } = await client.query(
    `INSERT INTO sejours_maison_hote (
       mission_id, maison_id, date_arrivee, date_depart, nouvelle_date_fin, motif_prolongation,
       centre_imputation, categorie_tarif, tarif_nuitee, nuitees, nuitees_prolongation, forfait_total
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      missionId,
      donnees.maisonId,
      donnees.dateArrivee,
      donnees.dateDepart,
      donnees.nouvelleDateFin ?? null,
      donnees.motifProlongation ?? null,
      donnees.centreImputation ?? null,
      donnees.categorieTarif,
      tarifNuitee,
      nuitees,
      nuiteesProlongation,
      forfaitTotal,
    ]
  );

  return mapSejour(rows[0]);
}

function mapSejour(l: Record<string, unknown>): SejourMaisonHote {
  return {
    id: l.id as string,
    missionId: l.mission_id as string,
    maisonId: l.maison_id as string,
    dateArrivee: l.date_arrivee as string,
    dateDepart: l.date_depart as string,
    nouvelleDateFin: (l.nouvelle_date_fin as string | null) ?? null,
    motifProlongation: (l.motif_prolongation as string | null) ?? null,
    centreImputation: (l.centre_imputation as string | null) ?? null,
    categorieTarif: l.categorie_tarif as CategorieTarifHebergement,
    tarifNuitee: Number(l.tarif_nuitee),
    nuitees: Number(l.nuitees),
    nuiteesProlongation: Number(l.nuitees_prolongation),
    forfaitTotal: Number(l.forfait_total),
  };
}

// Onglet "Hébergements" de l'écran Missions — filtrable par mois (obligatoire côté export, optionnel
// ici) et par maison. Mêmes règles de périmètre (filiale/chantier) que listerMissions.
export async function listerSejoursHebergement(
  filialesAutorisees: string[] | null,
  chantiersAutorisees: string[] | null,
  filtres: { mois?: string; maisonId?: string } = {}
): Promise<SejourMaisonHoteAvecDetails[]> {
  const conditions: string[] = [];
  const valeurs: unknown[] = [];

  if (filialesAutorisees !== null) {
    valeurs.push(filialesAutorisees);
    const iFiliales = valeurs.length;
    valeurs.push(chantiersAutorisees ?? []);
    const iChantiers = valeurs.length;
    conditions.push(`(e.filiale_id = ANY($${iFiliales}) OR e.chantier_id = ANY($${iChantiers}))`);
  }

  if (filtres.mois) {
    // filtres.mois = "AAAA-MM" (valeur d'un <input type="month">), pas une date complète —
    // ::date seul échoue (DateTimeParseError), d'où le "-01" pour en faire le 1er du mois.
    valeurs.push(`${filtres.mois}-01`);
    conditions.push(`date_trunc('month', s.date_arrivee) = date_trunc('month', $${valeurs.length}::date)`);
  }

  if (filtres.maisonId) {
    valeurs.push(filtres.maisonId);
    conditions.push(`s.maison_id = $${valeurs.length}`);
  }

  const clauseWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT s.*, mh.nom AS maison_nom,
            m.employe_id, m.numero_ordre_mission, m.motif AS motif_mission,
            e.nom AS employe_nom, e.prenoms AS employe_prenoms, e.telephone AS employe_telephone,
            cp.libelle AS employe_categorie, fo.intitule AS employe_fonction
     FROM sejours_maison_hote s
     JOIN missions m ON m.id = s.mission_id
     JOIN employes e ON e.id = m.employe_id
     JOIN maisons_hote mh ON mh.id = s.maison_id
     LEFT JOIN categories_professionnelles cp ON cp.code = e.categorie_professionnelle
     LEFT JOIN fonctions fo ON fo.id = e.fonction_id
     ${clauseWhere}
     ORDER BY s.date_arrivee DESC`,
    valeurs
  );

  return rows.map((l) => ({
    ...mapSejour(l),
    maisonNom: l.maison_nom as string,
    employeId: l.employe_id as string,
    employeNom: l.employe_nom as string,
    employePrenoms: l.employe_prenoms as string,
    employeTelephone: l.employe_telephone as string,
    employeCategorie: (l.employe_categorie as string | null) ?? null,
    employeFonction: (l.employe_fonction as string | null) ?? null,
    numeroOrdreMission: (l.numero_ordre_mission as string | null) ?? null,
    motifMission: l.motif_mission as string,
  }));
}
