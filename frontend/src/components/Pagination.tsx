export function Pagination({
  page,
  totalPages,
  onChange,
  totalItems,
  parPage,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  totalItems: number;
  parPage: number;
}) {
  if (totalItems === 0) return null;

  const debut = (page - 1) * parPage + 1;
  const fin = Math.min(page * parPage, totalItems);

  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
      <span>
        {debut}–{fin} sur {totalItems}
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium transition-colors duration-200 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
        >
          Précédent
        </button>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium transition-colors duration-200 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
        >
          Suivant
        </button>
      </div>
    </div>
  );
}
