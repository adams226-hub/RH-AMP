import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles } from '../../middleware/autorisation';
import { creer, lister, supprimer } from './joursFeries.controller';

export const routesJoursFeries = Router();

routesJoursFeries.use(authentification);

// Lecture ouverte à tous les rôles authentifiés (le calendrier impacte le calcul de congés
// de tout le monde) ; écriture réservée à la configuration groupe.
routesJoursFeries.get('/', asyncHandler(lister));
routesJoursFeries.post('/', autoriserRoles('super_admin', 'drh_holding'), asyncHandler(creer));
routesJoursFeries.delete('/:id', autoriserRoles('super_admin', 'drh_holding'), asyncHandler(supprimer));
