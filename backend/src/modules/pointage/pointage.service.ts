import { PoolClient } from 'pg';
import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { verifierCycleOuvertPourEmploye } from '../cyclesPaie/verrouCycle';
import { calculerPointageDepuisJours } from './pointage.calcul';
import {
  AnomalieAbsence,
  Chantier,
  CodeAbsencePointage,
  CreationChantier,
  EmployeAvecPointage,
  JourPointage,
  PointageMensuel,
  PointageMensuelAvecDetails,
  SaisiePointageMensuel,
} from './pointage.types';

function mapChantier(l: Record<string, unknown>): Chantier {
  return {
    id: l.id as string,
    filialeId: l.filiale_id as string,
    nom: l.nom as string,
    localisation: l.localisation as string | null,
    responsableId: l.responsable_id as string | null,
    actif: l.actif as boolean,
  };
}

// inclureArchives=true réservé à l'écran d'administration (Paramètres > Référentiels) — la saisie
// de pointage elle-même ne doit jamais proposer un chantier archivé (comportement par défaut,
// inchangé).
export async function listerChantiers(
  chantiersAutorises: string[] | null = null,
  inclureArchives = false
): Promise<Chantier[]> {
  const conditions = inclureArchives ? [] : ['actif'];
  const valeurs: unknown[] = [];
  if (chantiersAutorises !== null) {
    valeurs.push(chantiersAutorises);
    conditions.push(`id = ANY($${valeurs.length})`);
  }
  const clauseWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(`SELECT * FROM chantiers ${clauseWhere} ORDER BY nom`, valeurs);
  return rows.map(mapChantier);
}

export async function creerChantier(donnees: CreationChantier): Promise<Chantier> {
  const { rows } = await pool.query(
    'INSERT INTO chantiers (filiale_id, nom, localisation, responsable_id) VALUES ($1, $2, $3, $4) RETURNING *',
    [donnees.filialeId, donnees.nom, donnees.localisation ?? null, donnees.responsableId ?? null]
  );
  return mapChantier(rows[0]);
}

export async function renommerChantier(id: string, nom: string): Promise<Chantier> {
  const { rows } = await pool.query('UPDATE chantiers SET nom = $2 WHERE id = $1 RETURNING *', [id, nom]);
  if (!rows[0]) throw new ErreurApplicative(404, 'Chantier introuvable');
  return mapChantier(rows[0]);
}

export async function archiverChantier(id: string, actif: boolean): Promise<Chantier> {
  const { rows } = await pool.query('UPDATE chantiers SET actif = $2 WHERE id = $1 RETURNING *', [id, actif]);
  if (!rows[0]) throw new ErreurApplicative(404, 'Chantier introuvable');
  return mapChantier(rows[0]);
}

function mapPointageMensuel(l: Record<string, unknown>): PointageMensuel {
  return {
    id: l.id as string,
    employeId: l.employe_id as string,
    chantierId: l.chantier_id as string,
    periodeDebut: l.periode_debut as string,
    periodeFin: l.periode_fin as string,
    moisPaie: l.mois_paie as string,
    heuresHs15: Number(l.heures_hs_15),
    heuresHs35: Number(l.heures_hs_35),
    heuresHs60: Number(l.heures_hs_60),
    joursPanier: Number(l.jours_panier),
    joursTravailles: Number(l.jours_travailles),
    nbJoursAbsenceInjustifiee: Number(l.nb_jours_absence_injustifiee),
    nbJoursReposMedical: Number(l.nb_jours_repos_medical),
    nbJoursPermissionNonPayee: Number(l.nb_jours_permission_non_payee),
    nbJoursPermissionPayee: Number(l.nb_jours_permission_payee),
    nbJoursCongeAnnuel: Number(l.nb_jours_conge_annuel),
    statut: l.statut as PointageMensuel['statut'],
    soumisPar: l.soumis_par as string | null,
    soumisLe: l.soumis_le as string | null,
    validePar: l.valide_par as string | null,
    valideLe: l.valide_le as string | null,
    commentaireRejet: l.commentaire_rejet as string | null,
  };
}

