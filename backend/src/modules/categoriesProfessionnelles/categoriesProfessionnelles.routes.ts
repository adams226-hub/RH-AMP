import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles } from '../../middleware/autorisation';
import { archiver, creer, lister, modifier } from './categoriesProfessionnelles.controller';

export const routesCategoriesProfessionnelles = Router();

routesCategoriesProfessionnelles.use(authentification);

const gestionnairesStructure = autoriserRoles('super_admin', 'drh_holding', 'rh_filiale');
// Archivage/modification réservés à super_admin — le champ est_cadre touche directement le calcul
// de paie (abattement IUTS), plus sensible qu'un simple renommage de département/service/fonction.
const admin = autoriserRoles('super_admin');

routesCategoriesProfessionnelles.get('/', gestionnairesStructure, asyncHandler(lister));
routesCategoriesProfessionnelles.post('/', admin, asyncHandler(creer));
routesCategoriesProfessionnelles.patch('/:id', admin, asyncHandler(modifier));
routesCategoriesProfessionnelles.post('/:id/statut', admin, asyncHandler(archiver));
