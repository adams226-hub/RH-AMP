import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { filialesAutoriseesPour } from '../../middleware/autorisation';
import {
  calculerEtEnregistrerBulletin,
  calculerMasseSalariale,
  changerStatutBulletin,
  listerBulletinsEmploye,
  simulerNetVersBrut,
} from './paie.service';
import { genererBulletinPdf } from './paie.pdf';

// Sursalaire/indemnités viennent du contrat actif ; primes/avances/panier/reliquat/absences
// viennent de l'écran "Éléments du mois" (module elementsVariables) — plus aucune saisie
// manuelle ici, le calcul individuel et le calcul de masse partagent la même source.
const schemaCalcul = z.object({
  employeId: z.string().uuid(),
  periode: z.string(),
});

const schemaCalculMasse = z.object({
  filialeId: z.string().uuid(),
  periode: z.string(),
});

const schemaStatut = z.object({
  statut: z.enum(['valide', 'valide_drh', 'cloture']),
});

const schemaSimulation = z.object({
  netCible: z.number().positive(),
  categorie: z.enum(['CADRE', 'NON_CADRE']),
  personnesACharge: z.number().int().nonnegative().optional(),
  ancienneteAnnees: z.number().int().nonnegative().optional(),
  salaireDeBase: z.number().nonnegative().optional(),
  sursalaire: z.number().nonnegative().optional(),
  indemniteLogement: z.number().nonnegative().optional(),
  indemniteTransport: z.number().nonnegative().optional(),
  indemniteSujetion: z.number().nonnegative().optional(),
  indemniteAstreinte: z.number().nonnegative().optional(),
  indemniteFonction: z.number().nonnegative().optional(),
  panier: z.number().nonnegative().optional(),
  autresIndemnites: z.number().nonnegative().optional(),
  retenuesAvancesDuMois: z.number().nonnegative().optional(),
  reliquat: z.number().nonnegative().optional(),
  reversementTropPercu: z.number().nonnegative().optional(),
  joursPrisEnCompte: z.number().nonnegative().optional(),
  champVariable: z.enum(['salaireDeBase', 'sursalaire']).optional(),
});

export async function calculer(req: Request, res: Response) {
  const donnees = schemaCalcul.parse(req.body);
  res.status(201).json(await calculerEtEnregistrerBulletin(donnees));
}

export async function calculerMasse(req: Request, res: Response) {
  const { filialeId, periode } = schemaCalculMasse.parse(req.body);
  const filiales = filialesAutoriseesPour(req.utilisateur!);

  if (filiales !== null && !filiales.includes(filialeId)) {
    throw new ErreurApplicative(403, "Cette filiale n'est pas dans votre périmètre");
  }

  res.json(await calculerMasseSalariale(filialeId, periode));
}

// Vérifie que l'utilisateur peut voir les bulletins de cet employé : lui-même, ou une
// filiale dans son périmètre. Absent avant cette révision — n'importe quel authentifié
// pouvait lire le détail de salaire de n'importe qui en changeant employeId dans l'URL.
async function verifierAccesEmploye(req: Request, employeId: string): Promise<void> {
  const utilisateur = req.utilisateur!;
  if (utilisateur.employeId === employeId) return;

  const filiales = filialesAutoriseesPour(utilisateur);
  if (filiales === null) return;

  const { rows } = await pool.query('SELECT filiale_id FROM employes WHERE id = $1', [employeId]);
  if (!rows[0] || !filiales.includes(rows[0].filiale_id)) {
    throw new ErreurApplicative(403, 'Accès refusé à la paie de cet employé');
  }
}

export async function lister(req: Request, res: Response) {
  const employeId = req.query.employeId as string;
  if (!employeId) {
    throw new ErreurApplicative(400, 'Le paramètre employeId est requis');
  }
  await verifierAccesEmploye(req, employeId);
  res.json(await listerBulletinsEmploye(employeId));
}

export async function simuler(req: Request, res: Response) {
  const donnees = schemaSimulation.parse(req.body);
  res.json(await simulerNetVersBrut(donnees));
}

export async function changerStatut(req: Request, res: Response) {
  const { statut } = schemaStatut.parse(req.body);
  res.json(await changerStatutBulletin(req.params.id, statut));
}

export async function fiche(req: Request, res: Response) {
  const { rows } = await pool.query('SELECT employe_id FROM bulletins_paie WHERE id = $1', [req.params.id]);
  if (!rows[0]) {
    throw new ErreurApplicative(404, 'Bulletin introuvable');
  }
  await verifierAccesEmploye(req, rows[0].employe_id);

  const pdf = await genererBulletinPdf(req.params.id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="bulletin-${req.params.id}.pdf"`);
  res.send(pdf);
}
