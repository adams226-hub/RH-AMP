import { pool } from '../../config/db';

export interface ParametrePaie {
  cle: string;
  valeur: number;
  dateEffet: string;
}

const CLES_CONNUES = ['taux_cnss_patronale', 'taux_tpa', 'taux_fsp', 'taux_abattement', 'taux_panier_jour'] as const;

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

export async function definirParametrePaie(cle: string, valeur: number): Promise<ParametrePaie> {
  const { rows } = await pool.query(
    `INSERT INTO parametres_paie (cle, valeur) VALUES ($1, $2)
     ON CONFLICT (cle, date_effet) DO UPDATE SET valeur = EXCLUDED.valeur
     RETURNING cle, valeur, date_effet`,
    [cle, valeur]
  );

  return { cle: rows[0].cle, valeur: Number(rows[0].valeur), dateEffet: rows[0].date_effet };
}
