import { Request, Response } from 'express';
import { genererExportExcelAudit } from './audit.excel';
import { listerJournal } from './audit.service';

function lireFiltresCommuns(req: Request) {
  return {
    utilisateurId: req.query.utilisateurId as string | undefined,
    module: req.query.module as string | undefined,
    action: req.query.action as string | undefined,
    recherche: (req.query.recherche as string | undefined)?.trim() || undefined,
    dateDebut: req.query.dateDebut as string | undefined,
    dateFin: req.query.dateFin as string | undefined,
  };
}

export async function journal(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const parPage = Math.min(100, Math.max(1, Number(req.query.parPage ?? 25)));

  const resultat = await listerJournal({ ...lireFiltresCommuns(req), page, parPage });

  res.json(resultat);
}

export async function exportExcel(req: Request, res: Response) {
  const buffer = await genererExportExcelAudit(lireFiltresCommuns(req));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="journal-audit.xlsx"');
  res.send(Buffer.from(buffer));
}
