import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { CreationMission, Mission, MissionAvecEmploye, StatutMission } from './missions.types';

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
    destination: l.destination as string,
    motif: l.motif as string,
    dateDepart,
    dateRetourPrevue,
    dateRetourReelle,
    statut: calculerStatut(dateDepart, dateRetourPrevue, dateRetourReelle),
  };
}

export async function listerMissions(filialesAutorisees: string[] | null): Promise<MissionAvecEmploye[]> {
  const conditions: string[] = [];
  const valeurs: unknown[] = [];

  if (filialesAutorisees !== null) {
    valeurs.push(filialesAutorisees);
    conditions.push(`e.filiale_id = ANY($${valeurs.length})`);
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
  const { rows } = await pool.query(
    `INSERT INTO missions (employe_id, destination, motif, date_depart, date_retour_prevue)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [donnees.employeId, donnees.destination, donnees.motif, donnees.dateDepart, donnees.dateRetourPrevue]
  );

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
