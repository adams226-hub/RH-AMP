import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { verifierCycleOuvertPourEmploye } from '../cyclesPaie/verrouCycle';
import { ElementVariable, ElementVariableAvecEmploye, SaisieElementVariable } from './elementsVariables.types';

function mapLigne(l: Record<string, unknown>): ElementVariable {
  return {
    id: l.id as string,
    employeId: l.employe_id as string,
    periode: l.periode as string,
    type: l.type as ElementVariable['type'],
    montant: l.montant !== null ? Number(l.montant) : null,
    jours: l.jours !== null ? Number(l.jours) : null,
  };
}

// Vue globale du périmètre pour une période — alimente l'écran "Éléments du mois" avant de
// lancer le calcul (individuel ou en masse), qui les reprendra automatiquement.
export async function listerElementsMois(
  filialesAutorisees: string[] | null,
  periode: string
): Promise<ElementVariableAvecEmploye[]> {
  // heure_sup_15/35/60 sont alimentées automatiquement par la validation d'une fiche Pointage,
  // pas saisissables ici (cf. module Pointage) — seuls heure_sup_50/120 restent manuels.
  const conditions = [
    `v.periode = date_trunc('month', $1::date)`,
    `v.type NOT IN ('heure_sup', 'heure_sup_15', 'heure_sup_35', 'heure_sup_60')`,
  ];
  const valeurs: unknown[] = [periode];

  if (filialesAutorisees !== null) {
    valeurs.push(filialesAutorisees);
    conditions.push(`e.filiale_id = ANY($${valeurs.length})`);
  }

  const { rows } = await pool.query(
    `SELECT v.*, e.nom AS employe_nom, e.prenoms AS employe_prenoms, e.matricule AS employe_matricule, e.filiale_id
     FROM elements_variables_paie v
     JOIN employes e ON e.id = v.employe_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY e.nom, e.prenoms, v.type`,
    valeurs
  );

  return rows.map((l) => ({
    ...mapLigne(l),
    employeNom: l.employe_nom as string,
    employePrenoms: l.employe_prenoms as string,
    employeMatricule: l.employe_matricule as string,
    filialeId: l.filiale_id as string,
  }));
}

export async function listerElementsEmploye(employeId: string, periode: string): Promise<ElementVariable[]> {
  const { rows } = await pool.query(
    `SELECT * FROM elements_variables_paie
     WHERE employe_id = $1 AND periode = date_trunc('month', $2::date)
       AND type NOT IN ('heure_sup', 'heure_sup_15', 'heure_sup_35', 'heure_sup_60')
     ORDER BY type`,
    [employeId, periode]
  );
  return rows.map(mapLigne);
}

export async function enregistrerElementMois(donnees: SaisieElementVariable): Promise<ElementVariable> {
  if (donnees.type === 'absence_injustifiee' && donnees.jours === undefined) {
    throw new ErreurApplicative(400, 'jours est requis pour une absence injustifiée');
  }
  if (donnees.type !== 'absence_injustifiee' && donnees.montant === undefined) {
    throw new ErreurApplicative(400, 'montant est requis pour ce type');
  }

  await verifierCycleOuvertPourEmploye(donnees.employeId, donnees.periode);

  const { rows } = await pool.query(
    `INSERT INTO elements_variables_paie (employe_id, periode, type, montant, jours)
     VALUES ($1, date_trunc('month', $2::date), $3, $4, $5)
     ON CONFLICT (employe_id, periode, type) DO UPDATE SET
       montant = EXCLUDED.montant, jours = EXCLUDED.jours, updated_at = now()
     RETURNING *`,
    [
      donnees.employeId,
      donnees.periode,
      donnees.type,
      donnees.type === 'absence_injustifiee' ? null : donnees.montant,
      donnees.type === 'absence_injustifiee' ? donnees.jours : null,
    ]
  );

  return mapLigne(rows[0]);
}

export async function supprimerElementMois(id: string): Promise<void> {
  const { rowCount } = await pool.query(
    "DELETE FROM elements_variables_paie WHERE id = $1 AND type NOT IN ('heure_sup', 'heure_sup_15', 'heure_sup_35', 'heure_sup_60')",
    [id]
  );
  if (!rowCount) {
    throw new ErreurApplicative(404, 'Élément introuvable');
  }
}
