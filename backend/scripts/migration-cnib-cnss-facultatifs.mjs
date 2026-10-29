#!/usr/bin/env node
// Rend facultatifs le N° CNIB et le N° CNSS d'un employé : ils ne sont pas toujours connus à
// l'embauche (pièce en renouvellement, immatriculation CNSS en cours). Les numéros déjà saisis
// sont conservés. Idempotent.

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

await pool.query('ALTER TABLE employes ALTER COLUMN num_cnib DROP NOT NULL');
await pool.query('ALTER TABLE employes ALTER COLUMN num_cnss DROP NOT NULL');

const { rows } = await pool.query(
  `SELECT column_name, is_nullable FROM information_schema.columns
   WHERE table_name = 'employes' AND column_name IN ('num_cnib', 'num_cnss') ORDER BY column_name`
);
for (const r of rows) console.log(`employes.${r.column_name} facultatif : ${r.is_nullable === 'YES' ? 'oui' : 'NON'}`);

await pool.end();
