import ExcelJS from 'exceljs';
import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { calculerMasseSalariale, obtenirParametre } from '../paie/paie.service';
import { CyclePaie, GroupePar, ResumeCyclePaie, StatutCyclePaie } from './cyclesPaie.types';

function mapCycle(l: Record<string, unknown>): CyclePaie {
  return {
    id: l.id as string,
    moisPaie: l.mois_paie as string,
    filialeId: l.filiale_id as string,
    statut: l.statut as StatutCyclePaie,
    calculeLe: l.calcule_le as string | null,
    verifiePar: l.verifie_par as string | null,
    verifieLe: l.verifie_le as string | null,
    exporteLe: l.exporte_le as string | null,
    cloturePar: l.cloture_par as string | null,
    clotureLe: l.cloture_le as string | null,
    reouvertPar: l.reouvert_par as string | null,
    reouvertLe: l.reouvert_le as string | null,
  };
}

// Crée le cycle 'ouvert' s'il n'existe pas encore pour ce (mois, filiale) — l'écran de
// lancement doit pouvoir afficher un état avant que quiconque ait lancé quoi que ce soit.
export async function obtenirOuCreerCycle(filialeId: string, periode: string): Promise<CyclePaie> {
  const { rows } = await pool.query(
    `INSERT INTO cycles_paie (mois_paie, filiale_id)
     VALUES (date_trunc('month', $1::date), $2)
     ON CONFLICT (mois_paie, filiale_id) DO UPDATE SET updated_at = cycles_paie.updated_at
     RETURNING *`,
    [periode, filialeId]
  );
  return mapCycle(rows[0]);
}

// Compte "avec/sans éléments du mois" pour l'alerte non bloquante de l'écran de lancement
// (ADDENDUM_JOURNAL_PAIE_AMP.md §5 et §7.6) — ne filtre jamais qui est calculé.
export async function obtenirResumeCycle(filialeId: string, periode: string): Promise<ResumeCyclePaie> {
  const cycle = await obtenirOuCreerCycle(filialeId, periode);

  const { rows: elementsRows } = await pool.query(
    `SELECT COUNT(DISTINCT e.id) FILTER (WHERE v.employe_id IS NOT NULL) AS avec_elements,
            COUNT(DISTINCT e.id) FILTER (WHERE v.employe_id IS NULL) AS sans_elements
     FROM employes e
     LEFT JOIN elements_variables_paie v
       ON v.employe_id = e.id AND v.periode = date_trunc('month', $2::date)
     WHERE e.statut = 'actif' AND e.filiale_id = $1`,
    [filialeId, periode]
  );

  const { rows: bulletinsRows } = await pool.query(
    `SELECT COUNT(*) AS nb, COALESCE(SUM(b.net_a_payer), 0) AS total_net
     FROM bulletins_paie b
     JOIN employes e ON e.id = b.employe_id
     WHERE e.filiale_id = $1 AND b.periode = date_trunc('month', $2::date)`,
    [filialeId, periode]
  );

  return {
    ...cycle,
    nbEmployesAvecElements: Number(elementsRows[0].avec_elements),
    nbEmployesSansElements: Number(elementsRows[0].sans_elements),
    nbBulletinsCalcules: Number(bulletinsRows[0].nb),
    totalNetAPayer: Number(bulletinsRows[0].total_net),
  };
}

export async function listerCycles(filialesAutorisees: string[] | null, periode?: string): Promise<CyclePaie[]> {
  const conditions: string[] = [];
  const valeurs: unknown[] = [];

  if (filialesAutorisees !== null) {
    valeurs.push(filialesAutorisees);
    conditions.push(`filiale_id = ANY($${valeurs.length})`);
  }
  if (periode) {
    valeurs.push(periode);
    conditions.push(`mois_paie = date_trunc('month', $${valeurs.length}::date)`);
  }

  const clauseWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(`SELECT * FROM cycles_paie ${clauseWhere} ORDER BY mois_paie DESC`, valeurs);
  return rows.map(mapCycle);
}

