import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { EtatVide } from '../EtatVide';
import { IconeEmployes } from '../icones';

const COULEUR_FEMMES = '#0d9488'; // accent
const COULEUR_HOMMES = '#2563eb'; // primary

export function GraphiqueDonutSexe({ hommes, femmes }: { hommes: number; femmes: number }) {
  const total = hommes + femmes;
  const donnees = [
    { name: 'Femmes', value: femmes },
    { name: 'Hommes', value: hommes },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-800">Répartition par sexe</h3>
      {total === 0 ? (
        <EtatVide icone={<IconeEmployes />} titre="Aucune donnée" message="Aucun employé ne correspond aux filtres actifs." />
      ) : (
        <div className="relative">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={donnees} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3} strokeWidth={0}>
                <Cell fill={COULEUR_FEMMES} />
                <Cell fill={COULEUR_HOMMES} />
              </Pie>
              <Tooltip
                formatter={(valeur, nom) => [`${valeur} (${(((valeur as number) / total) * 100).toFixed(0)} %)`, nom]}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-6">
            <span className="text-2xl font-bold text-slate-900">{total}</span>
            <span className="text-xs text-slate-500">employés</span>
          </div>
        </div>
      )}
    </div>
  );
}
