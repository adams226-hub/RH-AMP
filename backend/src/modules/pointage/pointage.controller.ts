import { Request, Response } from 'express';
import { z } from 'zod';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { filialesAutoriseesPour } from '../../middleware/autorisation';
import {
  archiverChantier,
  chantiersAutorisesPour,
  creerChantier,
  detecterAnomalies,
  enregistrerFiche,
  listerChantiers,
  listerFiches,
  listerFicheMensuelle,
  listerJours,
  obtenirFichePourAcces,
  rejeter,
  renommerChantier,
  soumettre,
  valider,
} from './pointage.service';
import { genererFichePointagePdf } from './pointage.pdf';

const schemaCreationChantier = z.object({
  filialeId: z.string().uuid(),
  nom: z.string().min(1),
  localisation: z.string().optional(),
  responsableId: z.string().uuid().optional(),
});

const schemaJour = z.object({
  date: z.string(),
  heures: z.number().min(0).max(24).optional(),
  codeAbsence: z
    .enum(['absence_injustifiee', 'repos_medical', 'permission_non_payee', 'permission_payee', 'conge_annuel', 'ferie'])
    .optional(),
});

// Plafonds pour éviter une saisie aberrante (ex. faute de frappe : 3000 au lieu de 3) de crasher
// en 500 sur une contrainte NUMERIC — jours_panier/nb_jours_* sont NUMERIC(5,2) en base (max
// théorique 999.99), mais un mois n'a jamais plus de 31 jours ; heures_hs_15/35/60 sont
// NUMERIC(6,2), plafonnées ici à 31 jours × 24h en borne large mais sensée.
const MAX_JOURS_MOIS = 31;
const MAX_HEURES_MOIS = 31 * 24;

const schemaSaisie = z
  .object({
    employeId: z.string().uuid(),
    chantierId: z.string().uuid(),
    periodeDebut: z.string(),
    periodeFin: z.string(),
    heuresHs15: z.number().min(0).max(MAX_HEURES_MOIS).optional(),
    heuresHs35: z.number().min(0).max(MAX_HEURES_MOIS).optional(),
    heuresHs60: z.number().min(0).max(MAX_HEURES_MOIS).optional(),
    joursPanier: z.number().min(0).max(MAX_JOURS_MOIS).optional(),
    nbJoursAbsenceInjustifiee: z.number().min(0).max(MAX_JOURS_MOIS).optional(),
    nbJoursReposMedical: z.number().min(0).max(MAX_JOURS_MOIS).optional(),
    nbJoursPermissionNonPayee: z.number().min(0).max(MAX_JOURS_MOIS).optional(),
    nbJoursPermissionPayee: z.number().min(0).max(MAX_JOURS_MOIS).optional(),
    nbJoursCongeAnnuel: z.number().min(0).max(MAX_JOURS_MOIS).optional(),
    jours: z.array(schemaJour).optional(),
  })
  // Même règle que la contrainte CHECK (periode_fin >= periode_debut) de pointages_mensuels —
  // vérifiée ici pour renvoyer un message clair plutôt qu'une erreur SQL brute en 500.
  .refine((donnees) => donnees.periodeFin >= donnees.periodeDebut, {
    message: 'La date de fin doit être postérieure ou égale à la date de début',
    path: ['periodeFin'],
  });

const schemaRejet = z.object({
  commentaire: z.string().min(1),
});

const schemaRenommerChantier = z.object({ nom: z.string().min(1) });
const schemaStatutChantier = z.object({ actif: z.boolean() });

const ROLES_GESTION_STRUCTURE = ['super_admin', 'drh_holding', 'rh_filiale'];

async function chantiersDuRequerant(req: Request): Promise<string[] | null> {
  const utilisateur = req.utilisateur!;
  const filiales = filialesAutoriseesPour(utilisateur);
  return chantiersAutorisesPour(utilisateur.sub, utilisateur.role, filiales);
}

