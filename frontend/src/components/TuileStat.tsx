import { ReactNode } from 'react';

type Couleur = 'primary' | 'accent' | 'succes' | 'alerte' | 'erreur';

const STYLES: Record<Couleur, { bordure: string; iconeFond: string; iconeTexte: string; ombre: string }> = {
  primary: {
    bordure: 'border-l-primary-600',
    iconeFond: 'bg-primary-100',
    iconeTexte: 'text-primary-700',
    ombre: 'hover:shadow-primary-600/10',
  },
  accent: {
    bordure: 'border-l-accent-600',
    iconeFond: 'bg-accent-100',
    iconeTexte: 'text-accent-700',
    ombre: 'hover:shadow-accent-600/10',
  },
  succes: {
    bordure: 'border-l-succes-600',
    iconeFond: 'bg-succes-100',
    iconeTexte: 'text-succes-700',
    ombre: 'hover:shadow-succes-600/10',
  },
  alerte: {
    bordure: 'border-l-alerte-600',
    iconeFond: 'bg-alerte-100',
    iconeTexte: 'text-alerte-700',
    ombre: 'hover:shadow-alerte-600/10',
  },
  erreur: {
    bordure: 'border-l-erreur-600',
    iconeFond: 'bg-erreur-100',
    iconeTexte: 'text-erreur-700',
    ombre: 'hover:shadow-erreur-600/10',
  },
};

interface Props {
  libelle: string;
  valeur: string | number;
  icone: ReactNode;
  couleur?: Couleur;
  delaiMs?: number;
}

export function TuileStat({ libelle, valeur, icone, couleur = 'primary', delaiMs = 0 }: Props) {
  const style = STYLES[couleur];

  return (
    <div
      className={`anim-cascade rounded-2xl border border-slate-200 border-l-4 bg-white p-5 shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md ${style.bordure} ${style.ombre}`}
      style={{ animationDelay: `${delaiMs}ms` }}
    >
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${style.iconeFond} ${style.iconeTexte}`}>
        <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]">{icone}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight text-slate-900 [font-variant-numeric:tabular-nums]">{valeur}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{libelle}</p>
    </div>
  );
}
