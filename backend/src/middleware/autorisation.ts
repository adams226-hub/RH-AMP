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

// Périmètre filiale de l'utilisateur : null = accès à toutes les filiales
// (super_admin, drh_holding), sinon liste des filiale_id autorisées.
export function filialesAutoriseesPour(utilisateur: { role: CodeRole; filiales: string[] | null }): string[] | null {
  if (utilisateur.role === 'super_admin' || utilisateur.role === 'drh_holding') {
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
  if (role === 'super_admin' || role === 'drh_holding') return null;

  if (role === 'rh_filiale') {
    if (filialesAutorisees === null) return null;
    const { rows } = await pool.query('SELECT id FROM chantiers WHERE filiale_id = ANY($1)', [filialesAutorisees]);
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
