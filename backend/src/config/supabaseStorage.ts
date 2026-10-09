import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
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

  // On n'utilise que le Storage (jamais Realtime), mais le client Supabase instancie quand même un
  // RealtimeClient en interne, qui exige un WebSocket natif — absent en Node 20 (image Docker du
  // backend), d'où l'erreur "native WebSocket not found" qui faisait échouer tout appel nécessitant
  // le logo d'une filiale (ex. téléchargement de bulletin de paie en PDF). On fournit `ws` comme
  // implémentation : il ne sera jamais réellement connecté puisqu'aucun canal Realtime n'est ouvert.
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    realtime: { transport: WebSocket as never },
  });
}

export const BUCKET_LOGOS = 'logos';
