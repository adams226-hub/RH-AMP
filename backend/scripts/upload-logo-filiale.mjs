#!/usr/bin/env node
// Dépose le logo d'une filiale dans le bucket Supabase Storage "logos" et met à jour
// filiales.logo_url — reproduit exactement enregistrerLogoFiliale() de postes.service.ts,
// pour pouvoir déposer un logo sans passer par l'écran Paramètres > Référentiels.
//
// Usage : node upload-logo-filiale.mjs "<nom exact ou partiel de la filiale>" "<chemin du fichier image>"

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

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

const [, , nomFiliale, cheminFichier] = process.argv;
if (!nomFiliale || !cheminFichier) {
  console.error('Usage : node upload-logo-filiale.mjs "<nom filiale>" "<chemin fichier image>"');
  process.exit(1);
}

const MIME_PAR_EXTENSION = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const mimetype = MIME_PAR_EXTENSION[extname(cheminFichier).toLowerCase()] ?? 'application/octet-stream';

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_URL?.includes('supabase.com') ? { rejectUnauthorized: false } : undefined,
});

const { rows } = await pool.query('SELECT id, nom FROM filiales WHERE nom ILIKE $1', [`%${nomFiliale}%`]);
if (rows.length === 0) {
  console.error(`Aucune filiale ne correspond à "${nomFiliale}".`);
  process.exit(1);
}
if (rows.length > 1) {
  console.error(`Plusieurs filiales correspondent à "${nomFiliale}" : ${rows.map((r) => r.nom).join(', ')} — précisez.`);
  process.exit(1);
}
const filiale = rows[0];

const storage = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const chemin = `${filiale.id}.png`;
const buffer = readFileSync(cheminFichier);

const { error } = await storage.storage.from('logos').upload(chemin, buffer, { contentType: mimetype, upsert: true });
if (error) {
  console.error(`Échec de l'upload : ${error.message}`);
  process.exit(1);
}

await pool.query('UPDATE filiales SET logo_url = $2 WHERE id = $1', [filiale.id, chemin]);
console.log(`Logo déposé pour "${filiale.nom}" (${chemin}).`);

const { rows: toutes } = await pool.query('SELECT nom, logo_url FROM filiales WHERE actif ORDER BY nom');
console.log('\nÉtat des logos par filiale active :');
for (const f of toutes) {
  console.log(`  ${f.logo_url ? '✔' : '✘'} ${f.nom}`);
}

await pool.end();
