import { CodeRole } from './context/AuthContext';

// Miroir de MODULES_PAR_GESTIONNAIRE (backend/src/middleware/autorisation.ts) — le backend reste
// la seule vraie barrière ; ici on ne fait que masquer menu, pages et boutons inutiles.
export type ModuleRh = 'employes' | 'contrats' | 'attestations' | 'pointage' | 'conges' | 'absences' | 'missions' | 'paie';

const MODULES_PAR_GESTIONNAIRE: Partial<Record<CodeRole, ModuleRh[]>> = {
  gestionnaire_conges_absences: ['conges', 'absences'],
  gestionnaire_contrats_attestations: ['contrats', 'attestations'],
  gestionnaire_paie: ['employes', 'pointage', 'missions', 'paie'],
  gestionnaire_temps_presences: ['conges', 'absences', 'pointage', 'missions'],
  gestionnaire_personnel_pointage: ['employes', 'pointage', 'missions'],
};

export const ROLES_GESTIONNAIRES = Object.keys(MODULES_PAR_GESTIONNAIRE) as CodeRole[];

export function estGestionnaire(role: CodeRole | null): boolean {
  return role !== null && role in MODULES_PAR_GESTIONNAIRE;
}

// Rôle gestionnaire n'ayant pas ce module → false. Tout autre rôle → true (ses accès restent
// réglés par les listes de rôles habituelles).
export function moduleOuvert(role: CodeRole | null, module: ModuleRh): boolean {
  if (role === null || !estGestionnaire(role)) return true;
  return MODULES_PAR_GESTIONNAIRE[role]!.includes(module);
}

// Droits de gestion (créer, modifier, valider) dans un module : RH Filiale et au-dessus, plus les
// rôles gestionnaires qui ont ce module.
export function peutGererModule(role: CodeRole | null, module: ModuleRh): boolean {
  if (role === 'super_admin' || role === 'drh_holding' || role === 'rh_filiale') return true;
  return estGestionnaire(role) && moduleOuvert(role, module);
}
