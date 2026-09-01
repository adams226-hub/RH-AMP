const JOUR_MS = 24 * 60 * 60 * 1000;

function versUTC(dateIso: string): number {
  const [a, m, j] = dateIso.slice(0, 10).split('-').map(Number);
  return Date.UTC(a, m - 1, j);
}

function depuisUTC(temps: number): string {
  const d = new Date(temps);
  const a = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const j = String(d.getUTCDate()).padStart(2, '0');
  return `${a}-${m}-${j}`;
}

// Regroupe les jours de [debut, fin] en semaines calendaires lundi→dimanche, jusqu'à 6 semaines —
// même logique que la fiche PDF (pointage.pdf.ts côté backend). Cellule hors période = null.
export function construireSemaines(debut: string, fin: string): (string | null)[][] {
  const t0 = versUTC(debut);
  const t1 = versUTC(fin);
  const jourSemaineDebut = (new Date(t0).getUTCDay() + 6) % 7; // 0 = lundi
  let curseur = t0 - jourSemaineDebut * JOUR_MS;

  const semaines: (string | null)[][] = [];
  while (curseur <= t1) {
    const semaine: (string | null)[] = [];
    for (let i = 0; i < 7; i++) {
      semaine.push(curseur >= t0 && curseur <= t1 ? depuisUTC(curseur) : null);
      curseur += JOUR_MS;
    }
    semaines.push(semaine);
  }
  return semaines;
}

export function quantiemeDuMois(dateIso: string): number {
  return Number(dateIso.slice(8, 10));
}
