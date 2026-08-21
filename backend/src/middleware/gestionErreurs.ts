import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class ErreurApplicative extends Error {
  constructor(
    public statut: number,
    message: string
  ) {
    super(message);
  }
}

export function gestionnaireErreurs(erreur: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (erreur instanceof ErreurApplicative) {
    return res.status(erreur.statut).json({ erreur: erreur.message });
  }

  if (erreur instanceof ZodError) {
    return res.status(400).json({ erreur: 'Données invalides', details: erreur.flatten().fieldErrors });
  }

  console.error(erreur);
  return res.status(500).json({ erreur: 'Erreur interne du serveur' });
}
