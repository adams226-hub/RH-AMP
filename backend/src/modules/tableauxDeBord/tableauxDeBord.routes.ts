import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles } from '../../middleware/autorisation';
import {
  conges,
  contrats,
  effectif,
  masseSalariale,
  masseSalarialeParPeriode,
  pyramideAges,
  rhOverview,
  sorties,
  turnover,
} from './tableauxDeBord.controller';

export const routesTableauxDeBord = Router();

routesTableauxDeBord.use(authentification);
routesTableauxDeBord.use(autoriserRoles('super_admin', 'drh_holding', 'rh_filiale', 'chef_service'));

routesTableauxDeBord.get('/effectif', asyncHandler(effectif));
routesTableauxDeBord.get('/contrats', asyncHandler(contrats));
routesTableauxDeBord.get('/conges', asyncHandler(conges));
routesTableauxDeBord.get('/masse-salariale', asyncHandler(masseSalariale));
routesTableauxDeBord.get('/masse-salariale-periode', asyncHandler(masseSalarialeParPeriode));
routesTableauxDeBord.get('/sorties', asyncHandler(sorties));
routesTableauxDeBord.get('/pyramide-ages', asyncHandler(pyramideAges));
routesTableauxDeBord.get('/turnover', asyncHandler(turnover));
routesTableauxDeBord.get('/rh-overview', asyncHandler(rhOverview));
