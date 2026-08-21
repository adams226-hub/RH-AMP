#!/usr/bin/env node
// Crée un compte utilisateur via l'API Management Supabase (INSERT direct dans `utilisateurs`),
// sans dépendre du backend Express ni de DATABASE_URL — utile pour créer les premiers comptes
// de test avant que la connexion PostgreSQL directe soit configurée.
// Usage : node scripts/creer-compte.mjs <email> <motDePasse> <codeRole>
// codeRole : super_admin | drh_holding | rh_filiale | chef_service | employe | responsable_rh_chantier

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import bcrypt from 'bcryptjs';

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

const [, , email, motDePasse, codeRole] = process.argv;

if (!email || !motDePasse || !codeRole) {
  console.error('Usage : node scripts/creer-compte.mjs <email> <motDePasse> <codeRole>');
  process.exit(1);
}

const env = { ...chargerEnv(CHEMIN_ENV), ...process.env };
const jeton = env.SUPABASE_ACCESS_TOKEN;
const refProjet = env.SUPABASE_PROJECT_REF;

if (!jeton || !refProjet) {
  console.error('SUPABASE_ACCESS_TOKEN et SUPABASE_PROJECT_REF doivent être définis dans backend/.env');
  process.exit(1);
}

const hash = await bcrypt.hash(motDePasse, 10);
const echapper = (s) => s.replace(/'/g, "''");

const sql = `
  INSERT INTO utilisateurs (email, mot_de_passe_hash, role_id)
  VALUES ('${echapper(email)}', '${echapper(hash)}', (SELECT id FROM roles WHERE code = '${echapper(codeRole)}'))
  RETURNING id, email;
`;

const reponse = await fetch(`https://api.supabase.com/v1/projects/${refProjet}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});

const resultat = await reponse.json();

if (!reponse.ok) {
  console.error('Échec de la création du compte :', resultat);
  process.exit(1);
}

console.log('Compte créé :', resultat);
