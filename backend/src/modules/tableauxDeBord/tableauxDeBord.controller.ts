import { Request, Response } from 'express';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { filialesAutoriseesPour } from '../../middleware/autorisation';
import {
  obtenirEffectif,
  obtenirMasseSalariale,
  obtenirMasseSalarialeParPeriode,
  obtenirPyramideAges,
  obtenirRepartitionContrats,
  obtenirSorties,
  obtenirSyntheseConges,
  obtenirTurnover,
} from './tableauxDeBord.service';
import { obtenirApercuRH } from './rhOverview.service';
import { FiltresRHOverview } from './rhOverview.types';

// Le Chef de service n'a pas de périmètre filiale modélisé (cf. note dans le service) —
// on ne lui applique donc pas la restriction plutôt que de lui afficher un tableau de bord
// à zéro par erreur ; RH Filiale/DRH/Super Admin utilisent leur périmètre réel.
function filialesPourTableauDeBord(req: Request): string[] | null {
  if (req.utilisateur!.role === 'chef_service') return null;

  const base = filialesAutoriseesPour(req.utilisateur!);
  const filialeIdDemandee = req.query.filialeId as string | undefined;

  if (!filialeIdDemandee) return base;

  if (base !== null && !base.includes(filialeIdDemandee)) {
    throw new ErreurApplicative(403, "Cette filiale n'est pas dans votre périmètre");
  }

  return [filialeIdDemandee];
}

export async function effectif(req: Request, res: Response) {
  res.json(await obtenirEffectif(filialesPourTableauDeBord(req)));
}

export async function contrats(req: Request, res: Response) {
  res.json(await obtenirRepartitionContrats(filialesPourTableauDeBord(req)));
}

export async function conges(req: Request, res: Response) {
  res.json(await obtenirSyntheseConges(filialesPourTableauDeBord(req)));
}

export async function masseSalariale(req: Request, res: Response) {
  const periode = (req.query.periode as string) ?? new Date().toISOString().slice(0, 10);
  res.json(await obtenirMasseSalariale(filialesPourTableauDeBord(req), periode));
}

export async function masseSalarialeParPeriode(req: Request, res: Response) {
  const maintenant = new Date();
  const periodeFinDefaut = maintenant.toISOString().slice(0, 7);
  const periodeDebutDefaut = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - 5, 1))
    .toISOString()
    .slice(0, 7);

  const periodeDebut = (req.query.periodeDebut as string) ?? periodeDebutDefaut;
  const periodeFin = (req.query.periodeFin as string) ?? periodeFinDefaut;

  res.json(await obtenirMasseSalarialeParPeriode(filialesPourTableauDeBord(req), periodeDebut, periodeFin));
}

export async function sorties(req: Request, res: Response) {
  const maintenant = new Date();
  const dateFinDefaut = maintenant.toISOString().slice(0, 10);
  const dateDebutDefaut = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - 11, 1))
    .toISOString()
    .slice(0, 10);

  const dateDebut = (req.query.dateDebut as string) ?? dateDebutDefaut;
  const dateFin = (req.query.dateFin as string) ?? dateFinDefaut;

  res.json(await obtenirSorties(filialesPourTableauDeBord(req), dateDebut, dateFin));
}

export async function pyramideAges(req: Request, res: Response) {
  res.json(await obtenirPyramideAges(filialesPourTableauDeBord(req)));
}

// Chef de service : même limite que filialesPourTableauDeBord (pas de périmètre modélisé).
function filialesRBACBase(req: Request): string[] | null {
  if (req.utilisateur!.role === 'chef_service') return null;
  return filialesAutoriseesPour(req.utilisateur!);
}

// Accepte ?param=a&param=b (tableau natif Express/qs) ou ?param=a,b (repli pratique).
function parseListe(valeur: unknown): string[] | undefined {
  if (!valeur) return undefined;
  const brut = Array.isArray(valeur) ? valeur : [valeur];
  const aplati = brut.flatMap((v) => String(v).split(','));
  const nettoye = aplati.map((v) => v.trim()).filter(Boolean);
  return nettoye.length > 0 ? nettoye : undefined;
}

export async function rhOverview(req: Request, res: Response) {
  const filtres: FiltresRHOverview = {
    filialeId: parseListe(req.query.filialeId),
    categorieProfessionnelle: parseListe(req.query.categorieProfessionnelle) as FiltresRHOverview['categorieProfessionnelle'],
    sexe: parseListe(req.query.sexe) as FiltresRHOverview['sexe'],
    typeContrat: parseListe(req.query.typeContrat),
  };

  res.json(await obtenirApercuRH(filialesRBACBase(req), filtres));
}

export async function turnover(req: Request, res: Response) {
  const maintenant = new Date();
  const dateFinDefaut = maintenant.toISOString().slice(0, 10);
  const dateDebutDefaut = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - 1, maintenant.getUTCDate()))
    .toISOString()
    .slice(0, 10);

  const dateDebut = (req.query.dateDebut as string) ?? dateDebutDefaut;
  const dateFin = (req.query.dateFin as string) ?? dateFinDefaut;

  res.json(await obtenirTurnover(filialesPourTableauDeBord(req), dateDebut, dateFin));
}
