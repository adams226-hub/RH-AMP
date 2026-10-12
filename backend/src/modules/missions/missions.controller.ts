import { Request, Response } from 'express';
import { z } from 'zod';
import { chantiersAutorisesPour, filialesAutoriseesPour } from '../../middleware/autorisation';
import { genererExportExcelHebergements, genererExportExcelMissions } from './missions.excel';
import {
  archiverMaisonHote,
  creerMaisonHote,
  creerMission,
  enregistrerRetour,
  listerMaisonsHote,
  listerMissions,
  listerSejoursHebergement,
  modifierFrais,
  modifierMaisonHote,
  obtenirTarifsNuitee,
  supprimerMaisonHote,
} from './missions.service';

const schemaSejourHebergement = z.object({
  maisonId: z.string().uuid(),
  dateArrivee: z.string(),
  dateDepart: z.string(),
  nouvelleDateFin: z.string().optional(),
  motifProlongation: z.string().optional(),
  centreImputation: z.string().optional(),
  categorieTarif: z.enum(['cadre', 'cadre_superieur']),
});

const schemaCreationMission = z.object({
  employeId: z.string().uuid(),
  numeroOrdreMission: z.string().min(1),
  destination: z.string().min(1),
  motif: z.string().min(1),
  dateDepart: z.string(),
  dateRetourPrevue: z.string(),
  montantHebergement: z.number().nonnegative().optional(),
  montantRestauration: z.number().nonnegative().optional(),
  hebergement: schemaSejourHebergement.optional(),
});

const schemaCreationMaisonHote = z.object({
  filialeId: z.string().uuid(),
  nom: z.string().min(1),
  ville: z.string().optional(),
});

const schemaModificationMaisonHote = z.object({
  nom: z.string().min(1),
  ville: z.string().optional(),
});

const schemaArchivageMaisonHote = z.object({
  actif: z.boolean(),
});

const schemaRetour = z.object({
  dateRetourReelle: z.string(),
});

const schemaFrais = z.object({
  montantHebergement: z.number().nonnegative(),
  montantRestauration: z.number().nonnegative(),
});

export async function lister(req: Request, res: Response) {
  const utilisateur = req.utilisateur!;
  const filiales = filialesAutoriseesPour(utilisateur);
  const chantiers = await chantiersAutorisesPour(utilisateur.sub, utilisateur.role, filiales);
  res.json(await listerMissions(filiales, chantiers));
}

export async function exportExcel(req: Request, res: Response) {
  const utilisateur = req.utilisateur!;
  const filiales = filialesAutoriseesPour(utilisateur);
  const chantiers = await chantiersAutorisesPour(utilisateur.sub, utilisateur.role, filiales);

  const buffer = await genererExportExcelMissions(filiales, chantiers);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="missions.xlsx"');
  res.send(Buffer.from(buffer));
}

export async function creer(req: Request, res: Response) {
  const donnees = schemaCreationMission.parse(req.body);
  res.status(201).json(await creerMission(donnees));
}

export async function retour(req: Request, res: Response) {
  const { dateRetourReelle } = schemaRetour.parse(req.body);
  res.json(await enregistrerRetour(req.params.id, dateRetourReelle));
}

export async function frais(req: Request, res: Response) {
  const donnees = schemaFrais.parse(req.body);
  res.json(await modifierFrais(req.params.id, donnees));
}

// ----------------------------------------------------------------------------
// Maisons d'hôte
// ----------------------------------------------------------------------------

export async function tarifsNuitee(_req: Request, res: Response) {
  res.json(await obtenirTarifsNuitee());
}

export async function listerMaisons(req: Request, res: Response) {
  const inclureArchives = req.query.tout === '1';
  res.json(await listerMaisonsHote(inclureArchives));
}

export async function creerMaison(req: Request, res: Response) {
  const donnees = schemaCreationMaisonHote.parse(req.body);
  res.status(201).json(await creerMaisonHote(donnees));
}

export async function modifierMaison(req: Request, res: Response) {
  const donnees = schemaModificationMaisonHote.parse(req.body);
  res.json(await modifierMaisonHote(req.params.id, donnees));
}

export async function archiverMaison(req: Request, res: Response) {
  const { actif } = schemaArchivageMaisonHote.parse(req.body);
  res.json(await archiverMaisonHote(req.params.id, actif));
}

export async function supprimerMaison(req: Request, res: Response) {
  await supprimerMaisonHote(req.params.id);
  res.status(204).send();
}

// ----------------------------------------------------------------------------
// Onglet Hébergements
// ----------------------------------------------------------------------------

function filtresHebergement(req: Request) {
  return {
    mois: typeof req.query.mois === 'string' ? req.query.mois : undefined,
    maisonId: typeof req.query.maisonId === 'string' ? req.query.maisonId : undefined,
  };
}

export async function listerHebergements(req: Request, res: Response) {
  const utilisateur = req.utilisateur!;
  const filiales = filialesAutoriseesPour(utilisateur);
  const chantiers = await chantiersAutorisesPour(utilisateur.sub, utilisateur.role, filiales);
  res.json(await listerSejoursHebergement(filiales, chantiers, filtresHebergement(req)));
}

export async function exportExcelHebergements(req: Request, res: Response) {
  const utilisateur = req.utilisateur!;
  const filiales = filialesAutoriseesPour(utilisateur);
  const chantiers = await chantiersAutorisesPour(utilisateur.sub, utilisateur.role, filiales);

  const buffer = await genererExportExcelHebergements(filiales, chantiers, filtresHebergement(req));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="hebergements.xlsx"');
  res.send(Buffer.from(buffer));
}
