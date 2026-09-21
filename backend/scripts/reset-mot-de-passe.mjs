#!/usr/bin/env node
// Réinitialise le mot de passe d'un compte utilisateur — utile quand le mot de passe original
// est perdu et qu'il n'existe aucun moyen de le retrouver (hash bcrypt, non réversible).
//
// Usage : node reset-mot-de-passe.mjs "<email>" "<nouveau mot de passe>"

import bcrypt from 'bcryptjs';
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
const [, , email, nouveauMotDePasse] = process.argv;

if (!email || !nouveauMotDePasse) {
  console.error('Usage : node reset-mot-de-passe.mjs "<email>" "<nouveau mot de passe>"');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_URL?.includes('supabase.com') ? { rejectUnauthorized: false } : undefined,
});

const hash = await bcrypt.hash(nouveauMotDePasse, 10);
const { rowCount } = await pool.query(
  'UPDATE utilisateurs SET mot_de_passe_hash = $2, updated_at = now() WHERE email = $1',
  [email, hash]
);

if (rowCount === 0) {
  console.error(`Aucun compte avec l'email "${email}".`);
  process.exit(1);
}

console.log(`Mot de passe réinitialisé pour ${email}.`);
await pool.end();
