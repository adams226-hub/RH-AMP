export type StatutCyclePaie = 'ouvert' | 'calcule' | 'verifie' | 'exporte' | 'cloture';

export interface CyclePaie {
  id: string;
  moisPaie: string;
  filialeId: string;
  statut: StatutCyclePaie;
  calculeLe: string | null;
  verifiePar: string | null;
  verifieLe: string | null;
  exporteLe: string | null;
  cloturePar: string | null;
  clotureLe: string | null;
  reouvertPar: string | null;
  reouvertLe: string | null;
}

// Chiffres affichés sur l'écran de lancement/revue (ADDENDUM_JOURNAL_PAIE_AMP.md §5) —
// nbEmployesSansElements est purement informatif (⚠️), il ne filtre jamais qui est calculé.
export interface ResumeCyclePaie extends CyclePaie {
  nbEmployesAvecElements: number;
  nbEmployesSansElements: number;
  nbBulletinsCalcules: number;
  totalNetAPayer: number;
}

export type GroupePar = 'mode_paiement';
