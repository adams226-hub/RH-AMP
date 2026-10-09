import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../../config/db';
import { env } from '../../config/env';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { PayloadJwt } from './auth.types';

interface LigneUtilisateur {
  id: string;
  email: string;
  mot_de_passe_hash: string;
  role_code: PayloadJwt['role'];
  employe_id: string | null;
  statut: 'actif' | 'suspendu' | 'supprime';
  nom: string | null;
  prenoms: string | null;
}

export async function connecter(
  email: string,
  motDePasse: string,
  adresseIp?: string
): Promise<{ jeton: string; nom: string | null; prenoms: string | null }> {
  // COALESCE : le nom saisi directement sur le compte prime (cas d'un compte admin sans fiche
  // employé, ex. un accès réservé à l'administration) ; à défaut, celui de la fiche employé liée.
  const { rows } = await pool.query<LigneUtilisateur>(
    `SELECT u.id, u.email, u.mot_de_passe_hash, u.employe_id, u.statut, r.code AS role_code,
            COALESCE(u.nom, e.nom) AS nom, COALESCE(u.prenoms, e.prenoms) AS prenoms
     FROM utilisateurs u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN employes e ON e.id = u.employe_id
     WHERE u.email = $1`,
    [email]
  );

  const utilisateur = rows[0];

  // Même message d'erreur que l'email soit inconnu, le compte suspendu, ou le mot de passe faux :
  // on ne donne aucun indice permettant d'énumérer les comptes existants.
  if (!utilisateur || utilisateur.statut !== 'actif') {
    await journaliserConnexion(utilisateur?.id ?? null, 'connexion_echouee', adresseIp);
    throw new ErreurApplicative(401, 'Identifiants invalides');
  }

  const motDePasseValide = await bcrypt.compare(motDePasse, utilisateur.mot_de_passe_hash);

  if (!motDePasseValide) {
    await journaliserConnexion(utilisateur.id, 'connexion_echouee', adresseIp);
    throw new ErreurApplicative(401, 'Identifiants invalides');
  }

  const { rows: filialesRows } = await pool.query<{ filiale_id: string }>(
    'SELECT filiale_id FROM utilisateurs_filiales WHERE utilisateur_id = $1',
    [utilisateur.id]
  );

  const payload: PayloadJwt = {
    sub: utilisateur.id,
    role: utilisateur.role_code,
    employeId: utilisateur.employe_id,
    filiales: filialesRows.length > 0 ? filialesRows.map((r) => r.filiale_id) : null,
  };

  await pool.query('UPDATE utilisateurs SET derniere_connexion = now() WHERE id = $1', [utilisateur.id]);
  await journaliserConnexion(utilisateur.id, 'connexion', adresseIp);

  const jeton = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);

  return { jeton, nom: utilisateur.nom, prenoms: utilisateur.prenoms };
}

// Le middleware générique journalAudit ne couvre pas /connexion (non authentifiée à ce stade) —
// on journalise ici explicitement, y compris les échecs (utile pour détecter des tentatives
// répétées), sans bloquer la réponse si l'écriture échoue.
async function journaliserConnexion(
  utilisateurId: string | null,
  action: 'connexion' | 'connexion_echouee',
  adresseIp?: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO journal_audit (utilisateur_id, action, module, adresse_ip) VALUES ($1, $2, 'auth', $3)`,
      [utilisateurId, action, adresseIp ?? null]
    );
  } catch (erreur) {
    console.error("Échec de l'écriture du journal d'audit (connexion)", erreur);
  }
}
