import { MiseEnPage } from './MiseEnPage';

export function AccesRestreint() {
  return (
    <MiseEnPage>
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-erreur-100 text-erreur-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 118 0v4" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-700">Accès restreint</p>
        <p className="max-w-xs text-xs text-slate-500">Votre rôle ne permet pas d'accéder à ce module.</p>
      </div>
    </MiseEnPage>
  );
}