export async function lancerCalcul(filialeId: string, periode: string): Promise<ResumeCyclePaie> {
  const cycle = await obtenirOuCreerCycle(filialeId, periode);
  if (cycle.statut === 'cloture') {
    throw new ErreurApplicative(409, 'Ce mois est clôturé pour cette filiale — réouverture requise avant de recalculer');
  }

  await calculerMasseSalariale(filialeId, periode);

  await pool.query(`UPDATE cycles_paie SET statut = 'calcule', calcule_le = now(), updated_at = now() WHERE id = $1`, [
    cycle.id,
  ]);

  return obtenirResumeCycle(filialeId, periode);
}

export async function marquerVerifie(filialeId: string, periode: string, utilisateurId: string): Promise<CyclePaie> {
  const { rows } = await pool.query(
    `UPDATE cycles_paie SET statut = 'verifie', verifie_par = $3, verifie_le = now(), updated_at = now()
     WHERE filiale_id = $1 AND mois_paie = date_trunc('month', $2::date) AND statut = 'calcule'
     RETURNING *`,
    [filialeId, periode, utilisateurId]
  );
  if (!rows[0]) {
    throw new ErreurApplicative(409, "Le cycle doit être au statut « calculé » pour être marqué vérifié");
  }
  return mapCycle(rows[0]);
}

export async function cloturer(filialeId: string, periode: string, utilisateurId: string): Promise<CyclePaie> {
  const { rows } = await pool.query(
    `UPDATE cycles_paie SET statut = 'cloture', cloture_par = $3, cloture_le = now(), updated_at = now()
     WHERE filiale_id = $1 AND mois_paie = date_trunc('month', $2::date) AND statut = 'exporte'
     RETURNING *`,
    [filialeId, periode, utilisateurId]
  );
  if (!rows[0]) {
    throw new ErreurApplicative(409, "Le cycle doit être au statut « exporté » pour être clôturé");
  }
  return mapCycle(rows[0]);
}

// Réservée à super_admin/drh_holding (équivalent admin/DAF, cf. addendum §2) — imposé côté route.
export async function reouvrir(filialeId: string, periode: string, utilisateurId: string): Promise<CyclePaie> {
  const { rows } = await pool.query(
    `UPDATE cycles_paie SET statut = 'ouvert', reouvert_par = $3, reouvert_le = now(), updated_at = now()
     WHERE filiale_id = $1 AND mois_paie = date_trunc('month', $2::date) AND statut = 'cloture'
     RETURNING *`,
    [filialeId, periode, utilisateurId]
  );
  if (!rows[0]) {
    throw new ErreurApplicative(409, "Le cycle doit être au statut « clôturé » pour être réouvert");
  }
  return mapCycle(rows[0]);
}

// ----------------------------------------------------------------------------
// Journal de Paie (ADDENDUM_JOURNAL_PAIE_AMP.md §3, §4, §6)
// ----------------------------------------------------------------------------

interface LigneJournal {
  matricule: string;
  nom: string;
  prenoms: string;
  poste: string | null;
  entreprise: string;
  lieuAffectation: string | null;
  categorie: string | null;
  joursPrisEnCompte: number;
  tauxJournalier: number;
  personnesACharge: number;
  salaireBase: number;
  indemniteFonction: number;
  indemniteSujetion: number;
  indemniteAstreinte: number;
  indemniteLogement: number;
  indemniteTransport: number;
  primePanier: number;
  sursalaire: number;
  heuresSupplementaires: number;
  primeAnciennete: number;
  autresIndemnites: number;
  reliquat: number;
  remunerationTotale: number;
  cnss: number;
  salaireBrut: number;
  sni: number;
  af: number;
  bi: number;
  iutsNet: number;
  salaireNet: number;
  retenues1Pourcent: number;
  avance: number;
  rtp: number;
  totalRetenues: number;
  netAPayer: number;
  banque: string | null;
  numeroCompte: string | null;
  modePaiement: string | null;
  cotisationPatronale: number;
  tpa: number;
}

// Taux jr = salaire de base NOMINAL (contractuel, non proratisé) / 30 — l'addendum ne précise
// pas la formule exacte de cette colonne informative (elle n'entre dans aucun calcul de paie) ;
// choix cohérent avec CONSTANTES_PAIE_2026.joursReferenceMois utilisé partout ailleurs dans le
// moteur pour la même base de 30 jours. À confirmer si le fichier source calcule différemment.
function tauxJournalier(salaireBaseNominal: number): number {
  return Math.round((salaireBaseNominal / 30) * 100) / 100;
}