// mois_paie = mois calendaire dans lequel tombe la fin de période (cf. décision produit :
// cycle chantier 16→15 fixe pour tous, rattaché au mois de la date de fin).
function moisPaieDepuisPeriodeFin(periodeFin: string): string {
  const [annee, mois] = periodeFin.split('-');
  return `${annee}-${mois}-01`;
}

export async function listerFicheMensuelle(employeId: string, moisPaie: string): Promise<PointageMensuel | null> {
  const { rows } = await pool.query(
    `SELECT * FROM pointages_mensuels WHERE employe_id = $1 AND mois_paie = date_trunc('month', $2::date)`,
    [employeId, moisPaie]
  );
  return rows[0] ? mapPointageMensuel(rows[0]) : null;
}

export async function listerJours(pointageMensuelId: string): Promise<JourPointage[]> {
  const { rows } = await pool.query(
    'SELECT date, heures, code_absence FROM pointages_jours WHERE pointage_mensuel_id = $1 ORDER BY date',
    [pointageMensuelId]
  );
  return rows.map((l) => ({
    date: l.date as string,
    heures: l.heures !== null ? Number(l.heures) : null,
    codeAbsence: l.code_absence as CodeAbsencePointage | null,
  }));
}

// Effectif d'un chantier pour un mois donné (employes.chantier_id = lieu d'affectation par
// défaut) avec, pour chacun, la fiche du mois si elle existe déjà — alimente l'écran de saisie
// « chantier d'abord » (cf. EmployeAvecPointage). Ne filtre pas sur soumis_pointage : ce champ
// pilote le blocage de paie, pas qui peut être pointé sur ce chantier.
export async function listerEmployesChantier(chantierId: string, moisPaie: string): Promise<EmployeAvecPointage[]> {
  const { rows } = await pool.query(
    `SELECT e.id AS employe_id, e.matricule, e.nom, e.prenoms, p.id AS fiche_id, p.statut
     FROM employes e
     LEFT JOIN pointages_mensuels p ON p.employe_id = e.id AND p.mois_paie = date_trunc('month', $2::date)
     WHERE e.chantier_id = $1 AND e.statut = 'actif'
     ORDER BY e.nom, e.prenoms`,
    [chantierId, moisPaie]
  );

  return rows.map((l) => ({
    employeId: l.employe_id as string,
    matricule: l.matricule as string,
    nom: l.nom as string,
    prenoms: l.prenoms as string,
    ficheId: l.fiche_id as string | null,
    statut: l.statut as EmployeAvecPointage['statut'],
  }));
}

