import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import {
  CreationDepartement,
  CreationFiliale,
  CreationFonction,
  CreationServiceOrg,
  Departement,
  Filiale,
  Fonction,
  ServiceOrg,
} from './postes.types';

function mapFiliale(l: Record<string, unknown>): Filiale {
  return {
    id: l.id as string,
    nom: l.nom as string,
    ville: l.ville as string | null,
    pays: l.pays as string,
    actif: l.actif as boolean,
  };
}

function mapDepartement(l: Record<string, unknown>): Departement {
  return {
    id: l.id as string,
    filialeId: l.filiale_id as string,
    nom: l.nom as string,
    actif: l.actif as boolean,
    responsableId: l.responsable_id as string | null,
  };
}

function mapService(l: Record<string, unknown>): ServiceOrg {
  return {
    id: l.id as string,
    departementId: l.departement_id as string,
    nom: l.nom as string,
    actif: l.actif as boolean,
    responsableId: l.responsable_id as string | null,
  };
}

function mapFonction(l: Record<string, unknown>): Fonction {
  return {
    id: l.id as string,
    intitule: l.intitule as string,
    actif: l.actif as boolean,
    description: l.description as string | null,
  };
}

export async function listerFiliales(visiblesUniquement?: boolean): Promise<Filiale[]> {
  const clauseWhere = visiblesUniquement ? 'WHERE actif' : '';
  const { rows } = await pool.query(`SELECT * FROM filiales ${clauseWhere} ORDER BY nom`);
  return rows.map(mapFiliale);
}

export async function renommerFiliale(id: string, nom: string): Promise<Filiale> {
  const { rows } = await pool.query('UPDATE filiales SET nom = $2 WHERE id = $1 RETURNING *', [id, nom]);
  if (!rows[0]) throw new ErreurApplicative(404, 'Filiale introuvable');
  return mapFiliale(rows[0]);
}

export async function archiverFiliale(id: string, actif: boolean): Promise<Filiale> {
  const { rows } = await pool.query('UPDATE filiales SET actif = $2 WHERE id = $1 RETURNING *', [id, actif]);
  if (!rows[0]) throw new ErreurApplicative(404, 'Filiale introuvable');
  return mapFiliale(rows[0]);
}

export async function creerFiliale(donnees: CreationFiliale): Promise<Filiale> {
  const { rows: existantes } = await pool.query('SELECT id FROM filiales WHERE lower(nom) = lower($1)', [
    donnees.nom,
  ]);
  if (existantes[0]) {
    throw new ErreurApplicative(409, 'Une filiale porte déjà ce nom');
  }

  const { rows } = await pool.query('INSERT INTO filiales (nom, ville, pays) VALUES ($1, $2, $3) RETURNING *', [
    donnees.nom,
    donnees.ville ?? null,
    donnees.pays ?? 'Burkina Faso',
  ]);
  return mapFiliale(rows[0]);
}

// visiblesUniquement=true : réservé aux listes de sélection pour une NOUVELLE fiche (ex. créer un
// service dans ce département) — un département archivé y disparaît. L'écran d'administration
// Postes, lui, doit continuer à tout afficher (y compris archivé, pour pouvoir réactiver).
export async function listerDepartements(filialeId?: string, visiblesUniquement?: boolean): Promise<Departement[]> {
  const conditions: string[] = [];
  const valeurs: unknown[] = [];
  if (filialeId) {
    valeurs.push(filialeId);
    conditions.push(`filiale_id = $${valeurs.length}`);
  }
  if (visiblesUniquement) conditions.push('actif');
  const clauseWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(`SELECT * FROM departements ${clauseWhere} ORDER BY nom`, valeurs);
  return rows.map(mapDepartement);
}

export async function creerDepartement(donnees: CreationDepartement): Promise<Departement> {
  const { rows } = await pool.query(
    'INSERT INTO departements (filiale_id, nom, responsable_id) VALUES ($1, $2, $3) RETURNING *',
    [donnees.filialeId, donnees.nom, donnees.responsableId ?? null]
  );
  return mapDepartement(rows[0]);
}

export async function renommerDepartement(id: string, nom: string): Promise<Departement> {
  const { rows } = await pool.query('UPDATE departements SET nom = $2 WHERE id = $1 RETURNING *', [id, nom]);
  if (!rows[0]) throw new ErreurApplicative(404, 'Département introuvable');
  return mapDepartement(rows[0]);
}

