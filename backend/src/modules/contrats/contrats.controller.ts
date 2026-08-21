import { Request, Response } from 'express';
import { z } from 'zod';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { filialesAutoriseesPour } from '../../middleware/autorisation';
import {
  activerContrat,
  creerContrat,
  listerContratsEmploye,
  listerContratsExpirantBientot,
  listerTousContrats,
  obtenirContrat,
  romprecontrat,
  renouvelerContrat,
} from './contrats.service';

const composantesRemuneration = {
  sursalaire: z.number().nonnegative().optional(),
  indemniteLogement: z.number().nonnegative().optional(),
  indemniteTransport: z.number().nonnegative().optional(),
  indemniteFonction: z.number().nonnegative().optional(),
  indemniteSujetion: z.number().nonnegative().optional(),
  indemniteAstreinte: z.number().nonnegative().optional(),
};

const schemaCreation = z.object({
  employeId: z.string().uuid(),
  type: z.enum(['cdi', 'cdd', 'stage']),
  dateDebut: z.string(),
  dateFin: z.string().optional(),
  dureeEssaiJours: z.number().int().positive().optional(),
  fonctionId: z.string().uuid().optional(),
  salaireBase: z.number().nonnegative(),
  ...composantesRemuneration,
});

const schemaRenouvellement = z.object({
  dateDebut: z.string(),
  dateFin: z.string().optional(),
  salaireBase: z.number().nonnegative(),
  ...composantesRemuneration,
});

const schemaRupture = z.object({
  dateRupture: z.string(),
  motifRupture: z.string().min(1),
});

export async function lister(req: Request, res: Response) {
  const employeId = req.query.employeId as string | undefined;

  if (employeId) {
    res.json(await listerContratsEmploye(employeId));
    return;
  }

  const filiales = filialesAutoriseesPour(req.utilisateur!);
  res.json(await listerTousContrats(filiales));
}

export async function listerExpirations(req: Request, res: Response) {
  const seuil = Number(req.query.jours ?? 90);
  res.json(await listerContratsExpirantBientot(seuil));
}

export async function obtenir(req: Request, res: Response) {
  const contrat = await obtenirContrat(req.params.id);

  if (!contrat) {
    throw new ErreurApplicative(404, 'Contrat introuvable');
  }

  res.json(contrat);
}

export async function creer(req: Request, res: Response) {
  const donnees = schemaCreation.parse(req.body);
  res.status(201).json(await creerContrat(donnees));
}

export async function activer(req: Request, res: Response) {
  res.json(await activerContrat(req.params.id));
}

export async function renouveler(req: Request, res: Response) {
  const donnees = schemaRenouvellement.parse(req.body);
  res.status(201).json(await renouvelerContrat(req.params.id, donnees));
}

export async function rompre(req: Request, res: Response) {
  const donnees = schemaRupture.parse(req.body);
  res.json(await romprecontrat(req.params.id, donnees));
}
