import { Pool, types } from 'pg';
import { env } from './env';

// node-postgres convertit par défaut les colonnes DATE en objets JS Date, ce qui introduit
// un décalage de fuseau horaire à la sérialisation JSON (ex. 2026-01-01 devient
// 2025-12-31T23:00:00Z). On désactive ce parsing pour le type DATE (OID 1082) : le backend
// renvoie la chaîne brute "YYYY-MM-DD" telle que Postgres la fournit, sans conversion.
types.setTypeParser(1082, (valeur) => valeur);

// Supabase exige SSL ; rejectUnauthorized à false car le certificat intermédiaire
// utilisé par Supabase n'est pas reconnu par défaut par le magasin de certificats Node.
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (erreur) => {
  console.error('Erreur inattendue du pool PostgreSQL', erreur);
});
