#!/usr/bin/env node
// Ajoute la catégorie professionnelle (Agent de maîtrise/Cadre/Employé/Ouvrier) à `employes` —
// donnée demandée pour le module Tableaux de bord (filtre + graphique dédié), absente du
// schéma initial. Idempotent (IF NOT EXISTS).

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
  DO $$ BEGIN
    CREATE TYPE categorie_professionnelle AS ENUM ('ouvrier', 'employe', 'agent_maitrise', 'cadre');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;
`);

await pool.query(`
  ALTER TABLE employes ADD COLUMN IF NOT EXISTS categorie_professionnelle categorie_professionnelle;
`);

console.log('Migration appliquée : employes.categorie_professionnelle');
await pool.end();
