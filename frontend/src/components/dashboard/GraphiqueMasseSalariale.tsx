import { useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EtatVide } from '../EtatVide';
import { IconePaie } from '../icones';
import { MasseSalarialeMois } from '../../types/tableauDeBord';
import { couleurPour } from './paletteCategorielle';

function formaterFCFACourt(valeur: number) {
  if (valeur >= 1_000_000) return `${(valeur / 1_000_000).toFixed(1)} M`;
  if (valeur >= 1_000) return `${Math.round(valeur / 1_000)} K`;
  return `${valeur}`;
}

export function GraphiqueMasseSalariale({ mois }: { mois: MasseSalarialeMois[] }) {
  const societes = useMemo(() => {
    const noms = new Set<string>();
    mois.forEach((m) => m.parSociete.forEach((s) => noms.add(s.filiale)));
    return [...noms].sort();
  }, [mois]);

  const donnees = useMemo(
    () =>
      mois.map((m) => {
        const ligne: Record<string, number | string> = { periode: m.periode };
        m.parSociete.forEach((s) => {
          ligne[s.filiale] = s.totalBrut;
        });
        return ligne;
      }),
    [mois]
  );

  const auMoinsUneValeur = mois.some((m) => m.total > 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-800">Masse salariale mensuelle par société</h3>
      {!auMoinsUneValeur ? (
        <EtatVide icone={<IconePaie />} titre="Aucun bulletin sur la période" message="Calculez des bulletins de paie pour voir la courbe se remplir." />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={donnees} margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="periode" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
            <YAxis
              tickFormatter={formaterFCFACourt}
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
              width={48}
            />
            <Tooltip
              formatter={(valeur) => (typeof valeur === 'number' ? `${valeur.toLocaleString('fr-FR')} F CFA` : String(valeur))}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {societes.map((societe, index) => (
              <Line
                key={societe}
                type="monotone"
                dataKey={societe}
                stroke={couleurPour(index)}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
