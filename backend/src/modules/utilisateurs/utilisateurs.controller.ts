import { Request, Response } from 'express';
import { z } from 'zod';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { filialesAutoriseesPour } from '../../middleware/autorisation';
import { CodeRole } from '../auth/auth.types';
import {
  changerRoleUtilisateur,
  changerStatutUtilisateur,
  creerUtilisateur,
  listerUtilisateurs,
  mettreAJourPerimetre,
  reinitialiserMotDePasse,
} from './utilisateurs.service';

const ROLES = ['super_admin', 'drh_holding', 'rh_filiale', 'chef_service', 'employe', 'responsable_rh_chantier'] as const;

const schemaCreation = z.object({
  email: z.string().email(),
  role: z.enum(ROLES),
  nom: z.string().trim().min(1).optional(),
  prenoms: z.string().trim().min(1).optional(),
  employeId: z.string().uuid().optional(),
  filialeIds: z.array(z.string().uuid()).optional(),
  chantierIds: z.array(z.string().uuid()).optional(),
});

const schemaRole = z.object({ role: z.enum(ROLES) });
const schemaStatut = z.object({ statut: z.enum(['actif', 'suspendu', 'supprime']) });
const schemaPerimetre = z.object({
  filialeIds: z.array(z.string().uuid()).optional(),
  chantierIds: z.array(z.string().uuid()).optional(),
});

// Un rôle ne peut jamais attribuer un rôle "supérieur" ou égal au sien (sauf Super Admin, qui
// peut tout) — cf. specs Utilisateurs §3 : RH Filiale attribue employe/chef_service/responsable
// chantier ; DRH Holding attribue jusqu'à rh_filiale ; Super Admin attribue tout, y compris
// super_admin/drh_holding.
function rolesAssignablesPar(role: CodeRole): CodeRole[] {
  if (role === 'super_admin') return [...ROLES];
  if (role === 'drh_holding') return ['rh_filiale', 'chef_service', 'employe', 'responsable_rh_chantier'];
  if (role === 'rh_filiale') return ['chef_service', 'employe', 'responsable_rh_chantier'];
  return [];
}

export async function lister(req: Request, res: Response) {
  res.json(await listerUtilisateurs(filialesAutoriseesPour(req.utilisateur!)));
}

export async function creer(req: Request, res: Response) {
  const donnees = schemaCreation.parse(req.body);
  const requeteur = req.utilisateur!;

  if (!rolesAssignablesPar(requeteur.role).includes(donnees.role)) {
    throw new ErreurApplicative(403, `Votre rôle ne permet pas de créer un compte ${donnees.role}`);
  }

  const filiales = filialesAutoriseesPour(requeteur);
  if (filiales !== null) {
    const filialeIdsDemandes = donnees.filialeIds ?? [];
    if (filialeIdsDemandes.some((id) => !filiales.includes(id))) {
      throw new ErreurApplicative(403, "Vous ne pouvez rattacher un compte qu'à votre propre périmètre");
    }
  }

  const resultat = await creerUtilisateur(donnees);
  res.status(201).json(resultat);
}

export async function changerRole(req: Request, res: Response) {
  const { role } = schemaRole.parse(req.body);
  const requeteur = req.utilisateur!;

  if (!rolesAssignablesPar(requeteur.role).includes(role)) {
    throw new ErreurApplicative(403, `Votre rôle ne permet pas d'attribuer le rôle ${role}`);
  }

  res.json(await changerRoleUtilisateur(req.params.id, role));
}

export async function changerStatut(req: Request, res: Response) {
  const { statut } = schemaStatut.parse(req.body);
  res.json(await changerStatutUtilisateur(req.params.id, statut));
}

export async function reinitialiser(req: Request, res: Response) {
  const motDePasseTemporaire = await reinitialiserMotDePasse(req.params.id);
  res.json({ motDePasseTemporaire });
}

export async function majPerimetre(req: Request, res: Response) {
  const { filialeIds, chantierIds } = schemaPerimetre.parse(req.body);
  res.json(await mettreAJourPerimetre(req.params.id, filialeIds, chantierIds));
}
