#!/usr/bin/env node
// Amorce les paramètres de paie configurables (parametres_paie) via la connexion PostgreSQL directe.
// taux_cnss_patronale est une valeur PROVISOIRE (16%) — à reconfirmer auprès de la CNSS avant
// toute mise en production, cf. docs/specifications-fonctionnelles/02-gestion-paie.md §8.

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

const parametres = [
  ['taux_cnss_patronale', 0.16],
  ['taux_tpa', 0.03],
  ['taux_fsp', 0.01],
  ['taux_abattement', 0.2],
  // Placeholder à configurer par le Super Admin (Paramètres > Paie) — pas de valeur
  // confirmée à ce jour, cf. SPEC_MODULE_POINTAGE_AMP.md.
  ['taux_panier_jour', 0],
];

for (const [cle, valeur] of parametres) {
  await pool.query(
    `INSERT INTO parametres_paie (cle, valeur) VALUES ($1, $2)
     ON CONFLICT (cle, date_effet) DO NOTHING`,
    [cle, valeur]
  );
  console.log(`${cle} = ${valeur}`);
}

await pool.end();
console.log('Paramètres de paie amorcés.');
