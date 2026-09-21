#!/usr/bin/env node
// Renseigne les mentions légales (adresse, RCCM, IFU, téléphone) d'une filiale, affichées en
// pied de page du bulletin de paie (paie.pdf.ts) — champ resté vide tant que personne ne l'a
// saisi depuis Paramètres > Référentiels.
//
// Usage : node set-mentions-legales-filiale.mjs "<nom filiale>" "<adresse>" "<rccm>" "<ifu>" "<telephone>"

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
const [, , nomFiliale, adresse, rccm, ifu, telephone] = process.argv;

if (!nomFiliale) {
  console.error('Usage : node set-mentions-legales-filiale.mjs "<nom filiale>" "<adresse>" "<rccm>" "<ifu>" "<telephone>"');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_URL?.includes('supabase.com') ? { rejectUnauthorized: false } : undefined,
});

const { rowCount, rows } = await pool.query(
  `UPDATE filiales SET adresse = $2, rccm = $3, ifu = $4, telephone = $5 WHERE nom = $1 RETURNING nom, adresse, rccm, ifu, telephone`,
  [nomFiliale, adresse ?? null, rccm ?? null, ifu ?? null, telephone ?? null]
);

if (rowCount === 0) {
  console.error(`Aucune filiale nommée "${nomFiliale}".`);
  process.exit(1);
}

console.log('Mis à jour :', rows[0]);
await pool.end();
