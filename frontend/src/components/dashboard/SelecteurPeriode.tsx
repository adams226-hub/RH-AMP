const CHAMP =
  'rounded-md border border-slate-300 px-2.5 py-1.5 text-sm transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';

// Pilote tous les indicateurs de la page à partir d'une seule plage de mois — contrairement
// au fichier Excel source qui avait des colonnes mensuelles figées (Janvier à Juillet).
export function SelecteurPeriode({
  periodeDebut,
  periodeFin,
  onChangeDebut,
  onChangeFin,
}: {
  periodeDebut: string;
  periodeFin: string;
  onChangeDebut: (v: string) => void;
  onChangeFin: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Période</span>
      <input type="month" value={periodeDebut} onChange={(e) => onChangeDebut(e.target.value)} className={CHAMP} />
      <span className="text-slate-400">→</span>
      <input type="month" value={periodeFin} onChange={(e) => onChangeFin(e.target.value)} className={CHAMP} />
    </div>
  );
}
