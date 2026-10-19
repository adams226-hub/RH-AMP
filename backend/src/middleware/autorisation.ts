import { NextFunction, Request, Response } from 'express';
import { pool } from '../config/db';
import { ErreurApplicative } from './gestionErreurs';
import { CodeRole } from '../modules/auth/auth.types';

// Middleware factory : n'autorise l'accès à la route qu'aux rôles listés.
export function autoriserRoles(...rolesAutorises: CodeRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.utilisateur || !rolesAutorises.includes(req.utilisateur.role)) {
      throw new ErreurApplicative(403, 'Accès refusé pour ce rôle');
    }
    next();
  };
}

// Rôles "gestionnaires" : profils métier limités à quelques modules, mais sur toutes les filiales.
// Dans les modules listés, ils ont les mêmes droits de gestion qu'un RH Filiale ; les autres modules
// leur sont fermés (exigerModule). Modifier une liste ici suffit côté backend — le frontend en garde
// un miroir dans src/permissions.ts pour le menu et les boutons.
export type ModuleRh = 'employes' | 'contrats' | 'attestations' | 'pointage' | 'conges' | 'absences' | 'missions' | 'paie';

export const MODULES_PAR_GESTIONNAIRE: Partial<Record<CodeRole, ModuleRh[]>> = {
  gestionnaire_conges_absences: ['conges', 'absences'],
  gestionnaire_contrats_attestations: ['contrats', 'attestations'],
  gestionnaire_paie: ['employes', 'pointage', 'missions', 'paie'],
  gestionnaire_temps_presences: ['conges', 'absences', 'pointage', 'missions'],
  gestionnaire_personnel_pointage: ['employes', 'pointage', 'missions'],
};

export const ROLES_GESTIONNAIRES = Object.keys(MODULES_PAR_GESTIONNAIRE) as CodeRole[];

export function estGestionnaire(role: CodeRole): boolean {
  return role in MODULES_PAR_GESTIONNAIRE;
}

// Rôles gestionnaires ayant accès au module — à ajouter aux listes autoriserRoles des actions de gestion.
export function gestionnairesDuModule(module: ModuleRh): CodeRole[] {
  return ROLES_GESTIONNAIRES.filter((r) => MODULES_PAR_GESTIONNAIRE[r]!.includes(module));
}

// Ferme un module aux rôles gestionnaires qui ne l'ont pas. Sans effet sur les autres rôles, dont
// les accès restent ceux de autoriserRoles/du périmètre filiale.
export function exigerModule(module: ModuleRh) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = req.utilisateur?.role;
    if (role && estGestionnaire(role) && !MODULES_PAR_GESTIONNAIRE[role]!.includes(module)) {
      throw new ErreurApplicative(403, "Votre rôle ne donne pas accès à ce module");
    }
    next();
  };
}

// Périmètre filiale de l'utilisateur : null = accès à toutes les filiales
// (super_admin, drh_holding, rôles gestionnaires), sinon liste des filiale_id autorisées.
export function filialesAutoriseesPour(utilisateur: { role: CodeRole; filiales: string[] | null }): string[] | null {
  if (utilisateur.role === 'super_admin' || utilisateur.role === 'drh_holding' || estGestionnaire(utilisateur.role)) {
    return null;
  }
  return utilisateur.filiales ?? [];
}

// Périmètre chantier d'un utilisateur : null = aucune restriction (super_admin, drh_holding).
// rh_filiale est scopé via ses filiales (tous les chantiers de ses filiales). responsable_rh_chantier
// est scopé plus finement via utilisateurs_chantiers (absent du JWT, lu à chaque appel pour éviter
// qu'un changement d'affectation nécessite une reconnexion) — cf. SPEC_MODULE_POINTAGE_AMP.md §2.
// Partagé (pas propre au module Pointage) : Employés/Congés/Absences/Missions en ont besoin pour
// qu'un Responsable RH Chantier voie les employés de son chantier, faute de quoi filialesAutoriseesPour
// renvoie toujours [] pour ce rôle (jamais rattaché à une filiale) et ces écrans restent vides.
export async function chantiersAutorisesPour(
  utilisateurId: string,
  role: CodeRole,
  filialesAutorisees: string[] | null
): Promise<string[] | null> {
  if (role === 'super_admin' || role === 'drh_holding' || estGestionnaire(role)) return null;

  if (role === 'rh_filiale') {
    if (filialesAutorisees === null) return null;
    // Chantiers de ses filiales + chantiers communs (filiale_id NULL), où ses employés peuvent travailler.
    const { rows } = await pool.query('SELECT id FROM chantiers WHERE filiale_id = ANY($1) OR filiale_id IS NULL', [
      filialesAutorisees,
    ]);
    return rows.map((r) => r.id as string);
  }

  if (role === 'responsable_rh_chantier') {
    const { rows } = await pool.query('SELECT chantier_id FROM utilisateurs_chantiers WHERE utilisateur_id = $1', [
      utilisateurId,
    ]);
    return rows.map((r) => r.chantier_id as string);
  }

  return [];
}
