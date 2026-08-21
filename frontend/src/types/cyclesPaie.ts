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

export interface ResumeCyclePaie extends CyclePaie {
  nbEmployesAvecElements: number;
  nbEmployesSansElements: number;
  nbBulletinsCalcules: number;
  totalNetAPayer: number;
}
