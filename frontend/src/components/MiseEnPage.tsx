import { ReactNode, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GROUPES } from '../nav';
import { BarreSuperieure } from './BarreSuperieure';
import { IconeFermer } from './icones';

export function MiseEnPage({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  const [menuMobileOuvert, setMenuMobileOuvert] = useState(false);
  const groupesVisibles = GROUPES.map((groupe) => ({
    ...groupe,
    liens: groupe.liens.filter((lien) => !lien.roles || (role && lien.roles.includes(role))),
  })).filter((groupe) => groupe.liens.length > 0);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Fond semi-transparent derrière le tiroir sur mobile — cliquer dessus referme le menu,
          comme sur tout menu latéral mobile standard. Absent sur desktop (md:hidden), où la
          sidebar reste statique et ce fond n'a pas de sens. */}
      {menuMobileOuvert && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 md:hidden"
          onClick={() => setMenuMobileOuvert(false)}
          aria-hidden="true"
        />
      )}

      {/* Sous md (768px) : tiroir en position fixe, masqué hors écran par défaut (-translate-x-full),
          ouvert par le bouton hamburger de BarreSuperieure. À partir de md : redevient la sidebar
          statique toujours visible d'origine (comportement bureau inchangé, demande explicite). */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar-bg transition-transform duration-200 ease-in-out md:static md:z-auto md:w-60 md:translate-x-0 ${
          menuMobileOuvert ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 px-4 py-5 md:px-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-bold text-primary-600">
            AH
          </div>
          <span className="font-semibold text-sidebar-heading">RH AMP Holding</span>
          <button
            type="button"
            onClick={() => setMenuMobileOuvert(false)}
            className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-sidebar-text transition-colors duration-200 hover:bg-sidebar-bg-hover md:hidden"
            aria-label="Fermer le menu"
          >
            <IconeFermer className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-4 px-2 py-2 md:px-3">
          {groupesVisibles.map((groupe) => (
            <div key={groupe.titre}>
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-text/70">
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
                      onClick={() => setMenuMobileOuvert(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-in-out ${
                          isActive
                            ? 'bg-sidebar-bg-actif text-primary-600 shadow-sm shadow-black/10'
                            : 'text-sidebar-text hover:bg-sidebar-bg-hover hover:text-sidebar-text-hover'
                        }`
                      }
                    >
                      <Icone className="h-[18px] w-[18px] shrink-0" />
                      <span>{lien.libelle}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <BarreSuperieure onOuvrirMenu={() => setMenuMobileOuvert(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
