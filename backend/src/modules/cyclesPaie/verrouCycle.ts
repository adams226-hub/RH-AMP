import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';

// Verrou de clôture mensuelle (ADDENDUM_JOURNAL_PAIE_AMP.md §2) : une fois le cycle
// (mois, filiale) au statut 'cloture', plus aucune écriture de paie n'est possible pour ce
// périmètre — Éléments du mois, calcul individuel/masse, validation Pointage — sans réouverture
// explicite (super_admin/drh_holding). Un cycle absent équivaut à 'ouvert' (pas encore créé par
// le RH siège), donc ne bloque rien.
//
// Fichier séparé du module cyclesPaie (types/service/controller/routes) pour éviter un import
// circulaire : paie.service, elementsVariables.service et pointage.service appellent ce verrou,
// et cyclesPaie.service appelle lui-même calculerMasseSalariale() de paie.service.
export async function verifierCycleOuvertPourFiliale(filialeId: string, periode: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT statut FROM cycles_paie WHERE filiale_id = $1 AND mois_paie = date_trunc('month', $2::date)`,
    [filialeId, periode]
  );
  if (rows[0]?.statut === 'cloture') {
    throw new ErreurApplicative(
      409,
      'Ce mois est clôturé pour cette filiale — réouverture requise (super_admin/drh_holding) avant toute modification de paie'
    );
  }
}

export async function verifierCycleOuvertPourEmploye(employeId: string, periode: string): Promise<void> {
  const { rows } = await pool.query('SELECT filiale_id FROM employes WHERE id = $1', [employeId]);
  if (!rows[0]) return; // employé introuvable : laissé à l'appelant (message d'erreur plus parlant)
  await verifierCycleOuvertPourFiliale(rows[0].filiale_id as string, periode);
}
