import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { EtatVide } from '../EtatVide';
import { IconeEmployes } from '../icones';
import { dureeAnimationGraphique } from '../../utils/reducedMotion';

const COULEUR_FEMMES = '#0d9488'; // accent
const COULEUR_HOMMES = 'var(--color-primary-600)'; // primary

export function GraphiqueDonutSexe({ hommes, femmes }: { hommes: number; femmes: number }) {
  const total = hommes + femmes;
  const donnees = [
    { name: 'Femmes', value: femmes },
    { name: 'Hommes', value: hommes },
  ];

  return (
    <div className="anim-cascade min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md">
      <h3 className="mb-4 text-sm font-semibold text-slate-800">Répartition par sexe</h3>
      {total === 0 ? (
        <EtatVide icone={<IconeEmployes />} titre="Aucune donnée" message="Aucun employé ne correspond aux filtres actifs." />
      ) : (
        <div className="relative">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <defs>
                <linearGradient id="degradeFemmes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COULEUR_FEMMES} stopOpacity={1} />
                  <stop offset="100%" stopColor={COULEUR_FEMMES} stopOpacity={0.75} />
                </linearGradient>
                <linearGradient id="degradeHommes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COULEUR_HOMMES} stopOpacity={1} />
                  <stop offset="100%" stopColor={COULEUR_HOMMES} stopOpacity={0.75} />
                </linearGradient>
              </defs>
              <Pie
                data={donnees}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                strokeWidth={0}
                animationDuration={dureeAnimationGraphique(400)}
              >
                <Cell fill="url(#degradeFemmes)" />
                <Cell fill="url(#degradeHommes)" />
              </Pie>
              <Tooltip
                formatter={(valeur, nom) => [`${valeur} (${(((valeur as number) / total) * 100).toFixed(0)} %)`, nom]}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-6">
            <span className="text-2xl font-bold text-slate-900 [font-variant-numeric:tabular-nums]">{total}</span>
            <span className="text-xs text-slate-500">employés</span>
          </div>
        </div>
      )}
    </div>
  );
}
