import { Request, Response } from 'express';
import { z } from 'zod';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { filialesAutoriseesPour } from '../../middleware/autorisation';
import {
  cloturer,
  genererJournalPaie,
  lancerCalcul,
  listerCycles,
  marquerVerifie,
  obtenirResumeCycle,
  reouvrir,
} from './cyclesPaie.service';

const schemaCycle = z.object({
  filialeId: z.string().uuid(),
  periode: z.string(),
});

// Un rh_filiale ne peut agir que sur les filiales de son périmètre — même vérification que
// calculerMasse dans paie.controller.ts.
function verifierPerimetreFiliale(req: Request, filialeId: string): void {
  const filiales = filialesAutoriseesPour(req.utilisateur!);
  if (filiales !== null && !filiales.includes(filialeId)) {
    throw new ErreurApplicative(403, "Cette filiale n'est pas dans votre périmètre");
  }
}

export async function lister(req: Request, res: Response) {
  const periode = req.query.periode as string | undefined;
  const filiales = filialesAutoriseesPour(req.utilisateur!);
  res.json(await listerCycles(filiales, periode));
}

export async function resume(req: Request, res: Response) {
  const filialeId = req.query.filialeId as string;
  const periode = req.query.periode as string;
  if (!filialeId || !periode) {
    throw new ErreurApplicative(400, 'Les paramètres filialeId et periode sont requis');
  }
  verifierPerimetreFiliale(req, filialeId);
  res.json(await obtenirResumeCycle(filialeId, periode));
}

export async function calculer(req: Request, res: Response) {
  const { filialeId, periode } = schemaCycle.parse(req.body);
  verifierPerimetreFiliale(req, filialeId);
  res.json(await lancerCalcul(filialeId, periode));
}

export async function verifier(req: Request, res: Response) {
  const { filialeId, periode } = schemaCycle.parse(req.body);
  verifierPerimetreFiliale(req, filialeId);
  res.json(await marquerVerifie(filialeId, periode, req.utilisateur!.sub));
}

export async function cloturerCycle(req: Request, res: Response) {
  const { filialeId, periode } = schemaCycle.parse(req.body);
  verifierPerimetreFiliale(req, filialeId);
  res.json(await cloturer(filialeId, periode, req.utilisateur!.sub));
}

export async function reouvrirCycle(req: Request, res: Response) {
  const { filialeId, periode } = schemaCycle.parse(req.body);
  res.json(await reouvrir(filialeId, periode, req.utilisateur!.sub));
}

export async function journal(req: Request, res: Response) {
  const filialeId = req.query.filialeId as string;
  const periode = req.query.periode as string;
  const groupePar = req.query.groupePar as 'mode_paiement' | undefined;
  if (!filialeId || !periode) {
    throw new ErreurApplicative(400, 'Les paramètres filialeId et periode sont requis');
  }
  verifierPerimetreFiliale(req, filialeId);

  const { buffer, nomFichier } = await genererJournalPaie(filialeId, periode, groupePar);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`);
  res.send(Buffer.from(buffer));
}
