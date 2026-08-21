import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles } from '../../middleware/autorisation';
import { activer, creer, lister, listerExpirations, obtenir, rompre, renouveler } from './contrats.controller';

export const routesContrats = Router();

routesContrats.use(authentification);

const gestionnairesContrats = autoriserRoles('super_admin', 'drh_holding', 'rh_filiale');

routesContrats.get('/', asyncHandler(lister));
routesContrats.get('/expirations', gestionnairesContrats, asyncHandler(listerExpirations));
routesContrats.get('/:id', asyncHandler(obtenir));
routesContrats.post('/', gestionnairesContrats, asyncHandler(creer));
routesContrats.post('/:id/activer', gestionnairesContrats, asyncHandler(activer));
routesContrats.post('/:id/renouveler', gestionnairesContrats, asyncHandler(renouveler));
routesContrats.post('/:id/rompre', gestionnairesContrats, asyncHandler(rompre));
