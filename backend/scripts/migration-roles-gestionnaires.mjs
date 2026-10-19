#!/usr/bin/env node
// Ajoute les rôles "gestionnaires" : profils limités à quelques modules, sur toutes les filiales
// (la liste des modules par rôle vit dans backend/src/middleware/autorisation.ts). Purement additif :
// aucun compte ni rôle existant n'est modifié. Idempotent (ADD VALUE IF NOT EXISTS / ON CONFLICT).

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

const ROLES = [
  ['gestionnaire_conges_absences', 'Gestionnaire Congés & Absences'],
  ['gestionnaire_contrats_attestations', 'Gestionnaire Contrats & Attestations'],
  ['gestionnaire_paie', 'Gestionnaire Paie'],
  ['gestionnaire_temps_presences', 'Gestionnaire Temps & Présences'],
  ['gestionnaire_personnel_pointage', 'Gestionnaire Personnel & Pointage'],
];

// ADD VALUE ne peut pas être utilisée dans la même transaction que l'INSERT qui s'en sert : chaque
// requête est donc envoyée séparément (autocommit).
for (const [code] of ROLES) {
  await pool.query(`ALTER TYPE code_role ADD VALUE IF NOT EXISTS '${code}'`);
}

for (const [code, libelle] of ROLES) {
  await pool.query('INSERT INTO roles (code, libelle) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING', [code, libelle]);
}

const { rows } = await pool.query("SELECT code, libelle FROM roles WHERE code::text LIKE 'gestionnaire_%' ORDER BY code");
console.log('Rôles gestionnaires présents :');
for (const r of rows) console.log(`  ${r.code} — ${r.libelle}`);

await pool.end();
