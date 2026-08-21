import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles } from '../../middleware/autorisation';
import { enregistrer, lister, supprimer } from './elementsVariables.controller';

export const routesElementsVariables = Router();

routesElementsVariables.use(authentification);

const gestionnairesPaie = autoriserRoles('super_admin', 'drh_holding', 'rh_filiale');

routesElementsVariables.get('/', gestionnairesPaie, asyncHandler(lister));
routesElementsVariables.post('/', gestionnairesPaie, asyncHandler(enregistrer));
routesElementsVariables.delete('/:id', gestionnairesPaie, asyncHandler(supprimer));
