#!/usr/bin/env node
// Applique database/schema.sql sur un projet Supabase via l'API Management,
// en s'authentifiant avec un Personal Access Token (pas besoin du mot de passe DB).
// Lit SUPABASE_ACCESS_TOKEN et SUPABASE_PROJECT_REF depuis backend/.env (jamais collés en dur ici).

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const CHEMIN_ENV = join(ICI, '..', 'backend', '.env');
const CHEMIN_SCHEMA = join(ICI, 'schema.sql');

function chargerEnv(chemin) {
  if (!existsSync(chemin)) return {};
  const contenu = readFileSync(chemin, 'utf8');
  const variables = {};
  for (const ligne of contenu.split('\n')) {
    const l = ligne.trim();
    if (!l || l.startsWith('#')) continue;
    const indexEgal = l.indexOf('=');
    if (indexEgal === -1) continue;
    variables[l.slice(0, indexEgal).trim()] = l.slice(indexEgal + 1).trim();
  }
  return variables;
}

const env = { ...chargerEnv(CHEMIN_ENV), ...process.env };
const jeton = env.SUPABASE_ACCESS_TOKEN;
const refProjet = env.SUPABASE_PROJECT_REF;

if (!jeton || !refProjet) {
  console.error('SUPABASE_ACCESS_TOKEN et SUPABASE_PROJECT_REF doivent être définis dans backend/.env');
  process.exit(1);
}

if (!existsSync(CHEMIN_SCHEMA)) {
  console.error(`Fichier introuvable : ${CHEMIN_SCHEMA}`);
  process.exit(1);
}

const sql = readFileSync(CHEMIN_SCHEMA, 'utf8');

console.log(`Application de database/schema.sql sur le projet Supabase "${refProjet}"...`);

const reponse = await fetch(`https://api.supabase.com/v1/projects/${refProjet}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${jeton}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const resultat = await reponse.json();

if (!reponse.ok) {
  console.error("Échec de l'exécution du schéma :", resultat);
  process.exit(1);
}

console.log('Schéma appliqué avec succès.');
console.log(resultat);
