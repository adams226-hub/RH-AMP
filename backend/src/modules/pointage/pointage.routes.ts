import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles } from '../../middleware/autorisation';
import {
  chantierEmployes,
  chantiersArchiver,
  chantiersCreer,
  chantiersListe,
  chantiersRenommer,
  fichesExportExcel,
  fichesListe,
  ficheAnomalies,
  ficheEmploye,
  ficheEnregistrer,
  fichePdf,
  ficheRejeter,
  ficheSoumettre,
  ficheValider,
} from './pointage.controller';

export const routesPointage = Router();

routesPointage.use(authentification);

const saisieChantier = autoriserRoles('super_admin', 'drh_holding', 'rh_filiale', 'responsable_rh_chantier');
const gestionnairesStructure = autoriserRoles('super_admin', 'drh_holding', 'rh_filiale');
const validationSiege = autoriserRoles('super_admin', 'drh_holding', 'rh_filiale');
const admin = autoriserRoles('super_admin');

routesPointage.get('/chantiers', asyncHandler(chantiersListe));
routesPointage.post('/chantiers', gestionnairesStructure, asyncHandler(chantiersCreer));
routesPointage.patch('/chantiers/:id', gestionnairesStructure, asyncHandler(chantiersRenommer));
routesPointage.post('/chantiers/:id/statut', admin, asyncHandler(chantiersArchiver));
routesPointage.get('/chantiers/:id/employes', saisieChantier, asyncHandler(chantierEmployes));

routesPointage.get('/fiches', saisieChantier, asyncHandler(fichesListe));
routesPointage.get('/fiches/export-excel', saisieChantier, asyncHandler(fichesExportExcel));
routesPointage.get('/fiches/employe', asyncHandler(ficheEmploye));
routesPointage.post('/fiches', saisieChantier, asyncHandler(ficheEnregistrer));
routesPointage.post('/fiches/:id/soumettre', saisieChantier, asyncHandler(ficheSoumettre));
routesPointage.get('/fiches/:id/anomalies', validationSiege, asyncHandler(ficheAnomalies));
routesPointage.post('/fiches/:id/valider', validationSiege, asyncHandler(ficheValider));
routesPointage.post('/fiches/:id/rejeter', validationSiege, asyncHandler(ficheRejeter));
routesPointage.get('/fiches/:id/pdf', asyncHandler(fichePdf));
