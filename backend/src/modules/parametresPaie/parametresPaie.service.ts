import { pool } from '../../config/db';

export interface ParametrePaie {
  cle: string;
  valeur: number;
  dateEffet: string;
}

const CLES_CONNUES = [
  'taux_cnss_patronale',
  'taux_tpa',
  'taux_fsp',
  'taux_abattement_cadre',
  'taux_abattement_non_cadre',
  'taux_panier_jour',
  'tarif_nuitee_cadre',
  'tarif_nuitee_cadre_superieur',
] as const;

// Un paramètre est append-only en base (historisé par date_effet) — on ne renvoie ici que la
// valeur la plus récente de chaque clé connue, pas tout l'historique.
export async function listerParametresPaie(): Promise<ParametrePaie[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (cle) cle, valeur, date_effet
     FROM parametres_paie
     WHERE cle = ANY($1)
     ORDER BY cle, date_effet DESC`,
    [CLES_CONNUES]
  );

  const parCle = new Map(rows.map((r) => [r.cle as string, { valeur: Number(r.valeur), dateEffet: r.date_effet as string }]));

  // Renvoie aussi les clés connues jamais paramétrées (valeur null) plutôt que de les omettre —
  // pour que l'écran signale clairement "à configurer" au lieu de faire planter le calcul de paie.
  return CLES_CONNUES.map((cle) => ({
    cle,
    valeur: parCle.get(cle)?.valeur ?? NaN,
    dateEffet: parCle.get(cle)?.dateEffet ?? '',
  }));
}

// Lecture d'une seule valeur courante — utilisé par le module Missions pour figer le tarif de
// nuitée au moment de la création d'un séjour en maison d'hôte (cf. missions.service.ts).
export async function obtenirValeurParametre(cle: string): Promise<number | null> {
  const { rows } = await pool.query(
    `SELECT valeur FROM parametres_paie WHERE cle = $1 ORDER BY date_effet DESC LIMIT 1`,
    [cle]
  );
  return rows[0] ? Number(rows[0].valeur) : null;
}

export async function definirParametrePaie(cle: string, valeur: number): Promise<ParametrePaie> {
  const { rows } = await pool.query(
    `INSERT INTO parametres_paie (cle, valeur) VALUES ($1, $2)
     ON CONFLICT (cle, date_effet) DO UPDATE SET valeur = EXCLUDED.valeur
     RETURNING cle, valeur, date_effet`,
    [cle, valeur]
  );

  return { cle: rows[0].cle, valeur: Number(rows[0].valeur), dateEffet: rows[0].date_effet };
}
