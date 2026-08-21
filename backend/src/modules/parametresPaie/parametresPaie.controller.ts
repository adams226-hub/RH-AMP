import { Request, Response } from 'express';
import { z } from 'zod';
import { definirParametrePaie, listerParametresPaie } from './parametresPaie.service';

const CLES = ['taux_cnss_patronale', 'taux_tpa', 'taux_fsp', 'taux_abattement'] as const;

const schemaDefinition = z.object({
  valeur: z.number().min(0).max(1),
});

export async function lister(_req: Request, res: Response) {
  res.json(await listerParametresPaie());
}

export async function definir(req: Request, res: Response) {
  const cle = req.params.cle;

  if (!CLES.includes(cle as (typeof CLES)[number])) {
    res.status(400).json({ erreur: `Clé de paramètre inconnue : ${cle}` });
    return;
  }

  const { valeur } = schemaDefinition.parse(req.body);
  res.json(await definirParametrePaie(cle, valeur));
}
