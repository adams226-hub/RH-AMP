import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { connexion } from './auth.controller';

export const routesAuth = Router();

routesAuth.post('/connexion', asyncHandler(connexion));
