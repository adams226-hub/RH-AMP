import { Request, Response } from 'express';
import { z } from 'zod';
import { archiverCategorie, creerCategorie, listerCategories, modifierCategorie } from './categoriesProfessionnelles.service';

const schemaCreation = z.object({
  libelle: z.string().min(1),
  estCadre: z.boolean(),
});

const schemaModification = z.object({
  libelle: z.string().min(1),
  estCadre: z.boolean(),
});

const schemaStatut = z.object({ actif: z.boolean() });

export async function lister(req: Request, res: Response) {
  res.json(await listerCategories(req.query.visiblesUniquement === 'true'));
}

export async function creer(req: Request, res: Response) {
  const donnees = schemaCreation.parse(req.body);
  res.status(201).json(await creerCategorie(donnees.libelle, donnees.estCadre));
}

export async function modifier(req: Request, res: Response) {
  const donnees = schemaModification.parse(req.body);
  res.json(await modifierCategorie(req.params.id, donnees));
}

export async function archiver(req: Request, res: Response) {
  const { actif } = schemaStatut.parse(req.body);
  res.json(await archiverCategorie(req.params.id, actif));
}
