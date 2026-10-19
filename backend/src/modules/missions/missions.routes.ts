import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles, exigerModule, gestionnairesDuModule } from '../../middleware/autorisation';
import {
  archiverMaison,
  creer,
  creerMaison,
  exportExcel,
  exportExcelHebergements,
  frais,
  lister,
  listerHebergements,
  listerMaisons,
  modifierMaison,
  retour,
  supprimerMaison,
  tarifsNuitee,
} from './missions.controller';

export const routesMissions = Router();

const ROLES_GESTION = ['super_admin', 'drh_holding', 'rh_filiale', ...gestionnairesDuModule('missions')] as const;

routesMissions.use(authentification);
routesMissions.use(exigerModule('missions'));

routesMissions.get('/', asyncHandler(lister));
routesMissions.get('/export-excel', asyncHandler(exportExcel));
routesMissions.post('/', autoriserRoles(...ROLES_GESTION), asyncHandler(creer));
routesMissions.post('/:id/retour', autoriserRoles(...ROLES_GESTION), asyncHandler(retour));
routesMissions.patch('/:id/frais', autoriserRoles(...ROLES_GESTION), asyncHandler(frais));

// Maisons d'hôte (Paramètres > Référentiels) — mêmes rôles de gestion que le référentiel Chantiers.
routesMissions.get('/tarifs-nuitee', asyncHandler(tarifsNuitee));
routesMissions.get('/maisons-hote', asyncHandler(listerMaisons));
routesMissions.post('/maisons-hote', autoriserRoles(...ROLES_GESTION), asyncHandler(creerMaison));
routesMissions.patch('/maisons-hote/:id', autoriserRoles(...ROLES_GESTION), asyncHandler(modifierMaison));
routesMissions.patch(
  '/maisons-hote/:id/statut',
  autoriserRoles(...ROLES_GESTION),
  asyncHandler(archiverMaison)
);
routesMissions.delete('/maisons-hote/:id', autoriserRoles('super_admin'), asyncHandler(supprimerMaison));

// Onglet Hébergements
routesMissions.get('/hebergements', asyncHandler(listerHebergements));
routesMissions.get('/hebergements/export-excel', asyncHandler(exportExcelHebergements));