export async function archiverDepartement(id: string, actif: boolean): Promise<Departement> {
  const { rows } = await pool.query('UPDATE departements SET actif = $2 WHERE id = $1 RETURNING *', [id, actif]);
  if (!rows[0]) throw new ErreurApplicative(404, 'Département introuvable');
  return mapDepartement(rows[0]);
}

// Cascade de visibilité PUREMENT à la lecture (jointure sur le département parent) — archiver un
// département n'écrit jamais sur ses services enfants, cf. décision produit.
export async function listerServices(departementId?: string, visiblesUniquement?: boolean): Promise<ServiceOrg[]> {
  const conditions: string[] = [];
  const valeurs: unknown[] = [];
  if (departementId) {
    valeurs.push(departementId);
    conditions.push(`s.departement_id = $${valeurs.length}`);
  }
  if (visiblesUniquement) conditions.push('s.actif AND d.actif');
  const clauseWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT s.* FROM services s JOIN departements d ON d.id = s.departement_id ${clauseWhere} ORDER BY s.nom`,
    valeurs
  );
  return rows.map(mapService);
}

export async function creerService(donnees: CreationServiceOrg): Promise<ServiceOrg> {
  const { rows } = await pool.query(
    'INSERT INTO services (departement_id, nom, responsable_id) VALUES ($1, $2, $3) RETURNING *',
    [donnees.departementId, donnees.nom, donnees.responsableId ?? null]
  );
  return mapService(rows[0]);
}

export async function renommerService(id: string, nom: string): Promise<ServiceOrg> {
  const { rows } = await pool.query('UPDATE services SET nom = $2 WHERE id = $1 RETURNING *', [id, nom]);
  if (!rows[0]) throw new ErreurApplicative(404, 'Service introuvable');
  return mapService(rows[0]);
}

export async function archiverService(id: string, actif: boolean): Promise<ServiceOrg> {
  const { rows } = await pool.query('UPDATE services SET actif = $2 WHERE id = $1 RETURNING *', [id, actif]);
  if (!rows[0]) throw new ErreurApplicative(404, 'Service introuvable');
  return mapService(rows[0]);
}

// Référentiel plat group-wide (cf. décision produit) : pas de parent, donc pas de cascade de
// visibilité au-dessus de ce niveau — visiblesUniquement ne dépend que de son propre actif.
export async function listerFonctions(visiblesUniquement?: boolean): Promise<Fonction[]> {
  const clauseWhere = visiblesUniquement ? 'WHERE actif' : '';
  const { rows } = await pool.query(`SELECT * FROM fonctions ${clauseWhere} ORDER BY intitule`);
  return rows.map(mapFonction);
}

async function verifierIntituleFonctionLibre(intitule: string, idAExclure?: string): Promise<void> {
  const { rows } = await pool.query(
    idAExclure
      ? 'SELECT id FROM fonctions WHERE lower(intitule) = lower($1) AND id != $2'
      : 'SELECT id FROM fonctions WHERE lower(intitule) = lower($1)',
    idAExclure ? [intitule, idAExclure] : [intitule]
  );
  if (rows[0]) {
    throw new ErreurApplicative(409, 'Une fonction porte déjà cet intitulé (référentiel unique pour tout le groupe)');
  }
}

export async function creerFonction(donnees: CreationFonction): Promise<Fonction> {
  await verifierIntituleFonctionLibre(donnees.intitule);
  const { rows } = await pool.query('INSERT INTO fonctions (intitule, description) VALUES ($1, $2) RETURNING *', [
    donnees.intitule,
    donnees.description ?? null,
  ]);
  return mapFonction(rows[0]);
}

export async function renommerFonction(id: string, intitule: string): Promise<Fonction> {
  await verifierIntituleFonctionLibre(intitule, id);
  const { rows } = await pool.query('UPDATE fonctions SET intitule = $2 WHERE id = $1 RETURNING *', [id, intitule]);
  if (!rows[0]) throw new ErreurApplicative(404, 'Fonction introuvable');
  return mapFonction(rows[0]);
}

export async function archiverFonction(id: string, actif: boolean): Promise<Fonction> {
  const { rows } = await pool.query('UPDATE fonctions SET actif = $2 WHERE id = $1 RETURNING *', [id, actif]);
  if (!rows[0]) throw new ErreurApplicative(404, 'Fonction introuvable');
  return mapFonction(rows[0]);
}
