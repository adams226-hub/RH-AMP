import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EtatVide } from '../EtatVide';
import { IconeTableauxDeBord } from '../icones';
import { couleurPour } from './paletteCategorielle';

interface Item {
  libelle: string;
  valeur: number;
}

export function GraphiqueBarresCategoriel({ items, titre }: { items: Item[]; titre: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-800">{titre}</h3>
      {items.length === 0 ? (
        <EtatVide icone={<IconeTableauxDeBord />} titre="Aucune donnée" message="Rien à afficher pour la période sélectionnée." />
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(180, items.length * 42)}>
          <BarChart data={items} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
            <YAxis
              type="category"
              dataKey="libelle"
              width={110}
              tick={{ fontSize: 12, fill: '#475569' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: '#f1f5f9' }}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
            />
            <Bar dataKey="valeur" radius={[0, 4, 4, 0]} maxBarSize={22}>
              {items.map((item, index) => (
                <Cell key={item.libelle} fill={couleurPour(index)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
