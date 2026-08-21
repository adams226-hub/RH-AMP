import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles } from '../../middleware/autorisation';
import { calculer, cloturerCycle, journal, lister, resume, reouvrirCycle, verifier } from './cyclesPaie.controller';

export const routesCyclesPaie = Router();

routesCyclesPaie.use(authentification);

const gestionnairesPaie = autoriserRoles('super_admin', 'drh_holding', 'rh_filiale');
const adminDaf = autoriserRoles('super_admin', 'drh_holding');

routesCyclesPaie.get('/', gestionnairesPaie, asyncHandler(lister));
routesCyclesPaie.get('/resume', gestionnairesPaie, asyncHandler(resume));
routesCyclesPaie.get('/journal', gestionnairesPaie, asyncHandler(journal));
routesCyclesPaie.post('/calculer', gestionnairesPaie, asyncHandler(calculer));
routesCyclesPaie.post('/verifier', gestionnairesPaie, asyncHandler(verifier));
routesCyclesPaie.post('/cloturer', gestionnairesPaie, asyncHandler(cloturerCycle));
// Réouverture réservée à un rôle admin/DAF (ADDENDUM_JOURNAL_PAIE_AMP.md §2).
routesCyclesPaie.post('/reouvrir', adminDaf, asyncHandler(reouvrirCycle));
