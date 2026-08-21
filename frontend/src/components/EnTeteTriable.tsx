export function EnTeteTriable<T>({
  label,
  cleColonne,
  cleActive,
  sens,
  onTrier,
}: {
  label: string;
  cleColonne: keyof T;
  cleActive: keyof T | null;
  sens: 'asc' | 'desc';
  onTrier: (cle: keyof T) => void;
}) {
  const actif = cleActive === cleColonne;

  return (
    <th className="px-4 py-3">
      <button
        onClick={() => onTrier(cleColonne)}
        className="flex items-center gap-1 transition-colors duration-200 hover:text-slate-800"
      >
        {label}
        <span className={`text-[10px] ${actif ? 'text-primary-600' : 'text-slate-300'}`}>
          {actif && sens === 'desc' ? '▼' : '▲'}
        </span>
      </button>
    </th>
  );
}
