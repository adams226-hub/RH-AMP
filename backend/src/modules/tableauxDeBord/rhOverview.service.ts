import { pool } from '../../config/db';
import { FiltresRHOverview, RHOverviewReponse } from './rhOverview.types';

interface LigneEmploye {
  sexe: 'M' | 'F';
  nationalite: string;
  dateNaissance: string;
  dateEmbauche: string;
  categorieProfessionnelle: string | null;
  filiale: string;
  typeContrat: string | null;
  salaireBase: number | null;
}

// Une seule requête filtrée (RBAC + slicers) — toutes les agrégations (KPI, donut,
// bar charts empilés, pyramide) sont ensuite calculées en JS sur ce jeu de lignes,
// ce qui garde le "un seul appel API consolidé" demandé sans dupliquer la clause
// WHERE dans sept requêtes SQL différentes.
async function chargerLignesFiltrees(
  filialesAutorisees: string[] | null,
  filtres: FiltresRHOverview
): Promise<LigneEmploye[]> {
  const conditions: string[] = ["e.statut = 'actif'"];
  const valeurs: unknown[] = [];

  // Périmètre RBAC ∩ filtre "filiale" choisi par l'utilisateur (slicer) — jamais l'inverse :
  // le slicer ne peut jamais élargir l'accès au-delà du périmètre RBAC.
  let filialesEffectives = filialesAutorisees;
  if (filtres.filialeId && filtres.filialeId.length > 0) {
    filialesEffectives =
      filialesAutorisees === null ? filtres.filialeId : filialesAutorisees.filter((f) => filtres.filialeId!.includes(f));
  }
  if (filialesEffectives !== null) {
    valeurs.push(filialesEffectives);
    conditions.push(`e.filiale_id = ANY($${valeurs.length})`);
  }

  if (filtres.categorieProfessionnelle && filtres.categorieProfessionnelle.length > 0) {
    valeurs.push(filtres.categorieProfessionnelle);
    conditions.push(`e.categorie_professionnelle = ANY($${valeurs.length})`);
  }

  if (filtres.sexe && filtres.sexe.length > 0) {
    valeurs.push(filtres.sexe);
    conditions.push(`e.sexe = ANY($${valeurs.length})`);
  }

  if (filtres.typeContrat && filtres.typeContrat.length > 0) {
    valeurs.push(filtres.typeContrat);
    conditions.push(`c.type = ANY($${valeurs.length})`);
  }

  const { rows } = await pool.query(
    `SELECT e.sexe, e.nationalite, e.date_naissance, e.date_embauche, e.categorie_professionnelle,
            f.nom AS filiale, c.type AS type_contrat, c.salaire_base
     FROM employes e
     JOIN filiales f ON f.id = e.filiale_id
     LEFT JOIN contrats c ON c.employe_id = e.id AND c.statut = 'actif'
     WHERE ${conditions.join(' AND ')}`,
    valeurs
  );

  return rows.map((l) => ({
    sexe: l.sexe,
    nationalite: l.nationalite,
    dateNaissance: l.date_naissance,
    dateEmbauche: l.date_embauche,
    categorieProfessionnelle: l.categorie_professionnelle,
    filiale: l.filiale,
    typeContrat: l.type_contrat,
    salaireBase: l.salaire_base === null ? null : Number(l.salaire_base),
  }));
}

function calculerAge(dateNaissance: string, reference: Date): number {
  const naissance = new Date(dateNaissance);
  let age = reference.getFullYear() - naissance.getFullYear();
  const anniversairePasse =
    reference.getMonth() > naissance.getMonth() ||
    (reference.getMonth() === naissance.getMonth() && reference.getDate() >= naissance.getDate());
  if (!anniversairePasse) age -= 1;
  return age;
}

function calculerAncienneteAnnees(dateEmbauche: string, reference: Date): number {
  return calculerAge(dateEmbauche, reference); // même logique de différence en années complètes
}

const LIBELLES_CATEGORIE: Record<string, string> = {
  ouvrier: 'Ouvrier',
  employe: 'Employé',
  agent_maitrise: 'Agent de maîtrise',
  cadre: 'Cadre',
};

const NON_RENSEIGNE = 'Non renseigné';

function grouperParSexe(lignes: LigneEmploye[], cle: (l: LigneEmploye) => string) {
  const groupes = new Map<string, { hommes: number; femmes: number }>();

  for (const ligne of lignes) {
    const k = cle(ligne);
    const existant = groupes.get(k) ?? { hommes: 0, femmes: 0 };
    if (ligne.sexe === 'M') existant.hommes += 1;
    else existant.femmes += 1;
    groupes.set(k, existant);
  }

  return [...groupes.entries()]
    .map(([k, v]) => ({ cle: k, hommes: v.hommes, femmes: v.femmes, total: v.hommes + v.femmes }))
    .sort((a, b) => b.total - a.total);
}

