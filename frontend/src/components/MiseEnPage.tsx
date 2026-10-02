import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GROUPES } from '../nav';
import { BarreSuperieure } from './BarreSuperieure';

export function MiseEnPage({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  const groupesVisibles = GROUPES.map((groupe) => ({
    ...groupe,
    liens: groupe.liens.filter((lien) => !lien.roles || (role && lien.roles.includes(role))),
  })).filter((groupe) => groupe.liens.length > 0);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="flex h-full w-16 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar-bg md:w-60">
        <div className="flex items-center gap-2 px-3 py-5 md:px-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-bold text-primary-600">
            AH
          </div>
          <span className="hidden font-semibold text-sidebar-heading md:inline">RH AMP Holding</span>
        </div>

        <nav className="flex flex-1 flex-col gap-4 px-2 py-2 md:px-3">
          {groupesVisibles.map((groupe) => (
            <div key={groupe.titre}>
              <p className="hidden px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-text/70 md:block">
                {groupe.titre}
              </p>
              <div className="flex flex-col gap-1">
                {groupe.liens.map((lien) => {
                  const Icone = lien.icone;
                  return (
                    <NavLink
                      key={lien.vers}
                      to={lien.vers}
                      title={lien.libelle}
                      className={({ isActive }) =>
                        `flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-in-out md:justify-start ${
                          isActive
                            ? 'bg-sidebar-bg-actif text-primary-600 shadow-sm shadow-black/10'
                            : 'text-sidebar-text hover:bg-sidebar-bg-hover hover:text-sidebar-text-hover'
                        }`
                      }
                    >
                      <Icone className="h-[18px] w-[18px] shrink-0" />
                      <span className="hidden md:inline">{lien.libelle}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <BarreSuperieure />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
