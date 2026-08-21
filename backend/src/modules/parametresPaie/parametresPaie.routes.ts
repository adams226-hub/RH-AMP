import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles } from '../../middleware/autorisation';
import { definir, lister } from './parametresPaie.controller';

export const routesParametresPaie = Router();

routesParametresPaie.use(authentification);

routesParametresPaie.get('/', autoriserRoles('super_admin', 'drh_holding'), asyncHandler(lister));
routesParametresPaie.put('/:cle', autoriserRoles('super_admin'), asyncHandler(definir));
