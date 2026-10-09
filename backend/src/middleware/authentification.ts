import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ErreurApplicative } from './gestionErreurs';
import { PayloadJwt } from '../modules/auth/auth.types';

export function authentification(req: Request, _res: Response, next: NextFunction) {
  const enTete = req.headers.authorization;

  if (!enTete?.startsWith('Bearer ')) {
    throw new ErreurApplicative(401, 'Authentification requise');
  }

  const jeton = enTete.slice('Bearer '.length);

  try {
    req.utilisateur = jwt.verify(jeton, env.JWT_SECRET) as PayloadJwt;
    next();
  } catch {
    throw new ErreurApplicative(401, 'Veuillez vous reconnecter');
  }
}