async function obtenirLignesJournal(filialeId: string, periode: string): Promise<LigneJournal[]> {
  const tauxCnssPatronale = await obtenirParametre('taux_cnss_patronale');
  const tauxTpa = await obtenirParametre('taux_tpa');
  const PLAFOND_CNSS = 800_000;

  const { rows } = await pool.query(
    `SELECT b.*, c.salaire_base AS salaire_base_nominal,
            e.matricule, e.nom, e.prenoms, e.rib, e.banque, e.mode_paiement, e.categorie_professionnelle,
            fil.nom AS entreprise,
            COALESCE(chp.nom, chd.nom) AS lieu_affectation
     FROM bulletins_paie b
     JOIN employes e ON e.id = b.employe_id
     JOIN filiales fil ON fil.id = e.filiale_id
     LEFT JOIN chantiers chd ON chd.id = e.chantier_id
     LEFT JOIN pointages_mensuels pmv
       ON pmv.employe_id = e.id AND pmv.mois_paie = b.periode AND pmv.statut = 'valide'
     LEFT JOIN chantiers chp ON chp.id = pmv.chantier_id
     LEFT JOIN LATERAL (
       SELECT salaire_base FROM contrats
       WHERE employe_id = e.id AND statut = 'actif'
       ORDER BY date_debut DESC LIMIT 1
     ) c ON true
     WHERE e.filiale_id = $1 AND b.periode = date_trunc('month', $2::date)
     ORDER BY e.nom, e.prenoms`,
    [filialeId, periode]
  );

  return rows.map((l): LigneJournal => {
    const remunerationTotale = Number(l.brut);
    const cnss = Number(l.cnss_salariale);
    const iuts = Number(l.iuts);
    const fsp = Number(l.fsp);
    const avance = Number(l.avance_acompte);
    const salaireBaseNominal = l.salaire_base_nominal !== null ? Number(l.salaire_base_nominal) : Number(l.salaire_base);

    return {
      matricule: l.matricule,
      nom: l.nom,
      prenoms: l.prenoms,
      poste: l.fonction_intitule,
      entreprise: l.entreprise,
      lieuAffectation: l.lieu_affectation,
      categorie: l.categorie_professionnelle,
      joursPrisEnCompte: Number(l.jours_pris_en_compte),
      tauxJournalier: tauxJournalier(salaireBaseNominal),
      personnesACharge: Number(l.personnes_a_charge),
      salaireBase: Number(l.salaire_base),
      indemniteFonction: Number(l.indemnite_fonction),
      indemniteSujetion: Number(l.indemnite_sujetion),
      indemniteAstreinte: Number(l.indemnite_astreinte),
      indemniteLogement: Number(l.indemnite_logement),
      indemniteTransport: Number(l.indemnite_transport),
      primePanier: Number(l.prime_panier),
      sursalaire: Number(l.sursalaire),
      heuresSupplementaires: Number(l.heures_supplementaires),
      primeAnciennete: Number(l.prime_anciennete),
      autresIndemnites: Number(l.autres_indemnites),
      reliquat: Number(l.reliquat),
      remunerationTotale,
      cnss,
      salaireBrut: remunerationTotale - cnss,
      sni: Number(l.salaire_net_imposable),
      af: Number(l.abattement_forfaitaire),
      bi: Number(l.base_imposable),
      iutsNet: iuts,
      salaireNet: Number(l.salaire_net),
      retenues1Pourcent: fsp,
      avance,
      rtp: Number(l.reversement_trop_percu),
      totalRetenues: iuts + fsp + avance + cnss,
      netAPayer: Number(l.net_a_payer),
      banque: l.banque,
      numeroCompte: l.rib,
      modePaiement: l.mode_paiement,
      cotisationPatronale: Math.round(Math.min(remunerationTotale * tauxCnssPatronale, PLAFOND_CNSS * tauxCnssPatronale)),
      tpa: Math.round(remunerationTotale * tauxTpa),
    };
  });
}