// Liste RH siège / file d'attente — filialesAutorisees=null pour super_admin/drh_holding.
export async function listerFiches(
  chantiersAutorises: string[] | null,
  statut?: string,
  moisPaie?: string
): Promise<PointageMensuelAvecDetails[]> {
  const conditions: string[] = [];
  const valeurs: unknown[] = [];

  if (chantiersAutorises !== null) {
    valeurs.push(chantiersAutorises);
    conditions.push(`p.chantier_id = ANY($${valeurs.length})`);
  }
  if (statut) {
    valeurs.push(statut);
    conditions.push(`p.statut = $${valeurs.length}`);
  }
  if (moisPaie) {
    valeurs.push(moisPaie);
    conditions.push(`p.mois_paie = date_trunc('month', $${valeurs.length}::date)`);
  }

  const clauseWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT p.*, e.nom AS employe_nom, e.prenoms AS employe_prenoms, e.matricule AS employe_matricule,
            e.filiale_id, c.nom AS chantier_nom
     FROM pointages_mensuels p
     JOIN employes e ON e.id = p.employe_id
     JOIN chantiers c ON c.id = p.chantier_id
     ${clauseWhere}
     ORDER BY p.mois_paie DESC, e.nom, e.prenoms`,
    valeurs
  );

  return rows.map((l) => ({
    ...mapPointageMensuel(l),
    employeNom: l.employe_nom as string,
    employePrenoms: l.employe_prenoms as string,
    employeMatricule: l.employe_matricule as string,
    chantierNom: l.chantier_nom as string,
    filialeId: l.filiale_id as string,
  }));
}

// Charge les jours fériés (nationaux ou propres à la filiale du chantier) couvrant la période,
// pour la règle H60% (dimanche/férié) — cf. calculerPointageDepuisJours.
async function chargerJoursFeries(client: PoolClient, chantierId: string, debut: string, fin: string): Promise<Set<string>> {
  const { rows } = await client.query(
    `SELECT jf.date FROM jours_feries jf
     JOIN chantiers c ON c.id = $1
     WHERE (jf.filiale_id IS NULL OR jf.filiale_id = c.filiale_id) AND jf.date BETWEEN $2 AND $3`,
    [chantierId, debut, fin]
  );
  return new Set(rows.map((r) => r.date as string));
}

// Recalcule heures_hs_15/35/60, jours_panier et les 5 compteurs d'absence depuis le détail
// journalier actuel (pointages_jours) et les répercute sur la fiche — aucune de ces valeurs ne
// se saisit plus manuellement (cf. pointage.calcul.ts).
async function recalculerEtEnregistrerTotaux(client: PoolClient, fiche: PointageMensuel): Promise<PointageMensuel> {
  const { rows: joursRows } = await client.query(
    'SELECT date, heures, code_absence FROM pointages_jours WHERE pointage_mensuel_id = $1',
    [fiche.id]
  );
  const jours = joursRows.map((j) => ({
    date: j.date as string,
    heures: j.heures !== null ? Number(j.heures) : null,
    codeAbsence: j.code_absence as CodeAbsencePointage | null,
  }));

  const joursFeries = await chargerJoursFeries(client, fiche.chantierId, fiche.periodeDebut, fiche.periodeFin);
  const totaux = calculerPointageDepuisJours(jours, joursFeries);

  const { rows } = await client.query(
    `UPDATE pointages_mensuels SET
       heures_hs_15 = $2, heures_hs_35 = $3, heures_hs_60 = $4, jours_panier = $5,
       jours_travailles = $6,
       nb_jours_absence_injustifiee = $7, nb_jours_repos_medical = $8, nb_jours_permission_non_payee = $9,
       nb_jours_permission_payee = $10, nb_jours_conge_annuel = $11, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [
      fiche.id,
      totaux.heuresHs15,
      totaux.heuresHs35,
      totaux.heuresHs60,
      totaux.joursPanier,
      totaux.joursTravailles,
      totaux.nbJoursAbsenceInjustifiee,
      totaux.nbJoursReposMedical,
      totaux.nbJoursPermissionNonPayee,
      totaux.nbJoursPermissionPayee,
      totaux.nbJoursCongeAnnuel,
    ]
  );
  return mapPointageMensuel(rows[0]);
}

