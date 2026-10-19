import { CodeRole } from './context/AuthContext';
import { ModuleRh, ROLES_GESTIONNAIRES, estGestionnaire, moduleOuvert } from './permissions';
import {
  IconeAbsences,
  IconeAttestations,
  IconeAudit,
  IconeConges,
  IconeMissions,
  IconeContrats,
  IconeCyclePaie,
  IconeEmployes,
  IconePaie,
  IconeParametres,
  IconePointage,
  IconeSimulateur,
  IconeTableauxDeBord,
} from './components/icones';

export interface LienNav {
  vers: string;
  libelle: string;
  icone: (props: { className?: string }) => JSX.Element;
  roles?: CodeRole[];
  // Module RH du lien : décide seul de sa visibilité pour les rôles gestionnaires (cf. permissions.ts).
  module?: ModuleRh;
}

export interface GroupeNav {
  titre: string;
  liens: LienNav[];
}

// Source unique de la navigation — consommée par le menu latéral (MiseEnPage, regroupé par
// section) et le fil d'Ariane de la barre supérieure (BarreSuperieure, "Section › Page"), pour ne
// jamais désynchroniser les deux. Le regroupement ne change ni les routes (`vers`) ni les
// permissions (`roles`) — seulement l'ordre et la présentation dans le menu.
export const GROUPES: GroupeNav[] = [
  {
    titre: 'Accueil',
    liens: [
      {
        vers: '/tableaux-de-bord',
        libelle: 'Tableaux de bord',
        icone: IconeTableauxDeBord,
        roles: ['super_admin', 'drh_holding', 'rh_filiale', 'chef_service', ...ROLES_GESTIONNAIRES],
      },
    ],
  },
  {
    titre: 'Personnel',
    liens: [
      { vers: '/employes', libelle: 'Employés', icone: IconeEmployes, module: 'employes' },
      {
        vers: '/contrats',
        libelle: 'Contrats',
        icone: IconeContrats,
        module: 'contrats',
        roles: ['super_admin', 'drh_holding', 'rh_filiale'],
      },
      {
        vers: '/attestations',
        libelle: 'Attestations',
        icone: IconeAttestations,
        module: 'attestations',
        roles: ['super_admin', 'drh_holding', 'rh_filiale'],
      },
    ],
  },
  {
    titre: 'Temps',
    liens: [
      {
        vers: '/pointage',
        libelle: 'Pointage',
        icone: IconePointage,
        module: 'pointage',
        roles: ['super_admin', 'drh_holding', 'rh_filiale', 'responsable_rh_chantier'],
      },
      { vers: '/conges', libelle: 'Congés', icone: IconeConges, module: 'conges' },
      { vers: '/absences', libelle: 'Absences', icone: IconeAbsences, module: 'absences' },
      { vers: '/missions', libelle: 'Missions', icone: IconeMissions, module: 'missions' },
    ],
  },
  {
    titre: 'Paie',
    liens: [
      {
        vers: '/cycle-paie',
        libelle: 'Cycle de paie',
        icone: IconeCyclePaie,
        roles: ['super_admin', 'drh_holding', 'rh_filiale'],
      },
      {
        vers: '/paie',
        libelle: 'Paie',
        icone: IconePaie,
        module: 'paie',
        roles: ['super_admin', 'drh_holding', 'rh_filiale', 'employe'],
      },
      {
        vers: '/simulateur',
        libelle: 'Simulateur',
        icone: IconeSimulateur,
        roles: ['super_admin', 'drh_holding', 'rh_filiale'],
      },
    ],
  },
  {
    titre: 'Administration',
    liens: [
      { vers: '/audit', libelle: 'Audit', icone: IconeAudit, roles: ['super_admin'] },
      {
        vers: '/parametres',
        libelle: 'Paramètres',
        icone: IconeParametres,
        roles: ['super_admin', 'drh_holding', 'rh_filiale'],
      },
    ],
  },
];

// Liste à plat dérivée des groupes — pratique partout où seule la recherche d'un lien par route
// compte (ex. le fil d'Ariane n'a pas besoin de connaître les groupes pour trouver la page active).
export const LIENS: LienNav[] = GROUPES.flatMap((g) => g.liens);

// Un rôle gestionnaire voit les liens de ses modules, plus ceux qui le listent dans `roles` (tableau
// de bord) ; pour les autres rôles, seule la liste `roles` compte, comme avant.
export function lienVisible(lien: LienNav, role: CodeRole | null): boolean {
  if (estGestionnaire(role)) {
    return lien.module ? moduleOuvert(role, lien.module) : !!lien.roles?.includes(role!);
  }
  return !lien.roles || (role !== null && lien.roles.includes(role));
}

// Page d'arrivée après connexion : Employés si accessible, sinon le premier lien visible.
export function pageAccueil(role: CodeRole | null): string {
  const visibles = LIENS.filter((l) => lienVisible(l, role));
  return visibles.find((l) => l.vers === '/employes')?.vers ?? visibles[0]?.vers ?? '/employes';
}
