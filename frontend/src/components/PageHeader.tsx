import { ReactNode } from 'react';

interface Props {
  titre: string;
  sousTitre?: string;
  actions?: ReactNode;
}

// Remplace le <h2>/<p> + boutons répété en haut de chaque page — même structure partout.
export function PageHeader({ titre, sousTitre, actions }: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{titre}</h2>
        {sousTitre && <p className="text-sm text-slate-500">{sousTitre}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
