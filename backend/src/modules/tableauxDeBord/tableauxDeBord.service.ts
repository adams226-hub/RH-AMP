import { pool } from '../../config/db';
import {
  MasseSalarialeReponse,
  PyramideAgesReponse,
  SortiesReponse,
  TrancheAge,
  TurnoverReponse,
} from './tableauxDeBord.types';

// filialesAutorisees = null signifie aucune restriction (super_admin, drh_holding).
// NB Chef de service : la donnée RBAC actuelle (utilisateurs_filiales) ne modélise que le
// périmètre d'un RH Filiale, pas l'équipe d'un Chef de service (aucune table ne relie un
// compte chef_service à un service/une liste de subordonnés) — ce rôle voit donc pour l'instant
// la même vue que DRH Holding sur ces tableaux de bord. Signalé comme limite connue, pas corrigé
// ici : nécessite une décision produit sur comment déterminer l'équipe d'un chef de service.

export async function obtenirEffectif(filialesAutorisees: string[] | null) {
  const clauseFiliale = filialesAutorisees !== null ? 'WHERE filiale_id = ANY($1)' : '';
  const valeurs = filialesAutorisees !== null ? [filialesAutorisees] : [];

  const { rows: parStatut } = await pool.query(
    `SELECT statut, count(*)::int AS total FROM employes ${clauseFiliale} GROUP BY statut`,
    valeurs
  );

  const { rows: parFiliale } = await pool.query(
    `SELECT f.nom AS filiale, count(e.*)::int AS total
     FROM filiales f LEFT JOIN employes e ON e.filiale_id = f.id AND e.statut = 'actif'
     ${filialesAutorisees !== null ? 'WHERE f.id = ANY($1)' : ''}
     GROUP BY f.nom ORDER BY f.nom`,
    valeurs
  );

  return { parStatut, parFiliale };
}

export async function obtenirRepartitionContrats(filialesAutorisees: string[] | null) {
  const clauseFiliale = filialesAutorisees !== null ? 'AND e.filiale_id = ANY($1)' : '';
  const valeurs = filialesAutorisees !== null ? [filialesAutorisees] : [];

  const { rows: parType } = await pool.query(
    `SELECT c.type, count(*)::int AS total
     FROM contrats c JOIN employes e ON e.id = c.employe_id
     WHERE c.statut = 'actif' ${clauseFiliale}
     GROUP BY c.type`,
    valeurs
  );

  const { rows: expirationProche } = await pool.query(
    `SELECT count(*)::int AS total
     FROM contrats c JOIN employes e ON e.id = c.employe_id
     WHERE c.statut = 'actif' AND c.date_fin IS NOT NULL
       AND c.date_fin BETWEEN CURRENT_DATE AND CURRENT_DATE + 90 ${clauseFiliale}`,
    valeurs
  );

  return { parType, expirantSous90Jours: expirationProche[0].total };
}

export async function obtenirSyntheseConges(filialesAutorisees: string[] | null) {
  const clauseFilialeDemandes = filialesAutorisees !== null ? 'AND e.filiale_id = ANY($1)' : '';
  const clauseFilialeSoldes = filialesAutorisees !== null ? 'AND e.filiale_id = ANY($1)' : '';
  const valeurs = filialesAutorisees !== null ? [filialesAutorisees] : [];

  const { rows: enCours } = await pool.query(
    `SELECT count(*)::int AS total
     FROM demandes_conges d JOIN employes e ON e.id = d.employe_id
     WHERE d.statut = 'validee_rh' AND CURRENT_DATE BETWEEN d.date_debut AND d.date_fin ${clauseFilialeDemandes}`,
    valeurs
  );

  const { rows: soldeMoyen } = await pool.query(
    `SELECT COALESCE(avg(s.solde_disponible), 0)::float AS moyenne
     FROM soldes_conges s JOIN employes e ON e.id = s.employe_id
     WHERE s.annee = EXTRACT(YEAR FROM CURRENT_DATE) ${clauseFilialeSoldes}`,
    valeurs
  );

  return { congesEnCours: enCours[0].total, soldeMoyenDisponible: soldeMoyen[0].moyenne };
}

