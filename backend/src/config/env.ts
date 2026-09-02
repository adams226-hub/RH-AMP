import 'dotenv/config';
import { z } from 'zod';

// Validation au démarrage : on échoue immédiatement si une variable critique manque,
// plutôt que de planter plus tard au milieu d'une requête.
const schemaEnv = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requis (connexion PostgreSQL Supabase)'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET doit faire au moins 16 caractères'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  // Délai artificiel (ms) ajouté à chaque requête API — outil de dev pour tester les écrans de
  // chargement dans des conditions de réseau lent. 0 = désactivé (comportement normal). Jamais
  // utile en production, à ne pas définir dans un .env de déploiement.
  LATENCE_SIMULEE_MS: z.coerce.number().nonnegative().default(0),
});

const resultat = schemaEnv.safeParse(process.env);

if (!resultat.success) {
  console.error('Configuration invalide :', resultat.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = resultat.data;
