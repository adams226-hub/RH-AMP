import { createClient } from '@supabase/supabase-js';
import { env } from './env';
import { ErreurApplicative } from '../middleware/gestionErreurs';

// Créé à la demande (pas au démarrage du serveur) : tant que SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY ne sont pas renseignés, le reste de l'API continue de fonctionner —
// seul le stockage des logos de filiale échoue, avec un message clair, au lieu de bloquer tout
// le serveur.
export function obtenirClientStorage() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new ErreurApplicative(
      500,
      'SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être configurés dans .env pour utiliser le stockage de fichiers'
    );
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export const BUCKET_LOGOS = 'logos';
