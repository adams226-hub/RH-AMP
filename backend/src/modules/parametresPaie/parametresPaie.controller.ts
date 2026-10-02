import { Request, Response } from 'express';
import { z } from 'zod';
import { definirParametrePaie, listerParametresPaie } from './parametresPaie.service';

const CLES = ['taux_cnss_patronale', 'taux_tpa', 'taux_fsp', 'taux_abattement', 'taux_panier_jour'] as const;

// taux_panier_jour est un montant en F CFA (pas un taux entre 0 et 1, contrairement aux autres
// clés) — plafond large plutôt qu'une validation par clé, pour rester simple.
const schemaDefinition = z.object({
  valeur: z.number().min(0).max(1_000_000),
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
