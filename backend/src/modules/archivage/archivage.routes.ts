import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles } from '../../middleware/autorisation';
import { deposer, lister, supprimer, telecharger } from './archivage.controller';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const routesArchivage = Router();

routesArchivage.use(authentification);

// Chef de service et Responsable RH Chantier n'ont aucun accès à ce module (cf. matrice RBAC) —
// Employé y accède mais uniquement à ses propres documents (scoping appliqué dans le contrôleur).
const rolesAutorises = autoriserRoles('super_admin', 'drh_holding', 'rh_filiale', 'employe');

routesArchivage.get('/documents', rolesAutorises, asyncHandler(lister));
routesArchivage.post('/documents', rolesAutorises, upload.single('fichier'), asyncHandler(deposer));
routesArchivage.get('/documents/:id/telecharger', rolesAutorises, asyncHandler(telecharger));
routesArchivage.delete(
  '/documents/:id',
  autoriserRoles('super_admin', 'drh_holding', 'rh_filiale'),
  asyncHandler(supprimer)
);
