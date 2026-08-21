import { Request, Response } from 'express';
import { z } from 'zod';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { filialesAutoriseesPour } from '../../middleware/autorisation';
import {
  BAREME_PERMISSIONS_EXCEPTIONNELLES,
  creerDemande,
  donnerAvisHierarchique,
  listerDemandesEmploye,
  listerToutesDemandes,
  obtenirDemandePourAcces,
  obtenirSoldePermission,
  traiterDecisionRh,
} from './absences.service';
import { genererFichePdf } from './absences.pdf';

const schemaCreationDemande = z.object({
  employeId: z.string().uuid(),
  type: z.enum(['permission_exceptionnelle', 'absence_hors_bareme']),
  motifBareme: z.string().optional(),
  motif: z.string().min(1),
  dateDebut: z.string(),
  dateFin: z.string(),
  justificatifFourni: z.boolean().optional(),
});

const schemaAvis = z.object({
  avis: z.enum(['favorable', 'defavorable']),
  commentaire: z.string().optional(),
});

const schemaDecision = z.object({
  decision: z.enum(['validee', 'rejetee']),
  classification: z.enum(['non_deductible', 'deductible_conge', 'sans_solde']).optional(),
  commentaire: z.string().optional(),
});

export async function bareme(_req: Request, res: Response) {
  res.json(BAREME_PERMISSIONS_EXCEPTIONNELLES);
}

export async function soldePermission(req: Request, res: Response) {
  const employeId = req.query.employeId as string | undefined;
  const annee = Number(req.query.annee ?? new Date().getFullYear());

  if (!employeId) {
    throw new ErreurApplicative(400, 'Le paramètre employeId est requis');
  }

  res.json(await obtenirSoldePermission(employeId, annee));
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
  const { decision, classification, commentaire } = schemaDecision.parse(req.body);
  res.json(await traiterDecisionRh(req.params.id, decision, classification, commentaire));
}

export async function demandeFiche(req: Request, res: Response) {
  const acces = await obtenirDemandePourAcces(req.params.id);
  if (!acces) {
    throw new ErreurApplicative(404, 'Demande introuvable');
  }

  const utilisateur = req.utilisateur!;
  const estProprietaire = utilisateur.employeId === acces.employeId;
  const filiales = filialesAutoriseesPour(utilisateur);
  const dansPerimetre = filiales === null || filiales.includes(acces.filialeId);

  if (!estProprietaire && !dansPerimetre) {
    throw new ErreurApplicative(403, "Accès refusé à cette demande");
  }

  const pdf = await genererFichePdf(req.params.id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="autorisation-absence-${req.params.id}.pdf"`);
  res.send(pdf);
}
