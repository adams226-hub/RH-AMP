import { Request, Response } from 'express';
import { z } from 'zod';
import { filialesAutoriseesPour } from '../../middleware/autorisation';
import { creerMission, enregistrerRetour, listerMissions } from './missions.service';

const schemaCreationMission = z.object({
  employeId: z.string().uuid(),
  destination: z.string().min(1),
  motif: z.string().min(1),
  dateDepart: z.string(),
  dateRetourPrevue: z.string(),
});

const schemaRetour = z.object({
  dateRetourReelle: z.string(),
});

export async function lister(req: Request, res: Response) {
  const filiales = filialesAutoriseesPour(req.utilisateur!);
  res.json(await listerMissions(filiales));
}

export async function creer(req: Request, res: Response) {
  const donnees = schemaCreationMission.parse(req.body);
  res.status(201).json(await creerMission(donnees));
}

export async function retour(req: Request, res: Response) {
  const { dateRetourReelle } = schemaRetour.parse(req.body);
  res.json(await enregistrerRetour(req.params.id, dateRetourReelle));
}