// Paliers d'ancienneté non précisés dans la demande — grille RH courante retenue,
// cf. point signalé en session.
function palierAnciennete(annees: number): string {
  if (annees < 1) return '0-1 an';
  if (annees < 3) return '1-3 ans';
  if (annees < 5) return '3-5 ans';
  if (annees < 10) return '5-10 ans';
  if (annees < 15) return '10-15 ans';
  return '15 ans et +';
}

// Tranches fixes 15-19 à "60-64+" (dernier palier ouvert) — générées même vides, pour que
// la forme de la pyramide reste comparable d'un filtre à l'autre (contrairement aux autres
// graphiques où seules les catégories observées sont renvoyées).
const TRANCHES_AGE_FIXES: { label: string; borneBasse: number; borneHaute: number | null }[] = [
  { label: '15-19', borneBasse: 15, borneHaute: 19 },
  { label: '20-24', borneBasse: 20, borneHaute: 24 },
  { label: '25-29', borneBasse: 25, borneHaute: 29 },
  { label: '30-34', borneBasse: 30, borneHaute: 34 },
  { label: '35-39', borneBasse: 35, borneHaute: 39 },
  { label: '40-44', borneBasse: 40, borneHaute: 44 },
  { label: '45-49', borneBasse: 45, borneHaute: 49 },
  { label: '50-54', borneBasse: 50, borneHaute: 54 },
  { label: '55-59', borneBasse: 55, borneHaute: 59 },
  { label: '60-64+', borneBasse: 60, borneHaute: null },
];

export async function obtenirApercuRH(
  filialesAutorisees: string[] | null,
  filtres: FiltresRHOverview
): Promise<RHOverviewReponse> {
  const lignes = await chargerLignesFiltrees(filialesAutorisees, filtres);
  const maintenant = new Date();

  const hommes = lignes.filter((l) => l.sexe === 'M').length;
  const femmes = lignes.filter((l) => l.sexe === 'F').length;

  const remunerations = lignes.map((l) => l.salaireBase).filter((v): v is number => v !== null);
  const remunerationTotale = remunerations.reduce((s, v) => s + v, 0);
  const remunerationMoyenne = remunerations.length > 0 ? remunerationTotale / remunerations.length : 0;

  const parCategorie = grouperParSexe(
    lignes,
    (l) => LIBELLES_CATEGORIE[l.categorieProfessionnelle ?? ''] ?? NON_RENSEIGNE
  );

  const parNationalite = grouperParSexe(lignes, (l) => l.nationalite || NON_RENSEIGNE);

  const parEntreprise = grouperParSexe(lignes, (l) => l.filiale);

  const parTypeContrat = grouperParSexe(lignes, (l) => (l.typeContrat ? l.typeContrat.toUpperCase() : NON_RENSEIGNE));

  const parAnciennete = grouperParSexe(lignes, (l) => palierAnciennete(calculerAncienneteAnnees(l.dateEmbauche, maintenant)));

  const pyramideParTranche = new Map<string, { hommes: number; femmes: number }>();
  for (const ligne of lignes) {
    const age = calculerAge(ligne.dateNaissance, maintenant);
    if (age < 15) continue; // donnée aberrante (âge légal du travail), exclue plutôt qu'agrégée en silence
    const tranche = age >= 60 ? TRANCHES_AGE_FIXES[9] : TRANCHES_AGE_FIXES.find((t) => age <= t.borneHaute!)!;
    const existant = pyramideParTranche.get(tranche.label) ?? { hommes: 0, femmes: 0 };
    if (ligne.sexe === 'M') existant.hommes += 1;
    else existant.femmes += 1;
    pyramideParTranche.set(tranche.label, existant);
  }

  const pyramideAges = TRANCHES_AGE_FIXES.map((t) => ({
    tranche: t.label,
    borneBasse: t.borneBasse,
    hommes: pyramideParTranche.get(t.label)?.hommes ?? 0,
    femmes: pyramideParTranche.get(t.label)?.femmes ?? 0,
  }));

  return {
    kpi: {
      effectifTotal: lignes.length,
      effectifHommes: hommes,
      effectifFemmes: femmes,
      remunerationMoyenne,
      remunerationTotale,
    },
    sexe: { hommes, femmes },
    parCategorie,
    parNationalite,
    parEntreprise,
    parTypeContrat,
    parAnciennete,
    pyramideAges,
  };
}
