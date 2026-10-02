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

// Partagée entre la liste paginée (écran Audit) et l'export Excel (toutes les lignes, sans
// pagination) — pour ne jamais faire diverger les deux sur ce qu'un même jeu de filtres désigne.
function construireConditions(filtres: Pick<FiltresAudit, 'utilisateurId' | 'module' | 'action' | 'recherche' | 'dateDebut' | 'dateFin'>) {
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

  if (filtres.recherche) {
    valeurs.push(`%${filtres.recherche}%`);
    conditions.push(`(u.email ILIKE $${valeurs.length} OR j.entite_id::text ILIKE $${valeurs.length})`);
  }

  if (filtres.dateDebut) {
    valeurs.push(filtres.dateDebut);
    conditions.push(`j.created_at >= $${valeurs.length}::date`);
  }

  if (filtres.dateFin) {
    valeurs.push(filtres.dateFin);
    conditions.push(`j.created_at < $${valeurs.length}::date + interval '1 day'`);
  }

  return { conditions, valeurs };
}

export async function listerJournal(filtres: FiltresAudit): Promise<ResultatAudit> {
  const { conditions, valeurs } = construireConditions(filtres);
  const clauseWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: lignesTotal } = await pool.query(
    `SELECT count(*)::int AS total
     FROM journal_audit j
     LEFT JOIN utilisateurs u ON u.id = j.utilisateur_id
     ${clauseWhere}`,
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

// Export Excel : toutes les lignes correspondant aux filtres, sans pagination — plafonné pour
// éviter un export incontrôlé si le journal grossit beaucoup (au-delà, affiner les filtres).
const PLAFOND_EXPORT = 10_000;

export async function listerJournalComplet(
  filtres: Pick<FiltresAudit, 'utilisateurId' | 'module' | 'action' | 'recherche' | 'dateDebut' | 'dateFin'>
): Promise<EntreeAudit[]> {
  const { conditions, valeurs } = construireConditions(filtres);
  const clauseWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  valeurs.push(PLAFOND_EXPORT);
  const { rows } = await pool.query(
    `SELECT j.*, u.email AS utilisateur_email
     FROM journal_audit j
     LEFT JOIN utilisateurs u ON u.id = j.utilisateur_id
     ${clauseWhere}
     ORDER BY j.created_at DESC
     LIMIT $${valeurs.length}`,
    valeurs
  );

  return rows.map(mapEntree);
}