export async function obtenirMasseSalariale(filialesAutorisees: string[] | null, periode: string) {
  const clauseFiliale = filialesAutorisees !== null ? 'AND e.filiale_id = ANY($2)' : '';
  const valeurs = filialesAutorisees !== null ? [periode, filialesAutorisees] : [periode];

  const { rows } = await pool.query(
    `SELECT COALESCE(sum(b.brut), 0)::float AS total_brut, COALESCE(sum(b.net_a_payer), 0)::float AS total_net,
            COALESCE(sum(b.cout_employeur), 0)::float AS total_cout_employeur, count(*)::int AS nb_bulletins
     FROM bulletins_paie b JOIN employes e ON e.id = b.employe_id
     WHERE b.periode = date_trunc('month', $1::date) ${clauseFiliale}`,
    valeurs
  );

  return rows[0];
}

// Employés sortis sur une période, avec répartition par motif de départ.
// `motif_sortie` est un champ texte libre (pas une liste fermée en base) — la
// répartition groupe donc sur la valeur brute saisie, cf. point signalé en session.
export async function obtenirSorties(
  filialesAutorisees: string[] | null,
  dateDebut: string,
  dateFin: string
): Promise<SortiesReponse> {
  const clauseFiliale = filialesAutorisees !== null ? 'AND e.filiale_id = ANY($3)' : '';
  const valeurs: unknown[] = filialesAutorisees !== null ? [dateDebut, dateFin, filialesAutorisees] : [dateDebut, dateFin];

  const { rows } = await pool.query(
    `SELECT e.id, e.matricule, e.nom, e.prenoms, f.nom AS filiale, e.date_sortie, e.motif_sortie
     FROM employes e JOIN filiales f ON f.id = e.filiale_id
     WHERE e.statut = 'sorti' AND e.date_sortie BETWEEN $1 AND $2 ${clauseFiliale}
     ORDER BY e.date_sortie DESC`,
    valeurs
  );

  const details = rows.map((l) => ({
    id: l.id as string,
    matricule: l.matricule as string,
    nom: l.nom as string,
    prenoms: l.prenoms as string,
    filiale: l.filiale as string,
    dateSortie: l.date_sortie as string,
    motifSortie: l.motif_sortie as string | null,
  }));

  const compteParMotif = new Map<string, number>();
  for (const d of details) {
    const cle = d.motifSortie?.trim() || 'Non renseigné';
    compteParMotif.set(cle, (compteParMotif.get(cle) ?? 0) + 1);
  }

  return {
    total: details.length,
    parMotif: [...compteParMotif.entries()].map(([motif, total]) => ({ motif, total })),
    details,
  };
}

// Pyramide des âges : tranches de 5 ans, borne basse = arrondi à l'inférieur multiple
// de 5. Répartition hommes/femmes ajoutée (une pyramide des âges se lit classiquement
// en miroir par sexe) — extension justifiée, pas demandée mais standard du genre de vue.
export async function obtenirPyramideAges(filialesAutorisees: string[] | null): Promise<PyramideAgesReponse> {
  const clauseFiliale = filialesAutorisees !== null ? 'AND filiale_id = ANY($1)' : '';
  const valeurs = filialesAutorisees !== null ? [filialesAutorisees] : [];

  const { rows } = await pool.query(
    `SELECT sexe, date_naissance FROM employes WHERE statut = 'actif' ${clauseFiliale}`,
    valeurs
  );

  const parTranche = new Map<number, TrancheAge>();
  const maintenant = new Date();

  for (const ligne of rows) {
    const naissance = new Date(ligne.date_naissance as string);
    let age = maintenant.getFullYear() - naissance.getFullYear();
    const anniversairePasse =
      maintenant.getMonth() > naissance.getMonth() ||
      (maintenant.getMonth() === naissance.getMonth() && maintenant.getDate() >= naissance.getDate());
    if (!anniversairePasse) age -= 1;

    const borneBasse = Math.floor(age / 5) * 5;
    const existante = parTranche.get(borneBasse) ?? {
      tranche: `${borneBasse}-${borneBasse + 4}`,
      borneBasse,
      hommes: 0,
      femmes: 0,
      total: 0,
    };

    if (ligne.sexe === 'M') existante.hommes += 1;
    else existante.femmes += 1;
    existante.total += 1;

    parTranche.set(borneBasse, existante);
  }

  return { tranches: [...parTranche.values()].sort((a, b) => a.borneBasse - b.borneBasse) };
}

