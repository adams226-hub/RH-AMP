import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles } from '../../middleware/autorisation';
import { creer, exportExcel, lister, retour } from './missions.controller';

export const routesMissions = Router();

routesMissions.use(authentification);

routesMissions.get('/', asyncHandler(lister));
routesMissions.get('/export-excel', asyncHandler(exportExcel));
routesMissions.post('/', autoriserRoles('super_admin', 'drh_holding', 'rh_filiale'), asyncHandler(creer));
routesMissions.post('/:id/retour', autoriserRoles('super_admin', 'drh_holding', 'rh_filiale'), asyncHandler(retour));
