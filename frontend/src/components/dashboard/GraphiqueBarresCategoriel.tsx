import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EtatVide } from '../EtatVide';
import { IconeTableauxDeBord } from '../icones';
import { couleurPour } from './paletteCategorielle';
import { dureeAnimationGraphique } from '../../utils/reducedMotion';

interface Item {
  libelle: string;
  valeur: number;
}

interface Props {
  items: Item[];
  titre: string;
  /** Couleur par identité (ex. filiale) plutôt que par position — par défaut couleurPour(index). */
  couleur?: (libelle: string, index: number) => string;
}

function idDegrade(couleurHex: string): string {
  return `degrade-barre-${couleurHex.replace('#', '')}`;
}

export function GraphiqueBarresCategoriel({ items, titre, couleur = (_libelle, index) => couleurPour(index) }: Props) {
  const couleursUtilisees = [...new Set(items.map((item, index) => couleur(item.libelle, index)))];

  return (
    <div className="anim-cascade min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md">
      <h3 className="mb-4 text-sm font-semibold text-slate-800">{titre}</h3>
      {items.length === 0 ? (
        <EtatVide icone={<IconeTableauxDeBord />} titre="Aucune donnée" message="Rien à afficher pour la période sélectionnée." />
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(180, items.length * 42)}>
          <BarChart data={items} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
            <defs>
              {couleursUtilisees.map((c) => (
                <linearGradient key={c} id={idDegrade(c)} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={c} stopOpacity={0.85} />
                  <stop offset="100%" stopColor={c} stopOpacity={1} />
                </linearGradient>
              ))}
            </defs>
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
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
            />
            <Bar dataKey="valeur" radius={[0, 4, 4, 0]} maxBarSize={22} animationDuration={dureeAnimationGraphique(400)}>
              {items.map((item, index) => (
                <Cell key={item.libelle} fill={`url(#${idDegrade(couleur(item.libelle, index))})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
