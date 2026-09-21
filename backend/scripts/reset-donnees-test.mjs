#!/usr/bin/env node
// Vide les données RH transactionnelles (employés, contrats, congés, absences, paie, pointage,
// missions, documents, attestations, audit) pour repartir de zéro en test, sans toucher aux
// référentiels (filiales, départements, services, fonctions, chantiers, catégories pro,
// paramètres de paie) ni aux comptes utilisateurs — cf. demande explicite de l'utilisateur.
// Réinsère ensuite 10 employés actifs avec chacun un contrat CDI actif.
//
// Effet de bord assumé et non évitable : les colonnes departements.responsable_id,
// services.responsable_id, chantiers.responsable_id et utilisateurs.employe_id qui pointaient
// vers un employé supprimé repassent à NULL (ON DELETE SET NULL) — les comptes de connexion
// restent utilisables, seul le lien vers un dossier employé précis est perdu.

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

// Ordre : tables enfants avant tables parentes, pour respecter les FK ON DELETE RESTRICT
// (bulletins_paie, contrats, attestations, employes). employes en dernier : les colonnes
// responsable_id / employe_id des référentiels repassent alors à NULL automatiquement.
const TABLES_A_VIDER = [
  'pointages_jours',
  'attestations',
  'compteurs_attestations',
  'tags_documents',
  'documents',
  'bulletins_paie',
  'elements_variables_paie',
  'cycles_paie',
  'pointages_mensuels',
  'missions',
  'demandes_absences',
  'soldes_permissions_exceptionnelles',
  'demandes_conges_speciaux',
  'demandes_conges',
  'soldes_conges',
  'stagiaires',
  'contrats',
  'journal_audit',
  'employes',
];

const PRENOMS = ['Aïcha', 'Boureima', 'Fatou', 'Issouf', 'Ramata', 'Seydou', 'Aminata', 'Ousmane', 'Salimata', 'Boubacar'];
const NOMS = ['Ouédraogo', 'Kaboré', 'Sawadogo', 'Compaoré', 'Zongo', 'Traoré', 'Bationo', 'Sanou', 'Tapsoba', 'Kaffando'];
const CATEGORIES = ['ouvrier', 'employe', 'agent_maitrise', 'cadre'];

function pad(n) {
  return String(n).padStart(4, '0');
}

async function main() {
  const client = await pool.connect();
  try {
    console.log('--- Vidage des données RH ---');
    await client.query('BEGIN');
    for (const table of TABLES_A_VIDER) {
      const { rowCount } = await client.query(`DELETE FROM ${table}`);
      console.log(`  ${table} : ${rowCount} ligne(s) supprimée(s)`);
    }
    await client.query('COMMIT');
    console.log('Données RH vidées. Référentiels et comptes utilisateurs conservés.\n');
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }

  console.log('--- Seed : 10 employés + 10 contrats actifs ---');

  const { rows: filiales } = await pool.query(
    "SELECT id, nom FROM filiales WHERE actif ORDER BY created_at LIMIT 1"
  );
  if (!filiales[0]) {
    throw new Error('Aucune filiale active en base — impossible de créer des employés sans filiale.');
  }
  const filiale = filiales[0];

  const { rows: departements } = await pool.query(
    'SELECT id FROM departements WHERE filiale_id = $1 AND actif LIMIT 1',
    [filiale.id]
  );
  const departementId = departements[0]?.id ?? null;

  const { rows: services } = departementId
    ? await pool.query('SELECT id FROM services WHERE departement_id = $1 AND actif LIMIT 1', [departementId])
    : { rows: [] };
  const serviceId = services[0]?.id ?? null;

  const { rows: fonctions } = await pool.query('SELECT id FROM fonctions WHERE actif ORDER BY intitule LIMIT 10');

  console.log(`Filiale utilisée : ${filiale.nom}`);

  for (let i = 0; i < 10; i++) {
    const matricule = `TEST-${pad(i + 1)}`;
    const nom = NOMS[i];
    const prenoms = PRENOMS[i];
    const sexe = i % 2 === 0 ? 'F' : 'M';
    const categorie = CATEGORIES[i % CATEGORIES.length];
    const fonctionId = fonctions[i % fonctions.length]?.id ?? null;
    const dateNaissance = `${1985 + (i % 15)}-0${(i % 9) + 1}-15`;
    const dateEmbauche = `2024-0${(i % 9) + 1}-01`;
    const personnesACharge = i % 4;
    const salaireBase = 120_000 + i * 25_000;

    const { rows: employeRows } = await pool.query(
      `INSERT INTO employes (
         matricule, nom, prenoms, date_naissance, sexe, nationalite, telephone, num_cnib, num_cnss,
         personnes_a_charge, filiale_id, departement_id, service_id, fonction_id, categorie_professionnelle,
         date_embauche, statut
       ) VALUES ($1, $2, $3, $4, $5, 'Burkinabè', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'actif')
       RETURNING id, matricule, nom, prenoms`,
      [
        matricule,
        nom,
        prenoms,
        dateNaissance,
        sexe,
        `7000${pad(i + 1)}`,
        `CNIB${pad(i + 1)}`,
        `CNSS${pad(i + 1)}`,
        personnesACharge,
        filiale.id,
        departementId,
        serviceId,
        fonctionId,
        categorie,
        dateEmbauche,
      ]
    );
    const employe = employeRows[0];

    await pool.query(
      `INSERT INTO contrats (employe_id, type, date_debut, salaire_base, statut)
       VALUES ($1, 'cdi', $2, $3, 'actif')`,
      [employe.id, dateEmbauche, salaireBase]
    );

    console.log(`  ${employe.matricule} — ${employe.nom} ${employe.prenoms} — contrat CDI actif (${salaireBase} F CFA)`);
  }

  await pool.end();
  console.log('\nTerminé : 10 employés actifs, chacun avec 1 contrat CDI actif.');
}

main().catch((erreur) => {
  console.error('Échec du reset/seed :', erreur);
  process.exit(1);
});
