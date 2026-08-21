import { Request, Response } from 'express';
import { z } from 'zod';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { filialesAutoriseesPour } from '../../middleware/autorisation';
import {
  creerDemande,
  donnerAvisHierarchique,
  listerDemandesEmploye,
  listerToutesDemandes,
  obtenirSolde,
  traiterDecisionRh,
} from './conges.service';

const schemaCreationDemande = z.object({
  employeId: z.string().uuid(),
  dateDebut: z.string(),
  dateFin: z.string(),
  motif: z.string().optional(),
});

const schemaAvis = z.object({
  avis: z.enum(['favorable', 'defavorable']),
  commentaire: z.string().optional(),
});

const schemaDecision = z.object({
  decision: z.enum(['validee', 'rejetee']),
  commentaire: z.string().optional(),
});

export async function solde(req: Request, res: Response) {
  const employeId = req.query.employeId as string | undefined;
  const annee = Number(req.query.annee ?? new Date().getFullYear());

  if (!employeId) {
    throw new ErreurApplicative(400, 'Le paramètre employeId est requis');
  }

  res.json(await obtenirSolde(employeId, annee));
}

export async function demandesListe(req: Request, res: Response) {
  const employeId = req.query.employeId as string | undefined;

  if (employeId) {
    res.json(await listerDemandesEmploye(employeId));
    return;
  }

  const filiales = filialesAutoriseesPour(req.utilisateur!);
  res.json(await listerToutesDemandes(filiales, req.query.statut as string | undefined));
}

export async function demandesCreer(req: Request, res: Response) {
  const donnees = schemaCreationDemande.parse(req.body);
  res.status(201).json(await creerDemande(donnees));
}

export async function demandesAvis(req: Request, res: Response) {
  const { avis, commentaire } = schemaAvis.parse(req.body);
  res.json(await donnerAvisHierarchique(req.params.id, avis, commentaire));
}

export async function demandesDecision(req: Request, res: Response) {
  const { decision, commentaire } = schemaDecision.parse(req.body);
  res.json(await traiterDecisionRh(req.params.id, decision, commentaire));
}
