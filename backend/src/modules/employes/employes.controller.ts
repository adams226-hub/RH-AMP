import { Request, Response } from 'express';
import { z } from 'zod';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { chantiersAutorisesPour, filialesAutoriseesPour } from '../../middleware/autorisation';
import {
  affecterChantierEmploye,
  changerStatutEmploye,
  creerEmploye,
  definirSoumisPointage,
  listerEmployes,
  modifierEmploye,
  obtenirEmploye,
  obtenirResumeRhEmploye,
} from './employes.service';

const schemaStatut = z
  .object({
    statut: z.enum(['en_cours_creation', 'actif', 'suspendu', 'sorti']),
    dateSortie: z.string().optional(),
    motifSortie: z.string().optional(),
  })
  .refine((d) => d.statut !== 'sorti' || !!d.dateSortie, {
    message: 'La date de sortie est requise pour marquer un employé sorti',
    path: ['dateSortie'],
  });

const schemaChantier = z.object({
  chantierId: z.string().uuid().nullable(),
});

const schemaSoumisPointage = z.object({
  soumisPointage: z.boolean(),
});

const schemaCreationEmploye = z.object({
  matricule: z.string().min(1),
  nom: z.string().min(1),
  prenoms: z.string().min(1),
  dateNaissance: z.string(),
  sexe: z.enum(['M', 'F']),
  nationalite: z.string().min(1),
  telephone: z.string().min(1),
  numCnib: z.string().min(1),
  numCnss: z.string().min(1),
  rib: z.string().optional(),
  banque: z.string().optional(),
  modePaiement: z.string().optional(),
  personnesACharge: z.number().int().nonnegative().optional(),
  filialeId: z.string().uuid(),
  departementId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  fonctionId: z.string().uuid().optional(),
  chantierId: z.string().uuid().optional(),
  dateEmbauche: z.string(),
  categorieProfessionnelle: z.string().min(1).optional(),
  soumisPointage: z.boolean().optional(),
  situationMatrimoniale: z.string().optional(),
  groupeSanguin: z.string().optional(),
  contactUrgenceNom: z.string().optional(),
  contactUrgenceLien: z.string().optional(),
  contactUrgenceTel: z.string().optional(),
  contactUrgenceTel2: z.string().optional(),
  maladieParticuliere: z.string().optional(),
});

const schemaModificationEmploye = schemaCreationEmploye.partial();

export async function lister(req: Request, res: Response) {
  const utilisateur = req.utilisateur!;
  const filiales = filialesAutoriseesPour(utilisateur);
  const chantiers = await chantiersAutorisesPour(utilisateur.sub, utilisateur.role, filiales);
  const recherche = req.query.recherche as string | undefined;
  const limite = req.query.limite ? Number(req.query.limite) : undefined;
  res.json(await listerEmployes(filiales, chantiers, recherche, limite));
}

// Un employé est dans le périmètre si sa filiale y est, OU si son chantier y est (Responsable RH
// Chantier n'est jamais rattaché à une filiale — cf. chantiersAutorisesPour).
async function verifierAccesEmploye(req: Request, filialeId: string, chantierId: string | null): Promise<void> {
  const utilisateur = req.utilisateur!;
  const filiales = filialesAutoriseesPour(utilisateur);
  if (filiales === null || filiales.includes(filialeId)) return;

  if (chantierId) {
    const chantiers = await chantiersAutorisesPour(utilisateur.sub, utilisateur.role, filiales);
    if (chantiers === null || chantiers.includes(chantierId)) return;
  }

  throw new ErreurApplicative(403, "Cet employé n'appartient pas à votre périmètre");
}

export async function obtenir(req: Request, res: Response) {
  const employe = await obtenirEmploye(req.params.id);

  if (!employe) {
    throw new ErreurApplicative(404, 'Employé introuvable');
  }

  await verifierAccesEmploye(req, employe.filialeId, employe.chantierId);

  res.json(employe);
}

export async function resumeRh(req: Request, res: Response) {
  const employe = await obtenirEmploye(req.params.id);

  if (!employe) {
    throw new ErreurApplicative(404, 'Employé introuvable');
  }

  await verifierAccesEmploye(req, employe.filialeId, employe.chantierId);

  res.json(await obtenirResumeRhEmploye(req.params.id));
}

export async function creer(req: Request, res: Response) {
  const donnees = schemaCreationEmploye.parse(req.body);
  const employe = await creerEmploye(donnees);
  res.status(201).json(employe);
}

export async function modifier(req: Request, res: Response) {
  const employe = await obtenirEmploye(req.params.id);

  if (!employe) {
    throw new ErreurApplicative(404, 'Employé introuvable');
  }

  await verifierAccesEmploye(req, employe.filialeId, employe.chantierId);

  const donnees = schemaModificationEmploye.parse(req.body);
  res.json(await modifierEmploye(req.params.id, donnees));
}

export async function changerStatut(req: Request, res: Response) {
  const { statut, dateSortie, motifSortie } = schemaStatut.parse(req.body);
  res.json(await changerStatutEmploye(req.params.id, statut, dateSortie, motifSortie));
}

export async function affecterChantier(req: Request, res: Response) {
  const { chantierId } = schemaChantier.parse(req.body);
  res.json(await affecterChantierEmploye(req.params.id, chantierId));
}

export async function changerSoumisPointage(req: Request, res: Response) {
  const { soumisPointage } = schemaSoumisPointage.parse(req.body);
  res.json(await definirSoumisPointage(req.params.id, soumisPointage));
}
