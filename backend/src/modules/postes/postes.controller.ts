import { Request, Response } from 'express';
import { z } from 'zod';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import {
  archiverDepartement,
  archiverFiliale,
  archiverFonction,
  archiverService,
  creerDepartement,
  creerFiliale,
  creerFonction,
  creerService,
  enregistrerLogoFiliale,
  listerDepartements,
  listerFiliales,
  listerFonctions,
  listerServices,
  modifierCoordonneesFiliale,
  renommerDepartement,
  renommerFiliale,
  renommerFonction,
  renommerService,
} from './postes.service';

const schemaCreationFiliale = z.object({
  nom: z.string().min(1),
  ville: z.string().optional(),
  pays: z.string().optional(),
});

const schemaCreationDepartement = z.object({
  filialeId: z.string().uuid(),
  nom: z.string().min(1),
  responsableId: z.string().uuid().optional(),
});

const schemaCreationService = z.object({
  departementId: z.string().uuid(),
  nom: z.string().min(1),
  responsableId: z.string().uuid().optional(),
});

const schemaCreationFonction = z.object({
  intitule: z.string().min(1),
  description: z.string().optional(),
});

const schemaCoordonneesFiliale = z.object({
  raisonSociale: z.string().optional(),
  adresse: z.string().optional(),
  rccm: z.string().optional(),
  ifu: z.string().optional(),
  telephone: z.string().optional(),
  siteWeb: z.string().optional(),
  couleurAccent: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadécimale attendue, ex. #E8622C').optional(),
});

const schemaRenommer = z.object({ nom: z.string().min(1) });
const schemaRenommerFonction = z.object({ intitule: z.string().min(1) });
const schemaStatut = z.object({ actif: z.boolean() });

function visiblesUniquement(req: Request): boolean {
  return req.query.visiblesUniquement === 'true';
}

export async function filialesListe(req: Request, res: Response) {
  res.json(await listerFiliales(visiblesUniquement(req)));
}

export async function filialesCreer(req: Request, res: Response) {
  const donnees = schemaCreationFiliale.parse(req.body);
  res.status(201).json(await creerFiliale(donnees));
}

export async function filialesRenommer(req: Request, res: Response) {
  const { nom } = schemaRenommer.parse(req.body);
  res.json(await renommerFiliale(req.params.id, nom));
}

export async function filialesArchiver(req: Request, res: Response) {
  const { actif } = schemaStatut.parse(req.body);
  res.json(await archiverFiliale(req.params.id, actif));
}

export async function filialesModifierCoordonnees(req: Request, res: Response) {
  const donnees = schemaCoordonneesFiliale.parse(req.body);
  res.json(await modifierCoordonneesFiliale(req.params.id, donnees));
}

export async function filialesUploaderLogo(req: Request, res: Response) {
  if (!req.file) {
    throw new ErreurApplicative(400, 'Aucun fichier reçu (champ "logo" attendu)');
  }
  res.json(await enregistrerLogoFiliale(req.params.id, { buffer: req.file.buffer, mimetype: req.file.mimetype }));
}

export async function departementsListe(req: Request, res: Response) {
  res.json(await listerDepartements(req.query.filialeId as string | undefined, visiblesUniquement(req)));
}

export async function departementsCreer(req: Request, res: Response) {
  const donnees = schemaCreationDepartement.parse(req.body);
  res.status(201).json(await creerDepartement(donnees));
}

export async function departementsRenommer(req: Request, res: Response) {
  const { nom } = schemaRenommer.parse(req.body);
  res.json(await renommerDepartement(req.params.id, nom));
}

export async function departementsArchiver(req: Request, res: Response) {
  const { actif } = schemaStatut.parse(req.body);
  res.json(await archiverDepartement(req.params.id, actif));
}

export async function servicesListe(req: Request, res: Response) {
  res.json(await listerServices(req.query.departementId as string | undefined, visiblesUniquement(req)));
}

export async function servicesCreer(req: Request, res: Response) {
  const donnees = schemaCreationService.parse(req.body);
  res.status(201).json(await creerService(donnees));
}

export async function servicesRenommer(req: Request, res: Response) {
  const { nom } = schemaRenommer.parse(req.body);
  res.json(await renommerService(req.params.id, nom));
}

export async function servicesArchiver(req: Request, res: Response) {
  const { actif } = schemaStatut.parse(req.body);
  res.json(await archiverService(req.params.id, actif));
}

export async function fonctionsListe(req: Request, res: Response) {
  res.json(await listerFonctions(visiblesUniquement(req)));
}

export async function fonctionsCreer(req: Request, res: Response) {
  const donnees = schemaCreationFonction.parse(req.body);
  res.status(201).json(await creerFonction(donnees));
}

export async function fonctionsRenommer(req: Request, res: Response) {
  const { intitule } = schemaRenommerFonction.parse(req.body);
  res.json(await renommerFonction(req.params.id, intitule));
}

export async function fonctionsArchiver(req: Request, res: Response) {
  const { actif } = schemaStatut.parse(req.body);
  res.json(await archiverFonction(req.params.id, actif));
}
