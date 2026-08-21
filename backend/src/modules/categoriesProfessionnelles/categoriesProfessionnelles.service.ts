import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { CategorieProfessionnelle, ModificationCategorieProfessionnelle } from './categoriesProfessionnelles.types';

function mapCategorie(l: Record<string, unknown>): CategorieProfessionnelle {
  return {
    id: l.id as string,
    code: l.code as string,
    libelle: l.libelle as string,
    estCadre: l.est_cadre as boolean,
    actif: l.actif as boolean,
  };
}

// Plage Unicode des diacritiques combinants (U+0300-U+036F), construite à partir des points de
// code (String.fromCharCode) plutôt qu'écrite en dur dans la source : un caractère combinant
// littéral dans une classe de regex fusionne visuellement avec le caractère précédent et devient
// invisible/ambigu dans un éditeur de texte — ça a produit un bug silencieux ici (slug tronqué
// sur les libellés accentués, ex. "Supérieur" -> "sup_rieur" au lieu de "superieur").
const REGEX_DIACRITIQUES = new RegExp(
  String.fromCharCode(0x5b, 0x5c, 0x75, 0x30, 0x33, 0x30, 0x30, 0x2d, 0x5c, 0x75, 0x30, 0x33, 0x36, 0x66, 0x5d)
);

// code = identifiant stable stocké tel quel dans employes.categorie_professionnelle (pas de FK
// sur id) — dérivé du libellé plutôt que saisi à la main, pour garder le formulaire de création
// aussi simple que celui d'une Fonction (un seul champ texte + la case Cadre).
function genererCode(libelle: string): string {
  return libelle
    .normalize('NFD')
    .replace(REGEX_DIACRITIQUES, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function codeDisponible(code: string): Promise<boolean> {
  const { rows } = await pool.query('SELECT 1 FROM categories_professionnelles WHERE code = $1', [code]);
  return !rows[0];
}

async function genererCodeUnique(libelle: string): Promise<string> {
  const base = genererCode(libelle) || 'categorie';
  let code = base;
  let compteur = 2;
  while (!(await codeDisponible(code))) {
    code = `${base}_${compteur}`;
    compteur += 1;
  }
  return code;
}

export async function listerCategories(visiblesUniquement?: boolean): Promise<CategorieProfessionnelle[]> {
  const clauseWhere = visiblesUniquement ? 'WHERE actif' : '';
  const { rows } = await pool.query(`SELECT * FROM categories_professionnelles ${clauseWhere} ORDER BY libelle`);
  return rows.map(mapCategorie);
}

export async function creerCategorie(libelle: string, estCadre: boolean): Promise<CategorieProfessionnelle> {
  const code = await genererCodeUnique(libelle);
  const { rows } = await pool.query(
    'INSERT INTO categories_professionnelles (code, libelle, est_cadre) VALUES ($1, $2, $3) RETURNING *',
    [code, libelle, estCadre]
  );
  return mapCategorie(rows[0]);
}

// Modifie libellé + est_cadre (le code, identifiant stable, ne change jamais après création).
// est_cadre est éditable : ça n'affecte que les calculs futurs — les bulletins déjà générés
// stockent déjà leur abattement_forfaitaire comme un montant figé, jamais recalculé après coup.
export async function modifierCategorie(
  id: string,
  donnees: ModificationCategorieProfessionnelle
): Promise<CategorieProfessionnelle> {
  const { rows } = await pool.query(
    'UPDATE categories_professionnelles SET libelle = $2, est_cadre = $3 WHERE id = $1 RETURNING *',
    [id, donnees.libelle, donnees.estCadre]
  );
  if (!rows[0]) throw new ErreurApplicative(404, 'Catégorie professionnelle introuvable');
  return mapCategorie(rows[0]);
}

export async function archiverCategorie(id: string, actif: boolean): Promise<CategorieProfessionnelle> {
  const { rows } = await pool.query('UPDATE categories_professionnelles SET actif = $2 WHERE id = $1 RETURNING *', [
    id,
    actif,
  ]);
  if (!rows[0]) throw new ErreurApplicative(404, 'Catégorie professionnelle introuvable');
  return mapCategorie(rows[0]);
}
