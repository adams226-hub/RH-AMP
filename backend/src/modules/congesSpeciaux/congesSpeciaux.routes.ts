import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles } from '../../middleware/autorisation';
import { demandesCreer, demandesDecision, demandesListe } from './congesSpeciaux.controller';

export const routesCongesSpeciaux = Router();

routesCongesSpeciaux.use(authentification);

routesCongesSpeciaux.get('/demandes', asyncHandler(demandesListe));
routesCongesSpeciaux.post('/demandes', asyncHandler(demandesCreer));
routesCongesSpeciaux.post(
  '/demandes/:id/decision',
  autoriserRoles('rh_filiale', 'drh_holding', 'super_admin'),
  asyncHandler(demandesDecision)
);
