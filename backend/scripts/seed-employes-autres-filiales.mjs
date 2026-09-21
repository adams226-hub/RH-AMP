#!/usr/bin/env node
// Ajoute des employés de test (+ 1 contrat CDI actif chacun) dans toutes les filiales actives
// qui n'en ont pas encore — pour pouvoir tester le périmètre RH filiale / DRH holding sur
// plusieurs filiales à la fois. Ne touche pas aux employés déjà présents (ex. AMP Béton).
//
// Usage : node seed-employes-autres-filiales.mjs [nombre_par_filiale=5]

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

const NB_PAR_FILIALE = Number(process.argv[2] ?? 5);

const PRENOMS = [
  'Aïcha', 'Boureima', 'Fatou', 'Issouf', 'Ramata', 'Seydou', 'Aminata', 'Ousmane', 'Salimata', 'Boubacar',
  'Awa', 'Adama', 'Mariam', 'Rasmané', 'Zenabou', 'Yacouba', 'Bintou', 'Moussa', 'Habibou', 'Karim',
];
const NOMS = [
  'Ouédraogo', 'Kaboré', 'Sawadogo', 'Compaoré', 'Zongo', 'Traoré', 'Bationo', 'Sanou', 'Tapsoba', 'Kaffando',
  'Nikiema', 'Ilboudo', 'Sorgho', 'Kientega', 'Ki', 'Yaméogo', 'Sombié', 'Ouili', 'Barry', 'Diallo',
];
const CATEGORIES = ['ouvrier', 'employe', 'agent_maitrise', 'cadre'];

function pad(n) {
  return String(n).padStart(4, '0');
}

async function main() {
  const { rows: filiales } = await pool.query('SELECT id, nom FROM filiales WHERE actif ORDER BY nom');

  const { rows: filialesAvecEmployes } = await pool.query(
    'SELECT DISTINCT filiale_id FROM employes'
  );
  const idsAvecEmployes = new Set(filialesAvecEmployes.map((l) => l.filiale_id));

  const { rows: matriculesExistants } = await pool.query(
    "SELECT matricule FROM employes WHERE matricule LIKE 'TEST-%'"
  );
  let compteur = matriculesExistants.reduce((max, l) => {
    const n = Number(l.matricule.replace('TEST-', ''));
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);

  const ciblees = filiales.filter((f) => !idsAvecEmployes.has(f.id));
  if (ciblees.length === 0) {
    console.log('Toutes les filiales actives ont déjà au moins un employé — rien à faire.');
    await pool.end();
    return;
  }

  console.log(`Filiales sans employé (${ciblees.length}) : ${ciblees.map((f) => f.nom).join(', ')}`);
  console.log(`Ajout de ${NB_PAR_FILIALE} employé(s) actif(s) par filiale, avec 1 contrat CDI actif chacun.\n`);

  for (const filiale of ciblees) {
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

    console.log(`— ${filiale.nom} —`);

    for (let i = 0; i < NB_PAR_FILIALE; i++) {
      compteur += 1;
      const matricule = `TEST-${pad(compteur)}`;
      const nom = NOMS[compteur % NOMS.length];
      const prenoms = PRENOMS[compteur % PRENOMS.length];
      const sexe = compteur % 2 === 0 ? 'F' : 'M';
      const categorie = CATEGORIES[compteur % CATEGORIES.length];
      const fonctionId = fonctions.length > 0 ? fonctions[compteur % fonctions.length].id : null;
      const dateNaissance = `${1985 + (compteur % 15)}-0${(compteur % 9) + 1}-15`;
      const dateEmbauche = `2024-0${(compteur % 9) + 1}-01`;
      const personnesACharge = compteur % 4;
      const salaireBase = 120_000 + (compteur % 10) * 25_000;

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
          `7${pad(compteur)}`,
          `CNIB${pad(compteur)}`,
          `CNSS${pad(compteur)}`,
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
  }

  await pool.end();
  console.log('\nTerminé.');
}

main().catch((erreur) => {
  console.error('Échec du seed :', erreur);
  process.exit(1);
});
