import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EtatVide } from '../EtatVide';
import { IconeEmployes } from '../icones';
import { TrancheAgeRH } from '../../types/rhOverview';
import { dureeAnimationGraphique } from '../../utils/reducedMotion';

// Pyramide démographique : Homme à droite (valeurs positives), Femme à gauche (valeurs
// négatives pour l'affichage miroir) — sens explicitement demandé. Tranches fixes 15-19 à
// "60-64+" toujours affichées (même à 0) pour que la forme reste comparable d'un filtre à
// l'autre, contrairement aux autres graphiques de cette page.
export function GraphiquePyramideAges({ tranches }: { tranches: TrancheAgeRH[] }) {
  const totalGeneral = tranches.reduce((s, t) => s + t.hommes + t.femmes, 0);

  if (totalGeneral === 0) {
    return (
      <div className="anim-cascade min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Pyramide des âges</h3>
        <EtatVide icone={<IconeEmployes />} titre="Aucune donnée" message="Aucun employé (15 ans et plus) ne correspond aux filtres actifs." />
      </div>
    );
  }

  const donnees = tranches.map((t) => ({ ...t, femmesAffichees: -t.femmes }));
  const maxValeur = Math.max(1, ...tranches.map((t) => Math.max(t.hommes, t.femmes)));

  return (
    <div className="anim-cascade min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md">
      <h3 className="mb-4 text-sm font-semibold text-slate-800">Pyramide des âges</h3>
      <ResponsiveContainer width="100%" height={340}>
        <BarChart
          data={donnees}
          layout="vertical"
          stackOffset="sign"
          barCategoryGap={0}
          barGap={0}
          margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
        >
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
            orientation="left"
            width={56}
            tick={{ fontSize: 12, fill: '#475569' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
          />
          <Tooltip
            formatter={(valeur) => (typeof valeur === 'number' ? Math.abs(valeur) : valeur)}
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {/* Pas de maxBarSize ici : chaque tranche doit remplir toute sa bande verticale pour
              que les barres soient jointives ("gradins"), sans coins arrondis (radius 0) ni
              espace entre tranches (barCategoryGap/barGap à 0 ci-dessus). */}
          <Bar dataKey="femmesAffichees" name="Femmes" fill="#0d9488" radius={0} animationDuration={dureeAnimationGraphique(400)}>
            <LabelList
              dataKey="femmesAffichees"
              position="insideLeft"
              fill="#fff"
              fontSize={11}
              formatter={(v) => (typeof v === 'number' && v !== 0 ? Math.abs(v) : '')}
            />
          </Bar>
          <Bar dataKey="hommes" name="Hommes" fill="var(--color-primary-600)" radius={0} animationDuration={dureeAnimationGraphique(400)}>
            <LabelList
              dataKey="hommes"
              position="insideRight"
              fill="#fff"
              fontSize={11}
              formatter={(v) => (typeof v === 'number' && v !== 0 ? v : '')}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
