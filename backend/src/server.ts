import { app } from './app';
import { env } from './config/env';
import { pool } from './config/db';

async function demarrer() {
  await pool.query('SELECT 1'); // vérifie la connexion DB avant d'accepter du trafic

  app.listen(env.PORT, () => {
    console.log(`Backend RH AMP Holding démarré sur le port ${env.PORT}`);
  });
}

demarrer().catch((erreur) => {
  console.error('Échec du démarrage du serveur', erreur);
  process.exit(1);
});
