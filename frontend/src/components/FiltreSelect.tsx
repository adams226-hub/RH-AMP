export function FiltreSelect({
  valeur,
  onChange,
  options,
  toutLibelle = 'Tous',
}: {
  valeur: string;
  onChange: (v: string) => void;
  options: { valeur: string; libelle: string }[];
  toutLibelle?: string;
}) {
  return (
    <select
      value={valeur}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
    >
      <option value="">{toutLibelle}</option>
      {options.map((o) => (
        <option key={o.valeur} value={o.valeur}>
          {o.libelle}
        </option>
      ))}
    </select>
  );
}
