import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles } from '../../middleware/autorisation';
import { demandesAvis, demandesCreer, demandesDecision, demandesListe, solde } from './conges.controller';

export const routesConges = Router();

routesConges.use(authentification);

routesConges.get('/solde', asyncHandler(solde));
routesConges.get('/demandes', asyncHandler(demandesListe));
routesConges.post('/demandes', asyncHandler(demandesCreer));
routesConges.post('/demandes/:id/avis', autoriserRoles('chef_service', 'super_admin'), asyncHandler(demandesAvis));
routesConges.post(
  '/demandes/:id/decision',
  autoriserRoles('rh_filiale', 'drh_holding', 'super_admin'),
  asyncHandler(demandesDecision)
);
