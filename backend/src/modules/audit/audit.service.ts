import { pool } from '../../config/db';
import { EntreeAudit, FiltresAudit, ResultatAudit } from './audit.types';

function mapEntree(l: Record<string, unknown>): EntreeAudit {
  return {
    id: l.id as string,
    utilisateurId: l.utilisateur_id as string | null,
    utilisateurEmail: l.utilisateur_email as string | null,
    action: l.action as string,
    module: l.module as string,
    entiteId: l.entite_id as string | null,
    valeurAvant: l.valeur_avant,
    valeurApres: l.valeur_apres,
    adresseIp: l.adresse_ip as string | null,
    createdAt: (l.created_at as Date).toISOString(),
  };
}

export async function listerJournal(filtres: FiltresAudit): Promise<ResultatAudit> {
  const conditions: string[] = [];
  const valeurs: unknown[] = [];

  if (filtres.utilisateurId) {
    valeurs.push(filtres.utilisateurId);
    conditions.push(`j.utilisateur_id = $${valeurs.length}`);
  }

  if (filtres.module) {
    valeurs.push(filtres.module);
    conditions.push(`j.module = $${valeurs.length}`);
  }

  if (filtres.action) {
    valeurs.push(filtres.action);
    conditions.push(`j.action = $${valeurs.length}`);
  }

  const clauseWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: lignesTotal } = await pool.query(
    `SELECT count(*)::int AS total FROM journal_audit j ${clauseWhere}`,
    valeurs
  );

  valeurs.push(filtres.parPage);
  const indexLimit = valeurs.length;
  valeurs.push((filtres.page - 1) * filtres.parPage);
  const indexOffset = valeurs.length;

  const { rows } = await pool.query(
    `SELECT j.*, u.email AS utilisateur_email
     FROM journal_audit j
     LEFT JOIN utilisateurs u ON u.id = j.utilisateur_id
     ${clauseWhere}
     ORDER BY j.created_at DESC
     LIMIT $${indexLimit} OFFSET $${indexOffset}`,
    valeurs
  );

  return { entrees: rows.map(mapEntree), total: lignesTotal[0].total };
}
