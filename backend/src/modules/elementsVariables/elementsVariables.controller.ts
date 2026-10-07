import { Request, Response } from 'express';
import { z } from 'zod';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { filialesAutoriseesPour } from '../../middleware/autorisation';
import {
  enregistrerElementMois,
  listerElementsEmploye,
  listerElementsMois,
  supprimerElementMois,
} from './elementsVariables.service';

const schemaSaisie = z.object({
  employeId: z.string().uuid(),
  periode: z.string(),
  type: z.enum([
    'prime', 'avance', 'panier', 'reliquat', 'absence_injustifiee', 'trop_percu',
    'heure_sup_50', 'heure_sup_120', 'heure_sup_forfait', 'prime_salissure', 'prime_lait',
  ]),
  montant: z.number().nonnegative().optional(),
  jours: z.number().nonnegative().optional(),
});

export async function lister(req: Request, res: Response) {
  const periode = req.query.periode as string | undefined;
  if (!periode) {
    throw new ErreurApplicative(400, 'Le paramètre periode est requis');
  }

  const employeId = req.query.employeId as string | undefined;
  if (employeId) {
    res.json(await listerElementsEmploye(employeId, periode));
    return;
  }

  const filiales = filialesAutoriseesPour(req.utilisateur!);
  res.json(await listerElementsMois(filiales, periode));
}

export async function enregistrer(req: Request, res: Response) {
  const donnees = schemaSaisie.parse(req.body);
  res.status(201).json(await enregistrerElementMois(donnees));
}

export async function supprimer(req: Request, res: Response) {
  await supprimerElementMois(req.params.id);
  res.status(204).send();
}
