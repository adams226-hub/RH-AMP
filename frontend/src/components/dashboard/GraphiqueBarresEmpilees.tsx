import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EtatVide } from '../EtatVide';
import { IconeEmployes } from '../icones';
import { RepartitionParSexe } from '../../types/rhOverview';
import { dureeAnimationGraphique } from '../../utils/reducedMotion';

const COULEUR_FEMMES = '#0d9488';
const COULEUR_HOMMES = 'var(--color-primary-600)';

// Réutilisé pour Catégorie, Nationalité, Entreprise, Type de contrat, Ancienneté — toutes
// ventilées par sexe. N'affiche que les catégories réellement observées (jamais de barre à
// zéro forcée) : l'axe se redimensionne naturellement quand un filtre réduit le jeu de données.
export function GraphiqueBarresEmpilees({ titre, items }: { titre: string; items: RepartitionParSexe[] }) {
  const categorieUnique = items.length === 1 ? items[0] : null;

  return (
    <div className="anim-cascade min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md">
      <h3 className="mb-4 text-sm font-semibold text-slate-800">{titre}</h3>
      {items.length === 0 ? (
        <EtatVide icone={<IconeEmployes />} titre="Aucune donnée" message="Aucun employé ne correspond aux filtres actifs." />
      ) : categorieUnique ? (
        // Une seule catégorie observée : un graphique à une barre n'apporte rien — un chiffre
        // simple est plus lisible, avec un message dédié quand la catégorie elle-même signale
        // une donnée manquante plutôt qu'un vrai filtre (ex. "Non renseigné").
        <div className="flex flex-col items-center justify-center gap-1 py-6 text-center">
          <p className="text-3xl font-bold tracking-tight text-slate-900 [font-variant-numeric:tabular-nums]">
            {categorieUnique.total}
          </p>
          <p className="text-sm font-medium text-slate-600">{categorieUnique.cle}</p>
          <p className="text-xs text-slate-400">
            {categorieUnique.cle === 'Non renseigné'
              ? 'Donnée à compléter sur les fiches employé.'
              : `${categorieUnique.femmes} femme(s) · ${categorieUnique.hommes} homme(s)`}
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(180, items.length * 40)}>
          <BarChart data={items} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
            <defs>
              <linearGradient id="degradeFemmesBarre" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={COULEUR_FEMMES} stopOpacity={0.85} />
                <stop offset="100%" stopColor={COULEUR_FEMMES} stopOpacity={1} />
              </linearGradient>
              <linearGradient id="degradeHommesBarre" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={COULEUR_HOMMES} stopOpacity={0.85} />
                <stop offset="100%" stopColor={COULEUR_HOMMES} stopOpacity={1} />
              </linearGradient>
            </defs>
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
            <Tooltip
              cursor={{ fill: '#f1f5f9' }}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="femmes" name="Femmes" stackId="sexe" fill="url(#degradeFemmesBarre)" radius={[0, 0, 0, 0]} maxBarSize={22} animationDuration={dureeAnimationGraphique(400)} />
            <Bar dataKey="hommes" name="Hommes" stackId="sexe" fill="url(#degradeHommesBarre)" radius={[0, 4, 4, 0]} maxBarSize={22} animationDuration={dureeAnimationGraphique(400)} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
