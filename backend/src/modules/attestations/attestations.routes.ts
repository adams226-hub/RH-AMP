import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles } from '../../middleware/autorisation';
import { apercu, generer, lister, pdf, stagiaireEnregistrer, stagiaireObtenir } from './attestations.controller';

export const routesAttestations = Router();

routesAttestations.use(authentification);

// Réservé aux mêmes rôles que la création d'Ordres de mission (SPEC_MODULE_ATTESTATIONS_AMP.md
// §7) — pas d'accès employé en libre-service, cohérent avec le reste du système RH.
const gestionnairesAttestations = autoriserRoles('super_admin', 'drh_holding', 'rh_filiale');
routesAttestations.use(gestionnairesAttestations);

routesAttestations.get('/', asyncHandler(lister));
routesAttestations.get('/apercu', asyncHandler(apercu));
routesAttestations.post('/', asyncHandler(generer));
routesAttestations.get('/:id/pdf', asyncHandler(pdf));

routesAttestations.get('/stagiaires/:employeId', asyncHandler(stagiaireObtenir));
routesAttestations.post('/stagiaires/:employeId', asyncHandler(stagiaireEnregistrer));
