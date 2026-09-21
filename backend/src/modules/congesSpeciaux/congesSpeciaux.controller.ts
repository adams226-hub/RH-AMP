import { Request, Response } from 'express';
import { z } from 'zod';
import { chantiersAutorisesPour, filialesAutoriseesPour } from '../../middleware/autorisation';
import { creerDemande, listerDemandesEmploye, listerToutesDemandes, traiterDecision } from './congesSpeciaux.service';

const schemaCreation = z.object({
  employeId: z.string().uuid(),
  type: z.enum(['maternite', 'paternite']),
  dateDebut: z.string(),
  dateFin: z.string().optional(),
  justificatifFourni: z.boolean().optional(),
  motif: z.string().optional(),
});

const schemaDecision = z.object({
  decision: z.enum(['validee', 'rejetee']),
  dateFin: z.string().optional(),
  commentaire: z.string().optional(),
});

export async function demandesListe(req: Request, res: Response) {
  const employeId = req.query.employeId as string | undefined;

  if (employeId) {
    res.json(await listerDemandesEmploye(employeId));
    return;
  }

  const utilisateur = req.utilisateur!;
  const filiales = filialesAutoriseesPour(utilisateur);
  const chantiers = await chantiersAutorisesPour(utilisateur.sub, utilisateur.role, filiales);
  res.json(await listerToutesDemandes(filiales, chantiers));
}

export async function demandesCreer(req: Request, res: Response) {
  const donnees = schemaCreation.parse(req.body);
  res.status(201).json(await creerDemande(donnees));
}

export async function demandesDecision(req: Request, res: Response) {
  const donnees = schemaDecision.parse(req.body);
  res.json(await traiterDecision(req.params.id, req.utilisateur!.sub, donnees));
}
