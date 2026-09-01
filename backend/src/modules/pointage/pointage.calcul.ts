import { CodeAbsencePointage } from './pointage.types';

// Règles fournies par la DRH (source CARTE_POINTAGE / LOGICIEL_SALAIRES.xlsm), appliquées à
// l'identique — rien inventé ici :
//   HN   = MIN(heures hors dimanche/férié, 40) par semaine calendaire (lundi→dimanche)
//   H15% = tranche entre la 40e et la 48e heure de la semaine (8h max), hors dimanche/férié
//   H35% = tout ce qui dépasse la 48e heure de la semaine, hors dimanche/férié
//   H60% = heures travaillées un dimanche OU un jour férié, quel que soit le total de la semaine
//   Panier = 1 jour par jour où les heures pointées ce jour-là sont >= 10h
// H50%/H120% restent hors périmètre : saisis manuellement dans Éléments du mois (cas exceptionnels).
const PLAFOND_HEURES_NORMALES_SEMAINE = 40;
const PLAFOND_HEURES_15_SEMAINE = 8;
const SEUIL_PANIER_HEURES = 10;

export interface JourPointageCalcul {
  date: string; // 'YYYY-MM-DD'
  heures: number | null;
  codeAbsence: CodeAbsencePointage | null;
}

export interface ResultatCalculPointage {
  heuresNormales: number;
  heuresHs15: number;
  heuresHs35: number;
  heuresHs60: number;
  joursPanier: number;
  nbJoursAbsenceInjustifiee: number;
  nbJoursReposMedical: number;
  nbJoursPermissionNonPayee: number;
  nbJoursPermissionPayee: number;
  nbJoursCongeAnnuel: number;
}

function estDimancheOuFerie(date: string, joursFeries: ReadonlySet<string>): boolean {
  const jourSemaine = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = dimanche
  return jourSemaine === 0 || joursFeries.has(date);
}

// Clé de regroupement hebdomadaire : le lundi de la semaine calendaire contenant `date`.
function cleSemaine(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const decalage = (d.getUTCDay() + 6) % 7; // 0 = lundi
  d.setUTCDate(d.getUTCDate() - decalage);
  return d.toISOString().slice(0, 10);
}

export function calculerPointageDepuisJours(
  jours: JourPointageCalcul[],
  joursFeries: ReadonlySet<string>
): ResultatCalculPointage {
  const semaines = new Map<string, { horsDimancheFerie: number; dimancheFerie: number }>();
  let joursPanier = 0;

  const compteursAbsence: Record<CodeAbsencePointage, number> = {
    absence_injustifiee: 0,
    repos_medical: 0,
    permission_non_payee: 0,
    permission_payee: 0,
    conge_annuel: 0,
    ferie: 0,
  };

  for (const jour of jours) {
    if (jour.codeAbsence) {
      compteursAbsence[jour.codeAbsence] += 1;
      continue;
    }
    if (jour.heures === null || jour.heures === undefined) continue;

    if (jour.heures >= SEUIL_PANIER_HEURES) joursPanier += 1;

    const cle = cleSemaine(jour.date);
    const entree = semaines.get(cle) ?? { horsDimancheFerie: 0, dimancheFerie: 0 };
    if (estDimancheOuFerie(jour.date, joursFeries)) {
      entree.dimancheFerie += jour.heures;
    } else {
      entree.horsDimancheFerie += jour.heures;
    }
    semaines.set(cle, entree);
  }

  let heuresNormales = 0;
  let heuresHs15 = 0;
  let heuresHs35 = 0;
  let heuresHs60 = 0;

  for (const { horsDimancheFerie, dimancheFerie } of semaines.values()) {
    heuresNormales += Math.min(horsDimancheFerie, PLAFOND_HEURES_NORMALES_SEMAINE);
    const excedent = Math.max(horsDimancheFerie - PLAFOND_HEURES_NORMALES_SEMAINE, 0);
    heuresHs15 += Math.min(excedent, PLAFOND_HEURES_15_SEMAINE);
    heuresHs35 += Math.max(excedent - PLAFOND_HEURES_15_SEMAINE, 0);
    heuresHs60 += dimancheFerie;
  }

  return {
    heuresNormales,
    heuresHs15,
    heuresHs35,
    heuresHs60,
    joursPanier,
    nbJoursAbsenceInjustifiee: compteursAbsence.absence_injustifiee,
    nbJoursReposMedical: compteursAbsence.repos_medical,
    nbJoursPermissionNonPayee: compteursAbsence.permission_non_payee,
    nbJoursPermissionPayee: compteursAbsence.permission_payee,
    nbJoursCongeAnnuel: compteursAbsence.conge_annuel,
  };
}
