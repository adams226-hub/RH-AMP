import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EtatVide } from '../EtatVide';
import { IconeEmployes } from '../icones';
import { TrancheAgeRH } from '../../types/rhOverview';

// Pyramide démographique : Homme à droite (valeurs positives), Femme à gauche (valeurs
// négatives pour l'affichage miroir) — sens explicitement demandé. Tranches fixes 15-19 à
// "60-64+" toujours affichées (même à 0) pour que la forme reste comparable d'un filtre à
// l'autre, contrairement aux autres graphiques de cette page.
export function GraphiquePyramideAges({ tranches }: { tranches: TrancheAgeRH[] }) {
  const totalGeneral = tranches.reduce((s, t) => s + t.hommes + t.femmes, 0);

  if (totalGeneral === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Pyramide des âges</h3>
        <EtatVide icone={<IconeEmployes />} titre="Aucune donnée" message="Aucun employé (15 ans et plus) ne correspond aux filtres actifs." />
      </div>
    );
  }

  const donnees = tranches.map((t) => ({ ...t, femmesAffichees: -t.femmes }));
  const maxValeur = Math.max(1, ...tranches.map((t) => Math.max(t.hommes, t.femmes)));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-800">Pyramide des âges</h3>
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={donnees} layout="vertical" stackOffset="sign" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis
            type="number"
            domain={[-maxValeur, maxValeur]}
            tickFormatter={(v: number) => `${Math.abs(v)}`}
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="tranche"
            width={56}
            tick={{ fontSize: 12, fill: '#475569' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
          />
          <Tooltip
            formatter={(valeur) => (typeof valeur === 'number' ? Math.abs(valeur) : valeur)}
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="femmesAffichees" name="Femmes" fill="#0d9488" radius={[4, 0, 0, 4]} maxBarSize={16} />
          <Bar dataKey="hommes" name="Hommes" fill="#2563eb" radius={[0, 4, 4, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