export async function chantiersListe(req: Request, res: Response) {
  const chantiers = await chantiersDuRequerant(req);
  // inclureArchives réservé à l'écran d'administration (Paramètres > Référentiels) — jamais
  // honoré pour la saisie de pointage elle-même, même si le paramètre est envoyé.
  const inclureArchives =
    req.query.inclureArchives === 'true' && ROLES_GESTION_STRUCTURE.includes(req.utilisateur!.role);
  res.json(await listerChantiers(chantiers, inclureArchives));
}

export async function chantiersCreer(req: Request, res: Response) {
  const donnees = schemaCreationChantier.parse(req.body);
  res.status(201).json(await creerChantier(donnees));
}

export async function chantiersRenommer(req: Request, res: Response) {
  const { nom } = schemaRenommerChantier.parse(req.body);
  res.json(await renommerChantier(req.params.id, nom));
}

export async function chantiersArchiver(req: Request, res: Response) {
  const { actif } = schemaStatutChantier.parse(req.body);
  res.json(await archiverChantier(req.params.id, actif));
}

export async function fichesListe(req: Request, res: Response) {
  const chantiers = await chantiersDuRequerant(req);
  const statut = req.query.statut as string | undefined;
  const moisPaie = req.query.moisPaie as string | undefined;
  res.json(await listerFiches(chantiers, statut, moisPaie));
}

export async function ficheEmploye(req: Request, res: Response) {
  const employeId = req.query.employeId as string | undefined;
  const moisPaie = req.query.moisPaie as string | undefined;
  if (!employeId || !moisPaie) {
    throw new ErreurApplicative(400, 'employeId et moisPaie sont requis');
  }

  const fiche = await listerFicheMensuelle(employeId, moisPaie);
  if (!fiche) {
    res.json(null);
    return;
  }

  const jours = await listerJours(fiche.id);
  res.json({ ...fiche, jours });
}

async function verifierAccesChantier(req: Request, chantierId: string): Promise<void> {
  const chantiers = await chantiersDuRequerant(req);
  if (chantiers !== null && !chantiers.includes(chantierId)) {
    throw new ErreurApplicative(403, "Ce chantier n'est pas dans votre périmètre");
  }
}

export async function ficheEnregistrer(req: Request, res: Response) {
  const donnees = schemaSaisie.parse(req.body);
  await verifierAccesChantier(req, donnees.chantierId);
  res.status(201).json(await enregistrerFiche(donnees));
}

export async function ficheSoumettre(req: Request, res: Response) {
  const acces = await obtenirFichePourAcces(req.params.id);
  if (!acces) throw new ErreurApplicative(404, 'Fiche introuvable');
  await verifierAccesChantier(req, acces.chantierId);
  res.json(await soumettre(req.params.id, req.utilisateur!.sub));
}

export async function ficheAnomalies(req: Request, res: Response) {
  const acces = await obtenirFichePourAcces(req.params.id);
  if (!acces) throw new ErreurApplicative(404, 'Fiche introuvable');
  res.json(await detecterAnomalies(req.params.id, acces.employeId));
}

export async function ficheValider(req: Request, res: Response) {
  const acces = await obtenirFichePourAcces(req.params.id);
  if (!acces) throw new ErreurApplicative(404, 'Fiche introuvable');
  res.json(await valider(req.params.id, req.utilisateur!.sub));
}

export async function ficheRejeter(req: Request, res: Response) {
  const { commentaire } = schemaRejet.parse(req.body);
  const acces = await obtenirFichePourAcces(req.params.id);
  if (!acces) throw new ErreurApplicative(404, 'Fiche introuvable');
  res.json(await rejeter(req.params.id, req.utilisateur!.sub, commentaire));
}

export async function fichePdf(req: Request, res: Response) {
  const acces = await obtenirFichePourAcces(req.params.id);
  if (!acces) throw new ErreurApplicative(404, 'Fiche introuvable');

  const utilisateur = req.utilisateur!;
  if (utilisateur.employeId !== acces.employeId) {
    await verifierAccesChantier(req, acces.chantierId);
  }

  const pdf = await genererFichePointagePdf(req.params.id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="pointage-${req.params.id}.pdf"`);
  res.send(pdf);
}