// Crée ou met à jour la fiche du mois (brouillon uniquement — un rejet repasse aussi en
// brouillon pour permettre la correction). `jours`, s'il est fourni, remplace intégralement le
// détail journalier de la période (les dates absentes du tableau sont supprimées) ; les totaux
// (heures sup, panier, absences) sont ensuite recalculés automatiquement depuis ce détail.
export async function enregistrerFiche(donnees: SaisiePointageMensuel): Promise<PointageMensuel> {
  const moisPaie = moisPaieDepuisPeriodeFin(donnees.periodeFin);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existantes } = await client.query(
      `SELECT id, statut FROM pointages_mensuels WHERE employe_id = $1 AND mois_paie = date_trunc('month', $2::date) FOR UPDATE`,
      [donnees.employeId, moisPaie]
    );

    if (existantes[0] && !['brouillon', 'rejete'].includes(existantes[0].statut)) {
      throw new ErreurApplicative(409, `Fiche déjà « ${existantes[0].statut} » — impossible de la modifier`);
    }

    const { rows } = await client.query(
      `INSERT INTO pointages_mensuels (employe_id, chantier_id, periode_debut, periode_fin, mois_paie, statut)
       VALUES ($1, $2, $3, $4, date_trunc('month', $4::date), 'brouillon')
       ON CONFLICT (employe_id, mois_paie) DO UPDATE SET
         chantier_id = EXCLUDED.chantier_id, periode_debut = EXCLUDED.periode_debut, periode_fin = EXCLUDED.periode_fin,
         statut = 'brouillon', commentaire_rejet = NULL, updated_at = now()
       RETURNING *`,
      [donnees.employeId, donnees.chantierId, donnees.periodeDebut, donnees.periodeFin]
    );

    let fiche = mapPointageMensuel(rows[0]);

    if (donnees.jours) {
      const datesFournies = donnees.jours.map((j) => j.date);
      await client.query(
        `DELETE FROM pointages_jours
         WHERE pointage_mensuel_id = $1 AND date BETWEEN $2 AND $3 AND date <> ALL($4::date[])`,
        [fiche.id, fiche.periodeDebut, fiche.periodeFin, datesFournies]
      );

      for (const jour of donnees.jours) {
        await client.query(
          `INSERT INTO pointages_jours (pointage_mensuel_id, date, heures, code_absence)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (pointage_mensuel_id, date) DO UPDATE SET heures = EXCLUDED.heures, code_absence = EXCLUDED.code_absence`,
          [fiche.id, jour.date, jour.heures ?? null, jour.codeAbsence ?? null]
        );
      }
    }

    fiche = await recalculerEtEnregistrerTotaux(client, fiche);

    await client.query('COMMIT');
    return fiche;
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
}

export async function soumettre(id: string, utilisateurId: string): Promise<PointageMensuel> {
  const { rows } = await pool.query(
    `UPDATE pointages_mensuels SET statut = 'soumis', soumis_par = $2, soumis_le = now(), updated_at = now()
     WHERE id = $1 AND statut IN ('brouillon', 'rejete') RETURNING *`,
    [id, utilisateurId]
  );
  if (!rows[0]) {
    throw new ErreurApplicative(409, 'Fiche introuvable ou déjà soumise');
  }
  return mapPointageMensuel(rows[0]);
}

// Signale les codes CA/PP/PNP saisis au jour le jour qui ne correspondent à aucune demande
// approuvée dans Congés (congé administratif) ou Absences (permission exceptionnelle) pour la
// même date et le même employé — alerte non bloquante affichée au RH siège avant validation,
// cf. décision produit : le pointage terrain reste saisissable librement.
export async function detecterAnomalies(pointageMensuelId: string, employeId: string): Promise<AnomalieAbsence[]> {
  const jours = await listerJours(pointageMensuelId);
  const joursACharger = jours.filter((j) => j.codeAbsence === 'conge_annuel' || j.codeAbsence === 'permission_payee');
  if (joursACharger.length === 0) return [];

  const { rows: congesApprouves } = await pool.query(
    `SELECT date_debut, date_fin FROM demandes_conges WHERE employe_id = $1 AND statut = 'validee_rh'`,
    [employeId]
  );
  const { rows: absencesApprouvees } = await pool.query(
    `SELECT date_debut, date_fin FROM demandes_absences WHERE employe_id = $1 AND statut = 'validee_rh'`,
    [employeId]
  );

  const dansIntervalle = (date: string, plages: { date_debut: string; date_fin: string }[]) =>
    plages.some((p) => date >= p.date_debut && date <= p.date_fin);

  const anomalies: AnomalieAbsence[] = [];
  for (const jour of joursACharger) {
    const couvert =
      jour.codeAbsence === 'conge_annuel'
        ? dansIntervalle(jour.date, congesApprouves)
        : dansIntervalle(jour.date, absencesApprouvees);

    if (!couvert) {
      anomalies.push({
        date: jour.date,
        code: jour.codeAbsence!,
        message:
          jour.codeAbsence === 'conge_annuel'
            ? "Aucun congé approuvé ne couvre cette date dans le module Congés"
            : "Aucune permission approuvée ne couvre cette date dans le module Absences",
      });
    }
  }

  return anomalies;
}

