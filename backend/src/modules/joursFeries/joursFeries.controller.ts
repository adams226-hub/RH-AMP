import { Request, Response } from 'express';
import { z } from 'zod';
import { creerJourFerie, listerJoursFeries, supprimerJourFerie } from './joursFeries.service';

const schemaCreation = z.object({
  date: z.string(),
  libelle: z.string().min(1),
  filialeId: z.string().uuid().optional(),
});

export async function lister(req: Request, res: Response) {
  const annee = req.query.annee ? Number(req.query.annee) : undefined;
  res.json(await listerJoursFeries(annee));
}

export async function creer(req: Request, res: Response) {
  const donnees = schemaCreation.parse(req.body);
  res.status(201).json(await creerJourFerie(donnees));
}

export async function supprimer(req: Request, res: Response) {
  await supprimerJourFerie(req.params.id);
  res.status(204).send();
}
