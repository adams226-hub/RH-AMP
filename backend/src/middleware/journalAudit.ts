import { NextFunction, Request, Response } from 'express';
import { pool } from '../config/db';

const LIBELLES_ACTION: Record<string, string> = {
  POST: 'creation',
  PUT: 'modification',
  PATCH: 'modification',
  DELETE: 'suppression',
};

const METHODES_SUIVIES = new Set(Object.keys(LIBELLES_ACTION));

// Journalise automatiquement toute requête qui modifie l'état (POST/PUT/PATCH/DELETE) et qui a
// réussi (2xx) — module Utilisateurs §4.4 / architecture "traçabilité complète des actions".
// Best-effort : ne capture que `valeur_apres` (corps de la réponse) — capturer `valeur_avant`
// nécessiterait une lecture préalable dans chaque service, non fait ici pour rester générique.
// La route /api/auth/connexion journalise séparément (non authentifiée à ce stade de la requête).
export function journalAudit(req: Request, res: Response, next: NextFunction) {
  if (!METHODES_SUIVIES.has(req.method)) {
    next();
    return;
  }

  const jsonOriginal = res.json.bind(res);
  let corpsReponse: unknown;

  res.json = ((body: unknown) => {
    corpsReponse = body;
    return jsonOriginal(body);
  }) as typeof res.json;

  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300 || !req.utilisateur) return;

    const module = req.originalUrl.split('?')[0].split('/')[2] ?? 'inconnu';
    const entiteId = (corpsReponse as { id?: string } | undefined)?.id ?? req.params.id ?? null;

    pool
      .query(
        `INSERT INTO journal_audit (utilisateur_id, action, module, entite_id, valeur_apres, adresse_ip)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.utilisateur.sub,
          LIBELLES_ACTION[req.method],
          module,
          entiteId,
          corpsReponse ? JSON.stringify(corpsReponse) : null,
          req.ip ?? null,
        ]
      )
      .catch((erreur) => console.error("Échec de l'écriture du journal d'audit", erreur));
  });

  next();
}