const TAUX_PANIER_PAR_DEFAUT = 0;

async function obtenirTauxPanierJour(): Promise<number> {
  const { rows } = await pool.query(
    "SELECT valeur FROM parametres_paie WHERE cle = 'taux_panier_jour' ORDER BY date_effet DESC LIMIT 1"
  );
  return rows[0] ? Number(rows[0].valeur) : TAUX_PANIER_PAR_DEFAUT;
}

// Validation : bascule la fiche à 'valide' et répercute les totaux dans elements_variables_paie
// (jamais directement dans le calcul de paie — cf. décision produit, Éléments du mois reste la
// seule source lue par le moteur). Repos médical et congé annuel n'ont aucun effet sur la paie
// (payés normalement, cf. modules Congés/Absences) ; permission non payée réduit les jours pris
// en compte au même titre qu'une absence injustifiée (cf. décision produit).
export async function valider(id: string, utilisateurId: string): Promise<PointageMensuel> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: ficheRows } = await client.query('SELECT * FROM pointages_mensuels WHERE id = $1 FOR UPDATE', [id]);
    if (!ficheRows[0] || ficheRows[0].statut !== 'soumis') {
      throw new ErreurApplicative(409, 'Fiche introuvable ou pas au statut « soumis »');
    }
    const fiche = mapPointageMensuel(ficheRows[0]);
    await verifierCycleOuvertPourEmploye(fiche.employeId, fiche.moisPaie);

    const { rows } = await client.query(
      `UPDATE pointages_mensuels SET statut = 'valide', valide_par = $2, valide_le = now(), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, utilisateurId]
    );

    const tauxPanier = await obtenirTauxPanierJour();
    const montantPanier = fiche.joursPanier * tauxPanier;
    const joursNonPayes = fiche.nbJoursAbsenceInjustifiee + fiche.nbJoursPermissionNonPayee;

    const upsertElement = async (type: string, colonne: 'montant' | 'jours', valeur: number) => {
      await client.query(
        `INSERT INTO elements_variables_paie (employe_id, periode, type, ${colonne})
         VALUES ($1, $2::date, $3, $4)
         ON CONFLICT (employe_id, periode, type) DO UPDATE SET ${colonne} = EXCLUDED.${colonne}, updated_at = now()`,
        [fiche.employeId, fiche.moisPaie, type, valeur]
      );
    };

    await upsertElement('heure_sup_15', 'montant', fiche.heuresHs15);
    await upsertElement('heure_sup_35', 'montant', fiche.heuresHs35);
    await upsertElement('heure_sup_60', 'montant', fiche.heuresHs60);
    await upsertElement('panier', 'montant', montantPanier);
    await upsertElement('absence_injustifiee', 'jours', joursNonPayes);

    await client.query('COMMIT');
    return mapPointageMensuel(rows[0]);
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
}

export async function rejeter(id: string, utilisateurId: string, commentaire: string): Promise<PointageMensuel> {
  const { rows } = await pool.query(
    `UPDATE pointages_mensuels SET statut = 'rejete', valide_par = $2, valide_le = now(),
       commentaire_rejet = $3, updated_at = now()
     WHERE id = $1 AND statut = 'soumis' RETURNING *`,
    [id, utilisateurId, commentaire]
  );
  if (!rows[0]) {
    throw new ErreurApplicative(409, 'Fiche introuvable ou pas au statut « soumis »');
  }
  return mapPointageMensuel(rows[0]);
}

export async function obtenirFichePourAcces(id: string): Promise<{ employeId: string; chantierId: string } | null> {
  const { rows } = await pool.query('SELECT employe_id, chantier_id FROM pointages_mensuels WHERE id = $1', [id]);
  if (!rows[0]) return null;
  return { employeId: rows[0].employe_id as string, chantierId: rows[0].chantier_id as string };
}
