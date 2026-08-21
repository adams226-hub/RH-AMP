import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';

export interface JourFerie {
  id: string;
  date: string;
  libelle: string;
  filialeId: string | null;
}

export interface CreationJourFerie {
  date: string;
  libelle: string;
  filialeId?: string;
}

function mapLigne(l: Record<string, unknown>): JourFerie {
  return {
    id: l.id as string,
    date: l.date as string,
    libelle: l.libelle as string,
    filialeId: l.filiale_id as string | null,
  };
}

export async function listerJoursFeries(annee?: number): Promise<JourFerie[]> {
  const { rows } = annee
    ? await pool.query(
        `SELECT * FROM jours_feries WHERE EXTRACT(YEAR FROM date) = $1 ORDER BY date`,
        [annee]
      )
    : await pool.query('SELECT * FROM jours_feries ORDER BY date');

  return rows.map(mapLigne);
}

export async function creerJourFerie(donnees: CreationJourFerie): Promise<JourFerie> {
  const { rows } = await pool.query(
    'INSERT INTO jours_feries (date, libelle, filiale_id) VALUES ($1, $2, $3) RETURNING *',
    [donnees.date, donnees.libelle, donnees.filialeId ?? null]
  );
  return mapLigne(rows[0]);
}

export async function supprimerJourFerie(id: string): Promise<void> {
  const { rowCount } = await pool.query('DELETE FROM jours_feries WHERE id = $1', [id]);
  if (!rowCount) {
    throw new ErreurApplicative(404, 'Jour férié introuvable');
  }
}
