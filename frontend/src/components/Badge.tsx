export type CouleurBadge = 'succes' | 'alerte' | 'erreur' | 'primary' | 'accent' | 'slate';

const STYLES: Record<CouleurBadge, string> = {
  succes: 'bg-succes-100 text-succes-700',
  alerte: 'bg-alerte-100 text-alerte-700',
  erreur: 'bg-erreur-100 text-erreur-700',
  primary: 'bg-primary-100 text-primary-700',
  accent: 'bg-accent-100 text-accent-700',
  slate: 'bg-slate-200 text-slate-600',
};

export function Badge({ couleur, children }: { couleur: CouleurBadge; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[couleur]}`}>
      {children}
    </span>
  );
}
