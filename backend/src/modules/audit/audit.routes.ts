import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles } from '../../middleware/autorisation';
import { journal } from './audit.controller';

export const routesAudit = Router();

routesAudit.use(authentification);
routesAudit.use(autoriserRoles('super_admin'));

routesAudit.get('/journal', asyncHandler(journal));
