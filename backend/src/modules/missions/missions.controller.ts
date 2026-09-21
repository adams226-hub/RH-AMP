import { Request, Response } from 'express';
import { z } from 'zod';
import { chantiersAutorisesPour, filialesAutoriseesPour } from '../../middleware/autorisation';
import { genererExportExcelMissions } from './missions.excel';
import { creerMission, enregistrerRetour, listerMissions } from './missions.service';

const schemaCreationMission = z.object({
  employeId: z.string().uuid(),
  numeroOrdreMission: z.string().min(1),
  destination: z.string().min(1),
  motif: z.string().min(1),
  dateDepart: z.string(),
  dateRetourPrevue: z.string(),
  montantHebergement: z.number().nonnegative().optional(),
  montantRestauration: z.number().nonnegative().optional(),
});

const schemaRetour = z.object({
  dateRetourReelle: z.string(),
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
