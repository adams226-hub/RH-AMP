#!/usr/bin/env node
// Renseigne le pied de page légal en texte libre multi-lignes (filiales.mentions_legales_bulletin)
// pour une filiale dont les mentions légales dépassent le gabarit simple adresse/RCCM/IFU/tél.
//
// Usage : node set-mentions-legales-riches-filiale.mjs "<nom filiale>" "<chemin fichier .txt (une ligne par ligne imprimée)>"
// ou      node set-mentions-legales-riches-filiale.mjs "<nom filiale>" --texte "ligne1\nligne2\nligne3"

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
const [, , nomFiliale, arg1, arg2] = process.argv;

if (!nomFiliale || !arg1) {
  console.error('Usage : node set-mentions-legales-riches-filiale.mjs "<nom filiale>" "<chemin fichier .txt>"');
  console.error('    ou : node set-mentions-legales-riches-filiale.mjs "<nom filiale>" --texte "ligne1\\nligne2"');
  process.exit(1);
}

const texte = arg1 === '--texte' ? arg2.replace(/\\n/g, '\n') : readFileSync(arg1, 'utf8').trim();

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_URL?.includes('supabase.com') ? { rejectUnauthorized: false } : undefined,
});

const { rowCount, rows } = await pool.query(
  'UPDATE filiales SET mentions_legales_bulletin = $2 WHERE nom = $1 RETURNING nom, mentions_legales_bulletin',
  [nomFiliale, texte]
);

if (rowCount === 0) {
  console.error(`Aucune filiale nommée "${nomFiliale}".`);
  process.exit(1);
}

console.log('Mis à jour :', rows[0]);
await pool.end();
