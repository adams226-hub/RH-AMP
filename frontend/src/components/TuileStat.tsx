import { ReactNode } from 'react';
import { useCompteurAnime } from '../hooks/useCompteurAnime';
import { MiniSparkline } from './dashboard/MiniSparkline';

type Couleur = 'primary' | 'accent' | 'succes' | 'alerte' | 'erreur';

const STYLES: Record<Couleur, { bordure: string; iconeFond: string; iconeTexte: string; ombre: string; trait: string }> = {
  primary: {
    bordure: 'border-l-primary-600',
    iconeFond: 'bg-primary-100',
    iconeTexte: 'text-primary-700',
    ombre: 'hover:shadow-primary-600/10',
    trait: 'var(--color-primary-600)',
  },
  accent: {
    bordure: 'border-l-accent-600',
    iconeFond: 'bg-accent-100',
    iconeTexte: 'text-accent-700',
    ombre: 'hover:shadow-accent-600/10',
    trait: '#0d9488',
  },
  succes: {
    bordure: 'border-l-succes-600',
    iconeFond: 'bg-succes-100',
    iconeTexte: 'text-succes-700',
    ombre: 'hover:shadow-succes-600/10',
    trait: '#16a34a',
  },
  alerte: {
    bordure: 'border-l-alerte-600',
    iconeFond: 'bg-alerte-100',
    iconeTexte: 'text-alerte-700',
    ombre: 'hover:shadow-alerte-600/10',
    trait: '#d97706',
  },
  erreur: {
    bordure: 'border-l-erreur-600',
    iconeFond: 'bg-erreur-100',
    iconeTexte: 'text-erreur-700',
    ombre: 'hover:shadow-erreur-600/10',
    trait: '#dc2626',
  },
};

interface Variation {
  /** Variation en % vs la période de comparaison — signe porté par la valeur elle-même. */
  pourcent: number;
  /** Une hausse est-elle une bonne nouvelle pour ce KPI ? (faux pour un taux de turnover, par ex.) */
  haussePositive?: boolean;
}

interface Props {
  libelle: string;
  valeur: string | number;
  icone: ReactNode;
  couleur?: Couleur;
  delaiMs?: number;
  /** KPI principal (plus grand) vs secondaire (taille actuelle) — 3-4 KPI principaux max par page. */
  taille?: 'grande' | 'normale';
  variation?: Variation;
  /** Historique court (3 points ou plus) pour une mini-courbe de tendance — omis si absent. */
  sparkline?: number[];
}

// Compteur animé pour les valeurs numériques brutes (effectifs, nombres de sorties...) — les
// valeurs déjà formatées en chaîne (FCFA, pourcentages) restent statiques : les ré-animer
// nécessiterait de reformater à chaque frame, complexité non demandée pour un simple "sobre".
function ValeurAffichee({ valeur }: { valeur: string | number }) {
  const anime = useCompteurAnime(typeof valeur === 'number' ? valeur : 0);
  return <>{typeof valeur === 'number' ? anime : valeur}</>;
}

function PuceVariation({ variation }: { variation: Variation }) {
  const hausse = variation.pourcent >= 0;
  const bonneNouvelle = hausse === (variation.haussePositive ?? true);
  const couleur = bonneNouvelle ? 'text-succes-700 bg-succes-100' : 'text-erreur-700 bg-erreur-100';

  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${couleur}`}>
      {hausse ? '▲' : '▼'} {Math.abs(variation.pourcent).toFixed(1)} %
    </span>
  );
}

export function TuileStat({ libelle, valeur, icone, couleur = 'primary', delaiMs = 0, taille = 'normale', variation, sparkline }: Props) {
  const style = STYLES[couleur];
  const grande = taille === 'grande';

  return (
    <div
      className={`anim-cascade min-w-0 rounded-2xl border border-slate-200 border-l-4 bg-white shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md ${style.bordure} ${style.ombre} ${grande ? 'p-6' : 'p-5'}`}
      style={{ animationDelay: `${delaiMs}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`mb-3 flex items-center justify-center rounded-lg ${style.iconeFond} ${style.iconeTexte} ${grande ? 'h-11 w-11' : 'h-9 w-9'}`}>
          <span className={grande ? '[&>svg]:h-5 [&>svg]:w-5' : '[&>svg]:h-[18px] [&>svg]:w-[18px]'}>{icone}</span>
        </div>
        {variation && <PuceVariation variation={variation} />}
      </div>
      <p
        className={`font-bold tracking-tight text-slate-900 [font-variant-numeric:tabular-nums] ${grande ? 'text-3xl' : 'text-2xl'}`}
      >
        <ValeurAffichee valeur={valeur} />
      </p>
      <p className="mt-1 text-xs font-medium text-slate-500">{libelle}</p>
      {sparkline && sparkline.length >= 2 && (
        <div className="mt-2 -mx-1">
          <MiniSparkline valeurs={sparkline} couleur={style.trait} />
        </div>
      )}
    </div>
  );
}
