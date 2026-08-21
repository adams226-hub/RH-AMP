import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { CodeRole, useAuth } from '../context/AuthContext';
import {
  IconeAbsences,
  IconeArchivage,
  IconeAudit,
  IconeConges,
  IconeMissions,
  IconeContrats,
  IconeCyclePaie,
  IconeDeconnexion,
  IconeEmployes,
  IconePaie,
  IconeParametres,
  IconePointage,
  IconePostes,
  IconeSimulateur,
  IconeTableauxDeBord,
} from './icones';

interface LienNav {
  vers: string;
  libelle: string;
  icone: (props: { className?: string }) => JSX.Element;
  roles?: CodeRole[];
}

const LIENS: LienNav[] = [
  { vers: '/employes', libelle: 'Employés', icone: IconeEmployes },
  { vers: '/postes', libelle: 'Postes', icone: IconePostes, roles: ['super_admin', 'drh_holding', 'rh_filiale'] },
  { vers: '/contrats', libelle: 'Contrats', icone: IconeContrats, roles: ['super_admin', 'drh_holding', 'rh_filiale'] },
  { vers: '/conges', libelle: 'Congés', icone: IconeConges },
  { vers: '/absences', libelle: 'Absences', icone: IconeAbsences },
  { vers: '/missions', libelle: 'Missions', icone: IconeMissions },
  {
    vers: '/pointage',
    libelle: 'Pointage',
    icone: IconePointage,
    roles: ['super_admin', 'drh_holding', 'rh_filiale', 'responsable_rh_chantier'],
  },
  {
    vers: '/paie',
    libelle: 'Paie',
    icone: IconePaie,
    roles: ['super_admin', 'drh_holding', 'rh_filiale', 'employe'],
  },
  {
    vers: '/cycle-paie',
    libelle: 'Cycle de paie',
    icone: IconeCyclePaie,
    roles: ['super_admin', 'drh_holding', 'rh_filiale'],
  },
  {
    vers: '/simulateur',
    libelle: 'Simulateur',
    icone: IconeSimulateur,
    roles: ['super_admin', 'drh_holding', 'rh_filiale'],
  },
  {
    vers: '/archivage',
    libelle: 'Archivage',
    icone: IconeArchivage,
    roles: ['super_admin', 'drh_holding', 'rh_filiale', 'employe'],
  },
  {
    vers: '/tableaux-de-bord',
    libelle: 'Tableaux de bord',
    icone: IconeTableauxDeBord,
    roles: ['super_admin', 'drh_holding', 'rh_filiale', 'chef_service'],
  },
  { vers: '/audit', libelle: 'Audit', icone: IconeAudit, roles: ['super_admin'] },
  {
    vers: '/parametres',
    libelle: 'Paramètres',
    icone: IconeParametres,
    roles: ['super_admin', 'drh_holding', 'rh_filiale'],
  },
];

export function MiseEnPage({ children }: { children: ReactNode }) {
  const { role, deconnecter } = useAuth();
  const liensVisibles = LIENS.filter((lien) => !lien.roles || (role && lien.roles.includes(role)));

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-16 shrink-0 flex-col border-r border-slate-200 bg-white md:w-60">
        <div className="flex items-center gap-2 px-3 py-5 md:px-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-700 text-sm font-bold text-white">
            AH
          </div>
          <span className="hidden font-semibold text-slate-800 md:inline">SIRH AMP Holding</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-2 md:px-3">
          {liensVisibles.map((lien) => {
            const Icone = lien.icone;
            return (
              <NavLink
                key={lien.vers}
                to={lien.vers}
                title={lien.libelle}
                className={({ isActive }) =>
                  `flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-in-out md:justify-start ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/30'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icone className="h-[18px] w-[18px] shrink-0" />
                <span className="hidden md:inline">{lien.libelle}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 px-2 py-3 md:px-3">
          <button
            onClick={deconnecter}
            title="Déconnexion"
            className="flex w-full items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition-all duration-200 ease-in-out hover:bg-red-50 hover:text-erreur-600 md:justify-start"
          >
            <IconeDeconnexion className="h-[18px] w-[18px] shrink-0" />
            <span className="hidden md:inline">Déconnexion</span>
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
