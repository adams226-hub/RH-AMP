import { Request, Response } from 'express';
import { listerJournal } from './audit.service';

export async function journal(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const parPage = Math.min(100, Math.max(1, Number(req.query.parPage ?? 25)));

  const resultat = await listerJournal({
    utilisateurId: req.query.utilisateurId as string | undefined,
    module: req.query.module as string | undefined,
    action: req.query.action as string | undefined,
    page,
    parPage,
  });

  res.json(resultat);
}
