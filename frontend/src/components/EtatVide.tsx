import { ReactNode } from 'react';

export function EtatVide({ icone, titre, message }: { icone: ReactNode; titre: string; message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <span className="[&>svg]:h-6 [&>svg]:w-6">{icone}</span>
      </div>
      <p className="text-sm font-medium text-slate-700">{titre}</p>
      <p className="max-w-xs text-xs text-slate-500">{message}</p>
    </div>
  );
}
