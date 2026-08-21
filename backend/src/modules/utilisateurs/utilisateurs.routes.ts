import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles } from '../../middleware/autorisation';
import { changerRole, changerStatut, creer, lister, majPerimetre, reinitialiser } from './utilisateurs.controller';

export const routesUtilisateurs = Router();

routesUtilisateurs.use(authentification);
routesUtilisateurs.use(autoriserRoles('super_admin', 'drh_holding', 'rh_filiale'));

routesUtilisateurs.get('/', asyncHandler(lister));
routesUtilisateurs.post('/', asyncHandler(creer));
routesUtilisateurs.post('/:id/role', asyncHandler(changerRole));
routesUtilisateurs.post('/:id/statut', asyncHandler(changerStatut));
routesUtilisateurs.post('/:id/reinitialiser-mot-de-passe', asyncHandler(reinitialiser));
routesUtilisateurs.patch('/:id/perimetre', asyncHandler(majPerimetre));
