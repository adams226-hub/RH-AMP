import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles } from '../../middleware/autorisation';
import {
  departementsArchiver,
  departementsCreer,
  departementsListe,
  departementsRenommer,
  filialesArchiver,
  filialesCreer,
  filialesListe,
  filialesRenommer,
  fonctionsArchiver,
  fonctionsCreer,
  fonctionsListe,
  fonctionsRenommer,
  servicesArchiver,
  servicesCreer,
  servicesListe,
  servicesRenommer,
} from './postes.controller';

export const routesPostes = Router();

routesPostes.use(authentification);

const gestionnairesStructure = autoriserRoles('super_admin', 'drh_holding', 'rh_filiale');
// Archivage/réactivation réservé à super_admin (cf. décision produit) — plus restrictif que la
// création/le renommage, ouverts à gestionnairesStructure.
const admin = autoriserRoles('super_admin');

routesPostes.get('/filiales', asyncHandler(filialesListe));
routesPostes.post('/filiales', gestionnairesStructure, asyncHandler(filialesCreer));
routesPostes.patch('/filiales/:id', gestionnairesStructure, asyncHandler(filialesRenommer));
routesPostes.post('/filiales/:id/statut', admin, asyncHandler(filialesArchiver));

routesPostes.get('/departements', asyncHandler(departementsListe));
routesPostes.post('/departements', gestionnairesStructure, asyncHandler(departementsCreer));
routesPostes.patch('/departements/:id', gestionnairesStructure, asyncHandler(departementsRenommer));
routesPostes.post('/departements/:id/statut', admin, asyncHandler(departementsArchiver));

routesPostes.get('/services', asyncHandler(servicesListe));
routesPostes.post('/services', gestionnairesStructure, asyncHandler(servicesCreer));
routesPostes.patch('/services/:id', gestionnairesStructure, asyncHandler(servicesRenommer));
routesPostes.post('/services/:id/statut', admin, asyncHandler(servicesArchiver));

routesPostes.get('/fonctions', asyncHandler(fonctionsListe));
routesPostes.post('/fonctions', gestionnairesStructure, asyncHandler(fonctionsCreer));
routesPostes.patch('/fonctions/:id', gestionnairesStructure, asyncHandler(fonctionsRenommer));
routesPostes.post('/fonctions/:id/statut', admin, asyncHandler(fonctionsArchiver));
