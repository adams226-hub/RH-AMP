import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { CreationUtilisateur, StatutUtilisateur, Utilisateur } from './utilisateurs.types';

function mapLigne(l: Record<string, unknown>): Utilisateur {
  return {
    id: l.id as string,
    email: l.email as string,
    role: l.role_code as Utilisateur['role'],
    statut: l.statut as StatutUtilisateur,
    employeId: l.employe_id as string | null,
    employeNom: l.employe_nom as string | null,
    employePrenoms: l.employe_prenoms as string | null,
    filialeIds: (l.filiale_ids as string[]) ?? [],
    chantierIds: (l.chantier_ids as string[]) ?? [],
    derniereConnexion: l.derniere_connexion ? (l.derniere_connexion as Date).toISOString() : null,
    createdAt: (l.created_at as Date).toISOString(),
  };
}

const REQUETE_BASE = `
  SELECT u.id, u.email, u.statut, u.employe_id, u.derniere_connexion, u.created_at, r.code AS role_code,
         e.nom AS employe_nom, e.prenoms AS employe_prenoms,
         COALESCE((SELECT array_agg(filiale_id) FROM utilisateurs_filiales WHERE utilisateur_id = u.id), '{}') AS filiale_ids,
         COALESCE((SELECT array_agg(chantier_id) FROM utilisateurs_chantiers WHERE utilisateur_id = u.id), '{}') AS chantier_ids
  FROM utilisateurs u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN employes e ON e.id = u.employe_id
`;

// filialesAutorisees = null signifie aucune restriction (super_admin, drh_holding). Un compte
// est visible s'il est lié à un employé de ces filiales, ou directement rattaché à l'une
// d'elles (cas d'un compte RH Filiale sans dossier employé).
export async function listerUtilisateurs(filialesAutorisees: string[] | null): Promise<Utilisateur[]> {
  const clauseFiliale =
    filialesAutorisees !== null
      ? `AND (e.filiale_id = ANY($1) OR EXISTS (
           SELECT 1 FROM utilisateurs_filiales uf WHERE uf.utilisateur_id = u.id AND uf.filiale_id = ANY($1)
         ))`
      : '';

  const { rows } = await pool.query(
    `${REQUETE_BASE} WHERE u.statut != 'supprime' ${clauseFiliale} ORDER BY u.email`,
    filialesAutorisees !== null ? [filialesAutorisees] : []
  );

  return rows.map(mapLigne);
}

export async function obtenirUtilisateur(id: string): Promise<Utilisateur | null> {
  const { rows } = await pool.query(`${REQUETE_BASE} WHERE u.id = $1`, [id]);
  return rows[0] ? mapLigne(rows[0]) : null;
}

function genererMotDePasse(): string {
  return randomBytes(9).toString('base64url'); // 12 caractères lisibles, url-safe
}

export async function creerUtilisateur(
  donnees: CreationUtilisateur
): Promise<{ utilisateur: Utilisateur; motDePasseTemporaire: string }> {
  const { rows: roleRows } = await pool.query('SELECT id FROM roles WHERE code = $1', [donnees.role]);
  if (!roleRows[0]) {
    throw new ErreurApplicative(400, 'Rôle inconnu');
  }

  const motDePasseTemporaire = genererMotDePasse();
  const hash = await bcrypt.hash(motDePasseTemporaire, 10);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO utilisateurs (email, mot_de_passe_hash, role_id, employe_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      [donnees.email, hash, roleRows[0].id, donnees.employeId ?? null]
    );
    const utilisateurId = rows[0].id as string;

    for (const filialeId of donnees.filialeIds ?? []) {
      await client.query('INSERT INTO utilisateurs_filiales (utilisateur_id, filiale_id) VALUES ($1, $2)', [
        utilisateurId,
        filialeId,
      ]);
    }

    for (const chantierId of donnees.chantierIds ?? []) {
      await client.query('INSERT INTO utilisateurs_chantiers (utilisateur_id, chantier_id) VALUES ($1, $2)', [
        utilisateurId,
        chantierId,
      ]);
    }

    await client.query('COMMIT');

    const utilisateur = await obtenirUtilisateur(utilisateurId);
    return { utilisateur: utilisateur!, motDePasseTemporaire };
  } catch (erreur) {
    await client.query('ROLLBACK');
    if (erreur && typeof erreur === 'object' && 'code' in erreur && erreur.code === '23505') {
      throw new ErreurApplicative(409, 'Cet email est déjà utilisé par un autre compte');
    }
    throw erreur;
  } finally {
    client.release();
  }
}

export async function changerRoleUtilisateur(id: string, role: string): Promise<Utilisateur> {
  const { rows: roleRows } = await pool.query('SELECT id FROM roles WHERE code = $1', [role]);
  if (!roleRows[0]) {
    throw new ErreurApplicative(400, 'Rôle inconnu');
  }

  const { rowCount } = await pool.query('UPDATE utilisateurs SET role_id = $2, updated_at = now() WHERE id = $1', [
    id,
    roleRows[0].id,
  ]);

  if (!rowCount) {
    throw new ErreurApplicative(404, 'Compte introuvable');
  }

  return (await obtenirUtilisateur(id))!;
}

export async function changerStatutUtilisateur(id: string, statut: StatutUtilisateur): Promise<Utilisateur> {
  const { rowCount } = await pool.query('UPDATE utilisateurs SET statut = $2, updated_at = now() WHERE id = $1', [
    id,
    statut,
  ]);

  if (!rowCount) {
    throw new ErreurApplicative(404, 'Compte introuvable');
  }

  return (await obtenirUtilisateur(id))!;
}

export async function reinitialiserMotDePasse(id: string): Promise<string> {
  const motDePasseTemporaire = genererMotDePasse();
  const hash = await bcrypt.hash(motDePasseTemporaire, 10);

  const { rowCount } = await pool.query(
    'UPDATE utilisateurs SET mot_de_passe_hash = $2, updated_at = now() WHERE id = $1',
    [id, hash]
  );

  if (!rowCount) {
    throw new ErreurApplicative(404, 'Compte introuvable');
  }

  return motDePasseTemporaire;
}

export async function mettreAJourPerimetre(
  id: string,
  filialeIds: string[] | undefined,
  chantierIds: string[] | undefined
): Promise<Utilisateur> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (filialeIds) {
      await client.query('DELETE FROM utilisateurs_filiales WHERE utilisateur_id = $1', [id]);
      for (const filialeId of filialeIds) {
        await client.query('INSERT INTO utilisateurs_filiales (utilisateur_id, filiale_id) VALUES ($1, $2)', [
          id,
          filialeId,
        ]);
      }
    }

    if (chantierIds) {
      await client.query('DELETE FROM utilisateurs_chantiers WHERE utilisateur_id = $1', [id]);
      for (const chantierId of chantierIds) {
        await client.query('INSERT INTO utilisateurs_chantiers (utilisateur_id, chantier_id) VALUES ($1, $2)', [
          id,
          chantierId,
        ]);
      }
    }

    await client.query('COMMIT');
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }

  const utilisateur = await obtenirUtilisateur(id);
  if (!utilisateur) {
    throw new ErreurApplicative(404, 'Compte introuvable');
  }
  return utilisateur;
}
