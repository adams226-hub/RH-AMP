import { Request, Response } from 'express';
import { z } from 'zod';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { chantiersAutorisesPour, filialesAutoriseesPour } from '../../middleware/autorisation';
import {
  BAREME_PERMISSIONS_EXCEPTIONNELLES,
  creerDemande,
  donnerAvisHierarchique,
  listerDemandesEmploye,
  listerToutesDemandes,
  modifierDemande,
  obtenirDemandePourAcces,
  obtenirSoldePermission,
  traiterDecisionRh,
} from './absences.service';
import { genererExportExcelAbsences } from './absences.excel';

const schemaCreationDemande = z.object({
  employeId: z.string().uuid(),
  type: z.enum(['permission_exceptionnelle', 'absence_hors_bareme']),
  motifBareme: z.string().optional(),
  motif: z.string().optional(),
  dateDebut: z.string(),
  dateFin: z.string(),
  justificatifFourni: z.boolean().optional(),
});

const schemaModificationDemande = schemaCreationDemande.omit({ employeId: true }).partial();

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

  const utilisateur = req.utilisateur!;
  const filiales = filialesAutoriseesPour(utilisateur);
  const chantiers = await chantiersAutorisesPour(utilisateur.sub, utilisateur.role, filiales);
  res.json(await listerToutesDemandes(filiales, chantiers, req.query.statut as string | undefined));
}

export async function exportExcel(req: Request, res: Response) {
  const utilisateur = req.utilisateur!;
  const filiales = filialesAutoriseesPour(utilisateur);
  const chantiers = await chantiersAutorisesPour(utilisateur.sub, utilisateur.role, filiales);

  const buffer = await genererExportExcelAbsences(filiales, chantiers);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="absences.xlsx"');
  res.send(Buffer.from(buffer));
}

// Partagé avec la modification : propriétaire de la demande, ou dans le périmètre
// filiale/chantier de qui la traite (même raisonnement que verifierAccesEmploye).
async function verifierAccesDemande(req: Request, id: string): Promise<void> {
  const acces = await obtenirDemandePourAcces(id);
  if (!acces) {
    throw new ErreurApplicative(404, 'Demande introuvable');
  }

  const utilisateur = req.utilisateur!;
  const estProprietaire = utilisateur.employeId === acces.employeId;
  const filiales = filialesAutoriseesPour(utilisateur);
  let dansPerimetre = filiales === null || filiales.includes(acces.filialeId);
  if (!dansPerimetre && acces.chantierId) {
    const chantiers = await chantiersAutorisesPour(utilisateur.sub, utilisateur.role, filiales);
    dansPerimetre = chantiers === null || chantiers.includes(acces.chantierId);
  }

  if (!estProprietaire && !dansPerimetre) {
    throw new ErreurApplicative(403, 'Accès refusé à cette demande');
  }
}

export async function demandesCreer(req: Request, res: Response) {
  const donnees = schemaCreationDemande.parse(req.body);
  res.status(201).json(await creerDemande(donnees));
}

export async function demandesModifier(req: Request, res: Response) {
  await verifierAccesDemande(req, req.params.id);
  const donnees = schemaModificationDemande.parse(req.body);
  res.json(await modifierDemande(req.params.id, donnees));
}

export async function demandesAvis(req: Request, res: Response) {
  const { avis, commentaire } = schemaAvis.parse(req.body);
  res.json(await donnerAvisHierarchique(req.params.id, avis, commentaire));
}

export async function demandesDecision(req: Request, res: Response) {
  const { decision, classification, commentaire } = schemaDecision.parse(req.body);
  res.json(await traiterDecisionRh(req.params.id, decision, classification, commentaire));
}
