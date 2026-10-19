#!/usr/bin/env node
// Rend la filiale facultative sur un chantier : filiale_id NULL = chantier commun à toutes les
// filiales (leurs employés peuvent y être affectés et pointés ensemble). Les chantiers existants
// gardent leur filiale. L'unicité (filiale_id, nom) ne couvre pas les NULL : un index partiel
// interdit donc aussi deux chantiers communs de même nom. Idempotent.

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

await pool.query('ALTER TABLE chantiers ALTER COLUMN filiale_id DROP NOT NULL');
await pool.query(`
  CREATE UNIQUE INDEX IF NOT EXISTS chantiers_nom_commun_unique
  ON chantiers (lower(nom)) WHERE filiale_id IS NULL
`);

const { rows } = await pool.query(
  "SELECT is_nullable FROM information_schema.columns WHERE table_name = 'chantiers' AND column_name = 'filiale_id'"
);
console.log(`chantiers.filiale_id facultatif : ${rows[0]?.is_nullable === 'YES' ? 'oui' : 'NON'}`);

await pool.end();
