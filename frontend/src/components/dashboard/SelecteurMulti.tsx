import { useEffect, useRef, useState } from 'react';

interface Option {
  valeur: string;
  libelle: string;
}

export function SelecteurMulti({
  libelle,
  options,
  valeurs,
  onChange,
}: {
  libelle: string;
  options: Option[];
  valeurs: string[];
  onChange: (valeurs: string[]) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function surClicExterieur(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false);
    }
    document.addEventListener('mousedown', surClicExterieur);
    return () => document.removeEventListener('mousedown', surClicExterieur);
  }, []);

  function basculer(valeur: string) {
    onChange(valeurs.includes(valeur) ? valeurs.filter((v) => v !== valeur) : [...valeurs, valeur]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOuvert((v) => !v)}
        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors duration-200 ${
          valeurs.length > 0
            ? 'border-primary-400 bg-primary-50 text-primary-700'
            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
        }`}
      >
        {libelle}
        {valeurs.length > 0 && (
          <span className="rounded-full bg-primary-600 px-1.5 text-xs font-medium text-white">{valeurs.length}</span>
        )}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-3.5 w-3.5">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {ouvert && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          {options.map((o) => (
            <label
              key={o.valeur}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-200 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={valeurs.includes(o.valeur)}
                onChange={() => basculer(o.valeur)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              {o.libelle}
            </label>
          ))}
          {options.length === 0 && <p className="px-2 py-1.5 text-xs text-slate-400">Aucune option.</p>}
        </div>
      )}
    </div>
  );
}
