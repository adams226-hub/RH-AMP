#!/usr/bin/env node
// Ajoute la gestion des maisons d'hôte, intégrée au module Missions (pas de nouveau module) —
// table de référence maisons_hote + séjours_maison_hote (1 séjour optionnel par mission), et deux
// tarifs de nuitée configurables (parametres_paie, même mécanisme générique que les autres taux de
// paie). Idempotent (IF NOT EXISTS / ON CONFLICT).

import pg from 'pg';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const CHEMIN_ENV = join(ICI, '..', '.env');

function chargerEnv(chemin) {
  if (!existsSync(chemin)) return {};
  const contenu = readFileSync(chemin, 'utf8');
  const variables = {};
  for (const ligne of contenu.split('\n')) {
    const l = ligne.trim();
    if (!l || l.startsWith('#')) continue;
    const i = l.indexOf('=');
    if (i === -1) continue;
    variables[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  return variables;
}

const env = { ...chargerEnv(CHEMIN_ENV), ...process.env };
const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_URL?.includes('supabase.com') ? { rejectUnauthorized: false } : undefined,
});

await pool.query(`
  CREATE TABLE IF NOT EXISTS maisons_hote (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    filiale_id uuid NOT NULL REFERENCES filiales(id),
    nom text NOT NULL,
    ville text,
    actif boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
  );
`);

await pool.query(`
  DO $$ BEGIN
    CREATE TYPE categorie_tarif_hebergement AS ENUM ('cadre', 'cadre_superieur');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;
`);

// mission_id UNIQUE : un seul séjour maison d'hôte par mission (bloc Hébergement unique sur la
// fiche mission, pas une liste) — ON DELETE CASCADE au cas où une mission serait un jour
// supprimable (aucune route de suppression aujourd'hui, mais plus sûr que de laisser une référence
// orpheline si ça change).
await pool.query(`
  CREATE TABLE IF NOT EXISTS sejours_maison_hote (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id uuid NOT NULL UNIQUE REFERENCES missions(id) ON DELETE CASCADE,
    maison_id uuid NOT NULL REFERENCES maisons_hote(id),
    date_arrivee date NOT NULL,
    date_depart date NOT NULL,
    nouvelle_date_fin date,
    motif_prolongation text,
    centre_imputation text,
    categorie_tarif categorie_tarif_hebergement NOT NULL,
    tarif_nuitee numeric NOT NULL,
    nuitees integer NOT NULL,
    nuitees_prolongation integer NOT NULL DEFAULT 0,
    forfait_total numeric NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
`);

// parametres_paie.valeur est numeric(8,4) — pensé pour des taux (0.xxxx) et le seul montant
// existant (prime de panier/jour) reste sous 10 000. Les tarifs de nuitée (15 000 / 20 000) le
// dépassent : élargit la précision sans toucher aux valeurs déjà stockées (changement sûr, aucune
// donnée existante ne dépasse la nouvelle limite).
await pool.query(`ALTER TABLE parametres_paie ALTER COLUMN valeur TYPE numeric(12, 4);`);

// Valeurs initiales demandées (15 000 F cadre / 20 000 F cadre supérieur) — modifiables ensuite
// depuis Paramètres > Paramètres de paie, comme les autres taux. ON CONFLICT DO NOTHING : ne
// jamais écraser une valeur déjà définie si le script est relancé.
await pool.query(
  `INSERT INTO parametres_paie (cle, valeur) VALUES ($1, $2), ($3, $4)
   ON CONFLICT (cle, date_effet) DO NOTHING`,
  ['tarif_nuitee_cadre', 15000, 'tarif_nuitee_cadre_superieur', 20000]
);

console.log('Migration appliquée : maisons_hote, sejours_maison_hote, tarifs de nuitée');
await pool.end();
