import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../utils/asyncHandler';
import { connexion } from './auth.controller';

export const routesAuth = Router();

// Limite les tentatives de connexion par IP — sans ça, rien n'empêche un script d'essayer des
// milliers de mots de passe à la suite sur un même compte (audit sécurité). Compte sur
// `app.set('trust proxy', 1)` dans app.ts pour lire la vraie IP du visiteur derrière Traefik,
// sinon tout le monde partagerait la même IP (celle du proxy) et se bloquerait mutuellement.
const limiteurConnexion = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erreur: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' },
});

routesAuth.post('/connexion', limiteurConnexion, asyncHandler(connexion));
