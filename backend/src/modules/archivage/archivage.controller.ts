import { Request, Response } from 'express';
import { z } from 'zod';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { filialesAutoriseesPour } from '../../middleware/autorisation';
import {
  deposerDocument,
  listerDocuments,
  mettreEnCorbeille,
  obtenirUrlTelechargement,
} from './archivage.service';

const schemaMeta = z.object({
  categorie: z.enum([
    'contrat',
    'cnib',
    'diplome',
    'certificat',
    'permis',
    'document_administratif',
    'bulletin_paie',
    'autre',
  ]),
  employeId: z.string().uuid().optional(),
  filialeId: z.string().uuid().optional(),
  dateExpiration: z.string().optional(),
  confidentialite: z.enum(['standard', 'restreinte']).optional(),
});

export async function deposer(req: Request, res: Response) {
  if (!req.file) {
    throw new ErreurApplicative(400, 'Aucun fichier reçu (champ "fichier" attendu)');
  }

  const meta = schemaMeta.parse({
    ...req.body,
    dateExpiration: req.body.dateExpiration || undefined,
  });

  // Un Employé ne peut déposer que pour lui-même, quoi qu'il envoie dans le formulaire.
  if (req.utilisateur!.role === 'employe') {
    meta.employeId = req.utilisateur!.employeId ?? undefined;
  }

  const document = await deposerDocument(req.file, meta, req.utilisateur!.sub);
  res.status(201).json(document);
}

export async function lister(req: Request, res: Response) {
  const categorie = req.query.categorie as string | undefined;
  const recherche = req.query.recherche as string | undefined;

  // Un Employé ne voit que ses propres documents, quel que soit le paramètre employeId envoyé.
  if (req.utilisateur!.role === 'employe') {
    if (!req.utilisateur!.employeId) {
      res.json([]);
      return;
    }
    res.json(await listerDocuments(null, req.utilisateur!.employeId, categorie, recherche));
    return;
  }

  const employeId = req.query.employeId as string | undefined;
  const filiales = filialesAutoriseesPour(req.utilisateur!);
  res.json(await listerDocuments(filiales, employeId, categorie, recherche));
}

export async function telecharger(req: Request, res: Response) {
  const url = await obtenirUrlTelechargement(req.params.id);
  res.json({ url });
}

export async function supprimer(req: Request, res: Response) {
  await mettreEnCorbeille(req.params.id);
  res.status(204).send();
}
