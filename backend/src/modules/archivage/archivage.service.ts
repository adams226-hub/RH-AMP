import { randomUUID } from 'node:crypto';
import { pool } from '../../config/db';
import { BUCKET_DOCUMENTS, obtenirClientStorage } from '../../config/supabaseStorage';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { DepotDocument, DocumentArchive } from './archivage.types';

function mapDocument(l: Record<string, unknown>): DocumentArchive {
  return {
    id: l.id as string,
    categorie: l.categorie as DocumentArchive['categorie'],
    employeId: l.employe_id as string | null,
    employeNom: (l.employe_nom as string | null) ?? null,
    employePrenoms: (l.employe_prenoms as string | null) ?? null,
    employeMatricule: (l.employe_matricule as string | null) ?? null,
    filialeId: l.filiale_id as string | null,
    nomOriginal: l.nom_original as string,
    typeMime: l.type_mime as string,
    tailleOctets: Number(l.taille_octets),
    dateExpiration: l.date_expiration as string | null,
    statut: l.statut as DocumentArchive['statut'],
    confidentialite: l.confidentialite as DocumentArchive['confidentialite'],
    version: l.version as number,
    createdAt: (l.created_at as Date).toISOString(),
  };
}

export async function deposerDocument(
  fichier: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  meta: DepotDocument,
  uploadedBy: string
): Promise<DocumentArchive> {
  const client = obtenirClientStorage();
  const cheminStockage = `${meta.employeId ?? 'societe'}/${randomUUID()}-${fichier.originalname}`;

  const { error: erreurUpload } = await client.storage
    .from(BUCKET_DOCUMENTS)
    .upload(cheminStockage, fichier.buffer, { contentType: fichier.mimetype });

  if (erreurUpload) {
    throw new ErreurApplicative(500, `Échec de l'upload : ${erreurUpload.message}`);
  }

  const { rows } = await pool.query(
    `INSERT INTO documents (categorie, employe_id, filiale_id, fichier_url, nom_original, type_mime, taille_octets, uploaded_by, date_expiration, confidentialite)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      meta.categorie,
      meta.employeId ?? null,
      meta.filialeId ?? null,
      cheminStockage,
      fichier.originalname,
      fichier.mimetype,
      fichier.size,
      uploadedBy,
      meta.dateExpiration ?? null,
      meta.confidentialite ?? 'standard',
    ]
  );

  return mapDocument(rows[0]);
}

// filialesAutorisees = null signifie aucune restriction (super_admin, drh_holding, ou accès
// déjà réduit à un seul employeId côté appelant). Sinon, ne remonte que les documents société
// rattachés à ces filiales ou les documents d'employés de ces filiales (jointure employes).
// recherche : filtre serveur (nom de fichier, matricule, nom/prénoms de l'employé) — évite de
// charger tous les documents dans le navigateur pour filtrer côté client, même raisonnement que
// pour le sélecteur d'employé (cf. échelle "des milliers d'employés").
export async function listerDocuments(
  filialesAutorisees: string[] | null,
  employeId?: string,
  categorie?: string,
  recherche?: string
): Promise<DocumentArchive[]> {
  const conditions: string[] = ['NOT d.corbeille'];
  const valeurs: unknown[] = [];

  if (filialesAutorisees !== null) {
    valeurs.push(filialesAutorisees);
    conditions.push(`(d.filiale_id = ANY($${valeurs.length}) OR e.filiale_id = ANY($${valeurs.length}))`);
  }

  if (employeId) {
    valeurs.push(employeId);
    conditions.push(`d.employe_id = $${valeurs.length}`);
  }

  if (categorie) {
    valeurs.push(categorie);
    conditions.push(`d.categorie = $${valeurs.length}`);
  }

  if (recherche) {
    valeurs.push(`%${recherche}%`);
    const p = `$${valeurs.length}`;
    conditions.push(`(d.nom_original ILIKE ${p} OR e.matricule ILIKE ${p} OR e.nom ILIKE ${p} OR e.prenoms ILIKE ${p})`);
  }

  const { rows } = await pool.query(
    `SELECT d.*, e.nom AS employe_nom, e.prenoms AS employe_prenoms, e.matricule AS employe_matricule
     FROM documents d
     LEFT JOIN employes e ON e.id = d.employe_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY d.created_at DESC`,
    valeurs
  );

  return rows.map(mapDocument);
}

export async function obtenirUrlTelechargement(id: string): Promise<string> {
  const { rows } = await pool.query('SELECT fichier_url FROM documents WHERE id = $1 AND NOT corbeille', [id]);

  if (!rows[0]) {
    throw new ErreurApplicative(404, 'Document introuvable');
  }

  const client = obtenirClientStorage();
  const { data, error } = await client.storage
    .from(BUCKET_DOCUMENTS)
    .createSignedUrl(rows[0].fichier_url as string, 60 * 5);

  if (error || !data) {
    throw new ErreurApplicative(500, `Échec de la génération du lien : ${error?.message}`);
  }

  return data.signedUrl;
}

export async function mettreEnCorbeille(id: string): Promise<void> {
  const { rowCount } = await pool.query('UPDATE documents SET corbeille = true WHERE id = $1', [id]);

  if (!rowCount) {
    throw new ErreurApplicative(404, 'Document introuvable');
  }
}
