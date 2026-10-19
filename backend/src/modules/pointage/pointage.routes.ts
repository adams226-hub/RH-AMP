import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles, exigerModule, gestionnairesDuModule } from '../../middleware/autorisation';
import {
  chantierEmployes,
  chantiersArchiver,
  chantiersCreer,
  chantiersListe,
  chantiersRenommer,
  chantiersSupprimer,
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

const saisieChantier = autoriserRoles(
  'super_admin',
  'drh_holding',
  'rh_filiale',
  'responsable_rh_chantier',
  ...gestionnairesDuModule('pointage')
);
const gestionnairesStructure = autoriserRoles('super_admin', 'drh_holding', 'rh_filiale');
const validationSiege = autoriserRoles('super_admin', 'drh_holding', 'rh_filiale', ...gestionnairesDuModule('pointage'));
// GET /chantiers reste ouvert : la liste des chantiers sert aussi aux écrans Employés et Absences.
const modulePointage = exigerModule('pointage');
const admin = autoriserRoles('super_admin');

routesPointage.get('/chantiers', asyncHandler(chantiersListe));
routesPointage.post('/chantiers', gestionnairesStructure, asyncHandler(chantiersCreer));
routesPointage.patch('/chantiers/:id', gestionnairesStructure, asyncHandler(chantiersRenommer));
routesPointage.post('/chantiers/:id/statut', admin, asyncHandler(chantiersArchiver));
routesPointage.delete('/chantiers/:id', admin, asyncHandler(chantiersSupprimer));
routesPointage.get('/chantiers/:id/employes', saisieChantier, asyncHandler(chantierEmployes));

routesPointage.get('/fiches', saisieChantier, asyncHandler(fichesListe));
routesPointage.get('/fiches/export-excel', saisieChantier, asyncHandler(fichesExportExcel));
routesPointage.get('/fiches/employe', modulePointage, asyncHandler(ficheEmploye));
routesPointage.post('/fiches', saisieChantier, asyncHandler(ficheEnregistrer));
routesPointage.post('/fiches/:id/soumettre', saisieChantier, asyncHandler(ficheSoumettre));
routesPointage.get('/fiches/:id/anomalies', validationSiege, asyncHandler(ficheAnomalies));
routesPointage.post('/fiches/:id/valider', validationSiege, asyncHandler(ficheValider));
routesPointage.post('/fiches/:id/rejeter', validationSiege, asyncHandler(ficheRejeter));
routesPointage.get('/fiches/:id/pdf', modulePointage, asyncHandler(fichePdf));
