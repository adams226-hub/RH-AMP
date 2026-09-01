import { Request, Response } from 'express';
import { z } from 'zod';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { filialesAutoriseesPour } from '../../middleware/autorisation';
import {
  enregistrerStagiaire,
  genererAttestation,
  listerAttestations,
  obtenirAttestation,
  obtenirStagiaire,
  preparerApercu,
} from './attestations.service';
import { genererAttestationPdf } from './attestations.pdf';

const TYPES_ATTESTATION = ['att_trav', 'cert_trav', 'att_stage'] as const;

const schemaStagiaire = z.object({
  filiereEtudes: z.string().optional(),
  etablissement: z.string().optional(),
  superviseurId: z.string().uuid().optional(),
});

// `donnees` est vérifiée structurellement côté TypeScript (type DonneesAttestation, discriminé
// par `type`) — le contenu vient de l'aperçu que le RH a lui-même édité côté client, jamais saisi
// à la main dans un formulaire libre non typé.
const schemaGeneration = z.object({
  employeId: z.string().uuid(),
  type: z.enum(TYPES_ATTESTATION),
  donnees: z.record(z.unknown()),
});

async function verifierAccesFiliale(req: Request, filialeId: string | null): Promise<void> {
  if (!filialeId) return;
  const filiales = filialesAutoriseesPour(req.utilisateur!);
  if (filiales !== null && !filiales.includes(filialeId)) {
    throw new ErreurApplicative(403, "Cette filiale n'est pas dans votre périmètre");
  }
}

export async function lister(req: Request, res: Response) {
  const filiales = filialesAutoriseesPour(req.utilisateur!);
  const employeId = req.query.employeId as string | undefined;
  res.json(await listerAttestations(filiales, employeId));
}

export async function apercu(req: Request, res: Response) {
  const employeId = req.query.employeId as string | undefined;
  const type = req.query.type as string | undefined;
  if (!employeId || !type || !TYPES_ATTESTATION.includes(type as (typeof TYPES_ATTESTATION)[number])) {
    throw new ErreurApplicative(400, 'employeId et type (valide) sont requis');
  }
  res.json(await preparerApercu(employeId, type as (typeof TYPES_ATTESTATION)[number]));
}

export async function generer(req: Request, res: Response) {
  const donnees = schemaGeneration.parse(req.body) as unknown as Parameters<typeof genererAttestation>[0];
  res.status(201).json(await genererAttestation(donnees, req.utilisateur!.sub));
}

export async function pdf(req: Request, res: Response) {
  const attestation = await obtenirAttestation(req.params.id);
  await verifierAccesFiliale(req, attestation.filialeId);

  const buffer = await genererAttestationPdf(req.params.id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${attestation.numeroComplet.replace(/\//g, '-')}.pdf"`);
  res.send(buffer);
}

export async function stagiaireObtenir(req: Request, res: Response) {
  res.json(await obtenirStagiaire(req.params.employeId));
}

export async function stagiaireEnregistrer(req: Request, res: Response) {
  const donnees = schemaStagiaire.parse(req.body);
  res.json(await enregistrerStagiaire(req.params.employeId, donnees));
}
