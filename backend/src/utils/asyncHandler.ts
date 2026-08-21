import { NextFunction, Request, Response } from 'express';

type GestionnaireAsync = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

// Évite un try/catch répété dans chaque contrôleur : toute promesse rejetée
// est transmise à `next()`, donc interceptée par gestionnaireErreurs.
export function asyncHandler(gestionnaire: GestionnaireAsync) {
  return (req: Request, res: Response, next: NextFunction) => {
    gestionnaire(req, res, next).catch(next);
  };
}