// Colonnes exactes de l'onglet "JOURNAL PAIE" réel (ADDENDUM_JOURNAL_PAIE_AMP.md §3).
const COLONNES_JOURNAL: { titre: string; largeur: number; valeur: (l: LigneJournal) => string | number | null }[] = [
  { titre: 'N°', largeur: 6, valeur: () => null },
  { titre: 'Matricule', largeur: 12, valeur: (l) => l.matricule },
  { titre: 'Nom et Prénom(s)', largeur: 26, valeur: (l) => `${l.nom} ${l.prenoms}` },
  { titre: 'Emplois', largeur: 18, valeur: (l) => l.poste },
  { titre: 'Entreprise', largeur: 16, valeur: (l) => l.entreprise },
  { titre: "Lieu d'affectation", largeur: 16, valeur: (l) => l.lieuAffectation },
  { titre: 'Catégorie', largeur: 14, valeur: (l) => l.categorie },
  { titre: 'Nbr jrs', largeur: 8, valeur: (l) => l.joursPrisEnCompte },
  { titre: 'Taux jr', largeur: 10, valeur: (l) => l.tauxJournalier },
  { titre: 'Nbre de charges', largeur: 10, valeur: (l) => l.personnesACharge },
  { titre: 'Salaire de base', largeur: 14, valeur: (l) => l.salaireBase },
  { titre: 'Ind. Fonction', largeur: 12, valeur: (l) => l.indemniteFonction },
  { titre: 'Ind. Sujétion', largeur: 12, valeur: (l) => l.indemniteSujetion },
  { titre: 'Ind. Astreinte', largeur: 12, valeur: (l) => l.indemniteAstreinte },
  { titre: 'Ind. Logement', largeur: 12, valeur: (l) => l.indemniteLogement },
  { titre: 'Ind. Transport', largeur: 12, valeur: (l) => l.indemniteTransport },
  { titre: 'Prime de panier', largeur: 12, valeur: (l) => l.primePanier },
  { titre: 'Sursalaire', largeur: 12, valeur: (l) => l.sursalaire },
  { titre: 'HS', largeur: 10, valeur: (l) => l.heuresSupplementaires },
  { titre: 'PA', largeur: 10, valeur: (l) => l.primeAnciennete },
  { titre: 'AI', largeur: 10, valeur: (l) => l.autresIndemnites },
  { titre: 'Reliquat', largeur: 10, valeur: (l) => l.reliquat },
  { titre: 'Rémunération Totale', largeur: 16, valeur: (l) => l.remunerationTotale },
  { titre: 'CNSS', largeur: 10, valeur: (l) => l.cnss },
  { titre: 'Salaire BRUT', largeur: 14, valeur: (l) => l.salaireBrut },
  { titre: 'SNI', largeur: 12, valeur: (l) => l.sni },
  { titre: 'AF', largeur: 10, valeur: (l) => l.af },
  { titre: 'BI', largeur: 12, valeur: (l) => l.bi },
  { titre: 'IUTS NET', largeur: 10, valeur: (l) => l.iutsNet },
  { titre: 'SN', largeur: 12, valeur: (l) => l.salaireNet },
  { titre: 'Retenues 1%', largeur: 10, valeur: (l) => l.retenues1Pourcent },
  { titre: 'Avance', largeur: 10, valeur: (l) => l.avance },
  { titre: 'RTP', largeur: 10, valeur: (l) => l.rtp },
  { titre: 'T Retenue', largeur: 12, valeur: (l) => l.totalRetenues },
  { titre: 'Net à payer', largeur: 14, valeur: (l) => l.netAPayer },
  { titre: 'Banque', largeur: 14, valeur: (l) => l.banque },
  { titre: 'Numéro compte', largeur: 18, valeur: (l) => l.numeroCompte },
  { titre: 'Mode de paiement', largeur: 14, valeur: (l) => l.modePaiement },
  { titre: 'Cotisation patronale', largeur: 16, valeur: (l) => l.cotisationPatronale },
  { titre: 'TPA', largeur: 10, valeur: (l) => l.tpa },
];

