import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles } from '../../middleware/autorisation';
import {
  affecterChantier,
  changerSoumisPointage,
  changerStatut,
  creer,
  lister,
  obtenir,
  resumeRh,
} from './employes.controller';

export const routesEmployes = Router();

routesEmployes.use(authentification);

const gestionnairesEmployes = autoriserRoles('super_admin', 'drh_holding', 'rh_filiale');

routesEmployes.get('/', asyncHandler(lister));
routesEmployes.get('/:id', asyncHandler(obtenir));
routesEmployes.get('/:id/resume-rh', asyncHandler(resumeRh));
routesEmployes.post('/', gestionnairesEmployes, asyncHandler(creer));
routesEmployes.post('/:id/statut', gestionnairesEmployes, asyncHandler(changerStatut));
routesEmployes.post('/:id/chantier', gestionnairesEmployes, asyncHandler(affecterChantier));
routesEmployes.post('/:id/pointage', gestionnairesEmployes, asyncHandler(changerSoumisPointage));