// Masse salariale mensuelle ventilée par société, sur une période libre (pas des
// colonnes mensuelles figées) — grille dense : chaque filiale du périmètre apparaît
// pour chaque mois de la période, à 0 si aucun bulletin, pour des courbes continues.
export async function obtenirMasseSalarialeParPeriode(
  filialesAutorisees: string[] | null,
  periodeDebut: string,
  periodeFin: string
): Promise<MasseSalarialeReponse> {
  const clauseFilialesListe = filialesAutorisees !== null ? 'WHERE id = ANY($1)' : '';
  const { rows: filiales } = await pool.query(
    `SELECT id, nom FROM filiales ${clauseFilialesListe} ORDER BY nom`,
    filialesAutorisees !== null ? [filialesAutorisees] : []
  );

  const clauseFiliale = filialesAutorisees !== null ? 'AND e.filiale_id = ANY($3)' : '';
  const valeurs = filialesAutorisees !== null
    ? [`${periodeDebut}-01`, `${periodeFin}-01`, filialesAutorisees]
    : [`${periodeDebut}-01`, `${periodeFin}-01`];

  const { rows: agregats } = await pool.query(
    `SELECT to_char(b.periode, 'YYYY-MM') AS periode, f.nom AS filiale,
            COALESCE(sum(b.brut), 0)::float AS total_brut,
            COALESCE(sum(b.net_a_payer), 0)::float AS total_net,
            COALESCE(sum(b.cout_employeur), 0)::float AS total_cout_employeur
     FROM bulletins_paie b
     JOIN employes e ON e.id = b.employe_id
     JOIN filiales f ON f.id = e.filiale_id
     WHERE b.periode BETWEEN date_trunc('month', $1::date) AND date_trunc('month', $2::date) ${clauseFiliale}
     GROUP BY periode, f.nom`,
    valeurs
  );

  const cleAgregat = (periode: string, filiale: string) => `${periode}__${filiale}`;
  const index = new Map(agregats.map((a) => [cleAgregat(a.periode as string, a.filiale as string), a]));

  // Liste des mois entre periodeDebut et periodeFin, inclus.
  const periodes: string[] = [];
  const curseur = new Date(`${periodeDebut}-01T00:00:00Z`);
  const fin = new Date(`${periodeFin}-01T00:00:00Z`);
  while (curseur <= fin) {
    periodes.push(curseur.toISOString().slice(0, 7));
    curseur.setUTCMonth(curseur.getUTCMonth() + 1);
  }

  const mois = periodes.map((periode) => {
    const parSociete = filiales.map((f) => {
      const agregat = index.get(cleAgregat(periode, f.nom as string));
      return {
        filiale: f.nom as string,
        totalBrut: (agregat?.total_brut as number) ?? 0,
        totalNet: (agregat?.total_net as number) ?? 0,
        totalCoutEmployeur: (agregat?.total_cout_employeur as number) ?? 0,
      };
    });

    return { periode, parSociete, total: parSociete.reduce((s, p) => s + p.totalBrut, 0) };
  });

  return { mois };
}

// Turnover = sorties sur la période / effectif moyen (moyenne effectif début + fin de
// période) — définition retenue par défaut, non précisée dans la demande (cf. point signalé).
export async function obtenirTurnover(
  filialesAutorisees: string[] | null,
  dateDebut: string,
  dateFin: string
): Promise<TurnoverReponse> {
  const clauseFiliale2 = filialesAutorisees !== null ? 'AND filiale_id = ANY($2)' : '';
  const valeursSorties = filialesAutorisees !== null ? [dateDebut, dateFin, filialesAutorisees] : [dateDebut, dateFin];
  const clauseFilialeSorties = filialesAutorisees !== null ? 'AND filiale_id = ANY($3)' : '';

  const { rows: sortiesRows } = await pool.query(
    `SELECT count(*)::int AS total FROM employes
     WHERE statut = 'sorti' AND date_sortie BETWEEN $1 AND $2 ${clauseFilialeSorties}`,
    valeursSorties
  );

  async function effectifADate(date: string): Promise<number> {
    const valeurs = filialesAutorisees !== null ? [date, filialesAutorisees] : [date];
    const { rows } = await pool.query(
      `SELECT count(*)::int AS total FROM employes
       WHERE date_embauche <= $1 AND (date_sortie IS NULL OR date_sortie > $1) ${clauseFiliale2}`,
      valeurs
    );
    return rows[0].total;
  }

  const [effectifDebut, effectifFin] = await Promise.all([effectifADate(dateDebut), effectifADate(dateFin)]);
  const effectifMoyen = (effectifDebut + effectifFin) / 2;
  const sorties = sortiesRows[0].total;

  return {
    periodeDebut: dateDebut,
    periodeFin: dateFin,
    sorties,
    effectifDebut,
    effectifFin,
    effectifMoyen,
    tauxPourcent: effectifMoyen > 0 ? (sorties / effectifMoyen) * 100 : 0,
  };
}
