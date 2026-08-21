import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EtatVide } from '../EtatVide';
import { IconeEmployes } from '../icones';
import { RepartitionParSexe } from '../../types/rhOverview';

const COULEUR_FEMMES = '#0d9488';
const COULEUR_HOMMES = '#2563eb';

// Réutilisé pour Catégorie, Nationalité, Entreprise, Type de contrat, Ancienneté — toutes
// ventilées par sexe. N'affiche que les catégories réellement observées (jamais de barre à
// zéro forcée) : l'axe se redimensionne naturellement quand un filtre réduit le jeu de données.
export function GraphiqueBarresEmpilees({ titre, items }: { titre: string; items: RepartitionParSexe[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-800">{titre}</h3>
      {items.length === 0 ? (
        <EtatVide icone={<IconeEmployes />} titre="Aucune donnée" message="Aucun employé ne correspond aux filtres actifs." />
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(180, items.length * 40)}>
          <BarChart data={items} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
            <YAxis
              type="category"
              dataKey="cle"
              width={120}
              tick={{ fontSize: 12, fill: '#475569' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="femmes" name="Femmes" stackId="sexe" fill={COULEUR_FEMMES} radius={[0, 0, 0, 0]} maxBarSize={22} />
            <Bar dataKey="hommes" name="Hommes" stackId="sexe" fill={COULEUR_HOMMES} radius={[0, 4, 4, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
