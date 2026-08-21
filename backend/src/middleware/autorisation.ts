import { NextFunction, Request, Response } from 'express';
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