const COLONNES_NUMERIQUES = new Set([
  'Nbr jrs',
  'Taux jr',
  'Nbre de charges',
  'Salaire de base',
  'Ind. Fonction',
  'Ind. Sujétion',
  'Ind. Astreinte',
  'Ind. Logement',
  'Ind. Transport',
  'Prime de panier',
  'Sursalaire',
  'HS',
  'PA',
  'AI',
  'Reliquat',
  'Rémunération Totale',
  'CNSS',
  'Salaire BRUT',
  'SNI',
  'AF',
  'BI',
  'IUTS NET',
  'SN',
  'Retenues 1%',
  'Avance',
  'RTP',
  'T Retenue',
  'Net à payer',
  'Cotisation patronale',
  'TPA',
]);

function ecrireFeuille(feuille: ExcelJS.Worksheet, lignes: LigneJournal[], moisLibelle: string) {
  feuille.columns = COLONNES_JOURNAL.map((c) => ({ header: c.titre, width: c.largeur }));
  feuille.getRow(1).font = { bold: true };

  lignes.forEach((ligne, index) => {
    const valeurs = COLONNES_JOURNAL.map((c) => (c.titre === 'N°' ? index + 1 : c.valeur(ligne)));
    const row = feuille.addRow(valeurs);
    COLONNES_JOURNAL.forEach((c, i) => {
      if (COLONNES_NUMERIQUES.has(c.titre)) row.getCell(i + 1).numFmt = '#,##0';
    });
  });

  const indexNetAPayer = COLONNES_JOURNAL.findIndex((c) => c.titre === 'Net à payer') + 1;
  const ligneTotal = feuille.addRow([]);
  ligneTotal.getCell(1).value = 'Total';
  ligneTotal.getCell(1).font = { bold: true };
  ligneTotal.getCell(indexNetAPayer).value = lignes.reduce((s, l) => s + l.netAPayer, 0);
  ligneTotal.getCell(indexNetAPayer).numFmt = '#,##0';
  ligneTotal.getCell(indexNetAPayer).font = { bold: true };

  feuille.getCell(`A${feuille.rowCount + 2}`).value = `Journal de Paie — ${moisLibelle}`;
}

// Génère le classeur Excel — export complet (une feuille) ou groupé par mode de paiement
// (une feuille par mode, triée, avec sous-total, cf. addendum §4).
async function construireClasseur(
  lignes: LigneJournal[],
  periode: string,
  groupePar?: GroupePar
): Promise<ExcelJS.Buffer> {
  const classeur = new ExcelJS.Workbook();
  const moisLibelle = new Date(periode).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  if (!groupePar) {
    ecrireFeuille(classeur.addWorksheet('Journal de Paie'), lignes, moisLibelle);
  } else {
    const groupes = new Map<string, LigneJournal[]>();
    for (const ligne of lignes) {
      const cle = (ligne.modePaiement || 'Non renseigné').trim() || 'Non renseigné';
      if (!groupes.has(cle)) groupes.set(cle, []);
      groupes.get(cle)!.push(ligne);
    }
    for (const [mode, lignesGroupe] of groupes) {
      const nomFeuille = mode.slice(0, 31); // limite Excel
      const lignesTriees = [...lignesGroupe].sort((a, b) => (a.banque ?? '').localeCompare(b.banque ?? ''));
      ecrireFeuille(classeur.addWorksheet(nomFeuille), lignesTriees, moisLibelle);
    }
  }

  return classeur.xlsx.writeBuffer();
}

export async function genererJournalPaie(
  filialeId: string,
  periode: string,
  groupePar?: GroupePar
): Promise<{ buffer: ExcelJS.Buffer; nomFichier: string }> {
  const cycle = await obtenirOuCreerCycle(filialeId, periode);
  if (!['verifie', 'exporte'].includes(cycle.statut)) {
    throw new ErreurApplicative(409, "Le cycle doit être au moins « vérifié » avant de générer le Journal de Paie");
  }

  const lignes = await obtenirLignesJournal(filialeId, periode);
  const buffer = await construireClasseur(lignes, periode, groupePar);

  if (cycle.statut === 'verifie') {
    await pool.query(`UPDATE cycles_paie SET statut = 'exporte', exporte_le = now(), updated_at = now() WHERE id = $1`, [
      cycle.id,
    ]);
  }

  const suffixe = groupePar === 'mode_paiement' ? '-par-mode-paiement' : '';
  return { buffer, nomFichier: `journal-paie-${periode}${suffixe}.xlsx` };
}
