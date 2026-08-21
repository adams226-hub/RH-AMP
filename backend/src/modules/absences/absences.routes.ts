import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles } from '../../middleware/autorisation';
import {
  bareme,
  demandeFiche,
  demandesAvis,
  demandesCreer,
  demandesDecision,
  demandesListe,
  soldePermission,
} from './absences.controller';

export const routesAbsences = Router();

routesAbsences.use(authentification);

routesAbsences.get('/bareme', asyncHandler(bareme));
routesAbsences.get('/solde-permission', asyncHandler(soldePermission));
routesAbsences.get('/demandes', asyncHandler(demandesListe));
routesAbsences.post('/demandes', asyncHandler(demandesCreer));
routesAbsences.get('/demandes/:id/fiche', asyncHandler(demandeFiche));
routesAbsences.post(
  '/demandes/:id/avis',
  autoriserRoles('chef_service', 'super_admin'),
  asyncHandler(demandesAvis)
);
routesAbsences.post(
  '/demandes/:id/decision',
  autoriserRoles('rh_filiale', 'drh_holding', 'super_admin'),
  asyncHandler(demandesDecision)
);
