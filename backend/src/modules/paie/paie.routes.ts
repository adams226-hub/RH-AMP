import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles } from '../../middleware/autorisation';
import { calculer, calculerMasse, changerStatut, fiche, lister, simuler } from './paie.controller';

export const routesPaie = Router();

routesPaie.use(authentification);

const gestionnairesPaie = autoriserRoles('super_admin', 'drh_holding', 'rh_filiale');

routesPaie.get('/bulletins', asyncHandler(lister));
routesPaie.get('/bulletins/:id/fiche', asyncHandler(fiche));
routesPaie.post('/bulletins/calculer', gestionnairesPaie, asyncHandler(calculer));
routesPaie.post('/bulletins/calculer-masse', gestionnairesPaie, asyncHandler(calculerMasse));
routesPaie.post('/simuler-net-vers-brut', gestionnairesPaie, asyncHandler(simuler));
routesPaie.post('/bulletins/:id/statut', autoriserRoles('super_admin', 'drh_holding'), asyncHandler(changerStatut));
