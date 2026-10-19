import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles, exigerModule, gestionnairesDuModule } from '../../middleware/autorisation';
import {
  affecterChantier,
  changerRemunereAuJour,
  changerSoumisPointage,
  changerStatut,
  creer,
  lister,
  modifier,
  obtenir,
  resumeRh,
  tauxJournalierDefinir,
  tauxJournalierObtenir,
} from './employes.controller';

export const routesEmployes = Router();

routesEmployes.use(authentification);

const gestionnairesEmployes = autoriserRoles('super_admin', 'drh_holding', 'rh_filiale', ...gestionnairesDuModule('employes'));
// Liste et fiche restent lisibles par tous : le sélecteur d'employé des autres modules (Congés,
// Contrats, Paie...) s'en sert. Le résumé RH et le taux journalier, eux, relèvent du module Employés.
const moduleEmployes = exigerModule('employes');

routesEmployes.get('/', asyncHandler(lister));
routesEmployes.get('/:id', asyncHandler(obtenir));
routesEmployes.get('/:id/resume-rh', moduleEmployes, asyncHandler(resumeRh));
routesEmployes.post('/', gestionnairesEmployes, asyncHandler(creer));
routesEmployes.patch('/:id', gestionnairesEmployes, asyncHandler(modifier));
routesEmployes.post('/:id/statut', gestionnairesEmployes, asyncHandler(changerStatut));
routesEmployes.post('/:id/chantier', gestionnairesEmployes, asyncHandler(affecterChantier));
routesEmployes.post('/:id/pointage', gestionnairesEmployes, asyncHandler(changerSoumisPointage));
routesEmployes.post('/:id/remunere-au-jour', gestionnairesEmployes, asyncHandler(changerRemunereAuJour));
routesEmployes.get('/:id/taux-journalier', moduleEmployes, asyncHandler(tauxJournalierObtenir));
routesEmployes.put('/:id/taux-journalier', gestionnairesEmployes, asyncHandler(tauxJournalierDefinir));
