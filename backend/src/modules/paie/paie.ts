import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { authentification } from '../../middleware/authentification';
import { autoriserRoles, filialesAutoriseesPour } from '../../middleware/autorisation';
import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { verifierCycleOuvertPourEmploye, verifierCycleOuvertPourFiliale } from '../cyclesPaie/verrouCycle';
import {
  calculerBrutDepuisNet,
  calculerBulletinJournalier,
  calculerBulletinPaie,
  Categorie,
  LigneHeureSupplementaire,
} from './calculerBulletinPaie';
import { genererBulletinPdf } from './paie.pdf';

// ============================================================================
// Types
// ============================================================================

export type StatutBulletin = 'brouillon' | 'calcule' | 'valide' | 'valide_drh' | 'cloture';

export interface BulletinPaie {
  id: string;
  employeId: string;
  periode: string;

  joursPrisEnCompte: number;
  personnesACharge: number;
  // Snapshot de fonctions.intitule au moment du calcul (cf. bulletins_paie.fonction_intitule) —
  // un renommage/archivage ultérieur de la fonction ne change jamais un bulletin déjà généré.
  fonctionIntitule: string | null;

  salaireBase: number;
  sursalaire: number;
  indemniteLogement: number;
  indemniteTransport: number;
  indemniteFonction: number;
  indemniteSujetion: number;
  indemniteAstreinte: number;
  ancienneteAnnees: number;
  primeAnciennete: number;
  heuresSupplementaires: number;
  hs15: number;
  hs35: number;
  hs50: number;
  hs60: number;
  hs120: number;
  primePanier: number;
  primeSalissure: number;
  primeLait: number;
  autresIndemnites: number;
  avanceAcompte: number;
  reliquat: number;
  reversementTropPercu: number;

  brut: number;
  exonerationsIndemnites: number;
  abattementForfaitaire: number;
  salaireNetImposable: number;
  baseImposable: number;
  iuts: number;
  cnssSalariale: number;
  salaireNet: number;
  fsp: number;
  autresRetenues: number;
  netAPayer: number;
  coutEmployeur: number;

  statut: StatutBulletin;
  pdfUrl: string | null;
}

export interface ElementsCalculBulletin {
  employeId: string;
  periode: string;
}

export interface EchecCalculMasse {
  employeId: string;
  nom: string;
  prenoms: string;
  motif: string;
}

export interface ResultatCalculMasse {
  periode: string;
  bulletinsCalcules: BulletinPaie[];
  echecs: EchecCalculMasse[];
}

// Simulateur Net → Brut (ADDENDUM_CALCUL_INVERSE_PAIE_AMP.md) — ne touche jamais la base ;
// mêmes champs qu'un bulletin pour l'affichage, sans id/employeId/periode/statut.
export interface DetailBulletinSimule {
  joursPrisEnCompte: number;
  personnesACharge: number;
  salaireBase: number;
  sursalaire: number;
  indemniteLogement: number;
  indemniteTransport: number;
  indemniteFonction: number;
  indemniteSujetion: number;
  indemniteAstreinte: number;
  ancienneteAnnees: number;
  primeAnciennete: number;
  heuresSupplementaires: number;
  primePanier: number;
  autresIndemnites: number;
  reliquat: number;
  reversementTropPercu: number;
  retenuesAvancesDuMois: number;
  brut: number;
  exonerationsIndemnites: number;
  abattementForfaitaire: number;
  salaireNetImposable: number;
  baseImposable: number;
  iuts: number;
  cnssSalariale: number;
  salaireNet: number;
  fsp: number;
  netAPayer: number;
}

export interface SimulationNetVersBrut {
  netCible: number;
  categorie: 'CADRE' | 'NON_CADRE';
  personnesACharge?: number;
  ancienneteAnnees?: number;
  salaireDeBase?: number;
  sursalaire?: number;
  indemniteLogement?: number;
  indemniteTransport?: number;
  indemniteSujetion?: number;
  indemniteAstreinte?: number;
  indemniteFonction?: number;
  panier?: number;
  autresIndemnites?: number;
  retenuesAvancesDuMois?: number;
  reliquat?: number;
  reversementTropPercu?: number;
  joursPrisEnCompte?: number;
  champVariable?: 'salaireDeBase' | 'sursalaire';
}

export interface ResultatSimulationNetVersBrut {
  champVariable: 'salaireDeBase' | 'sursalaire';
  valeurTrouvee: number;
  convergence: boolean;
  ecartFinal: number;
  bulletin: DetailBulletinSimule;
}

// ============================================================================
// Service
// ============================================================================

const PLAFOND_CNSS = 800_000;

function montantParTaux(lignes: LigneHeureSupplementaire[], majorationPourcent: number): number {
  return lignes.find((l) => l.majorationPourcent === majorationPourcent)?.montant ?? 0;
}

export async function obtenirParametre(cle: string): Promise<number> {
  const { rows } = await pool.query(
    'SELECT valeur FROM parametres_paie WHERE cle = $1 ORDER BY date_effet DESC LIMIT 1',
    [cle]
  );

  if (!rows[0]) {
    throw new ErreurApplicative(500, `Paramètre de paie manquant : ${cle}. Configurez la table parametres_paie.`);
  }

  return Number(rows[0].valeur);
}

interface ContratPourPaie {
  salaireBase: number;
  sursalaire: number;
  indemniteLogement: number;
  indemniteTransport: number;
  indemniteFonction: number;
  indemniteSujetion: number;
  indemniteAstreinte: number;
}

async function obtenirContratActif(employeId: string): Promise<ContratPourPaie> {
  const { rows } = await pool.query(
    `SELECT salaire_base, sursalaire, indemnite_logement, indemnite_transport,
            indemnite_fonction, indemnite_sujetion, indemnite_astreinte
     FROM contrats WHERE employe_id = $1 AND statut = 'actif' ORDER BY date_debut DESC LIMIT 1`,
    [employeId]
  );

  if (!rows[0]) {
    throw new ErreurApplicative(409, 'Aucun contrat actif pour cet employé — impossible de calculer la paie');
  }

  const l = rows[0];
  return {
    salaireBase: Number(l.salaire_base),
    sursalaire: Number(l.sursalaire),
    indemniteLogement: Number(l.indemnite_logement),
    indemniteTransport: Number(l.indemnite_transport),
    indemniteFonction: Number(l.indemnite_fonction),
    indemniteSujetion: Number(l.indemnite_sujetion),
    indemniteAstreinte: Number(l.indemnite_astreinte),
  };
}

interface EmployePourPaie {
  dateEmbauche: Date;
  categorie: Categorie;
  personnesACharge: number;
  fonctionIntitule: string | null;
  remunereAuJour: boolean;
}

// Les colonnes DATE sont lues en texte brut ('AAAA-MM-JJ', cf. config/db.ts) pour éviter le
// décalage de fuseau horaire d'un Date UTC — on construit donc la Date en local explicitement.
function parserDateLocale(date: string): Date {
  const [annee, mois, jour] = date.split('-').map(Number);
  return new Date(annee, mois - 1, jour);
}

// est_cadre (categories_professionnelles, gérée depuis Paramètres > Référentiels) pilote
// directement CADRE/NON_CADRE du moteur de paie — plus de test littéral sur "cadre" en dur, ni
// d'ENUM figé. Catégorie absente ou archivée/inconnue → NON_CADRE par défaut (comportement
// identique à l'ancien mapping quand categorie_professionnelle était NULL).
async function obtenirEmployePourPaie(employeId: string): Promise<EmployePourPaie> {
  const { rows } = await pool.query(
    `SELECT e.date_embauche, e.personnes_a_charge, e.remunere_au_jour, fo.intitule AS fonction_intitule,
            COALESCE(cp.est_cadre, false) AS est_cadre
     FROM employes e
     LEFT JOIN fonctions fo ON fo.id = e.fonction_id
     LEFT JOIN categories_professionnelles cp ON cp.code = e.categorie_professionnelle
     WHERE e.id = $1`,
    [employeId]
  );

  if (!rows[0]) {
    throw new ErreurApplicative(404, 'Employé introuvable');
  }

  const categorie: Categorie = rows[0].est_cadre ? 'CADRE' : 'NON_CADRE';

  return {
    dateEmbauche: parserDateLocale(rows[0].date_embauche as string),
    categorie,
    personnesACharge: Number(rows[0].personnes_a_charge),
    fonctionIntitule: rows[0].fonction_intitule as string | null,
    remunereAuJour: rows[0].remunere_au_jour as boolean,
  };
}

interface TauxJournalierPourPaie {
  salaireBaseMensuel: number;
  indemniteTransportMensuel: number;
  primeLaitMensuel: number;
  primeSalissureMensuel: number;
}

async function obtenirTauxJournalierActif(employeId: string): Promise<TauxJournalierPourPaie> {
  const { rows } = await pool.query(
    `SELECT salaire_base_mensuel, indemnite_transport_mensuel, prime_lait_mensuel, prime_salissure_mensuel
     FROM taux_journaliers WHERE employe_id = $1`,
    [employeId]
  );

  if (!rows[0]) {
    throw new ErreurApplicative(
      409,
      "Aucun taux journalier configuré pour cet employé rémunéré au jour — impossible de calculer la paie"
    );
  }

  const l = rows[0];
  return {
    salaireBaseMensuel: Number(l.salaire_base_mensuel),
    indemniteTransportMensuel: Number(l.indemnite_transport_mensuel),
    primeLaitMensuel: Number(l.prime_lait_mensuel),
    primeSalissureMensuel: Number(l.prime_salissure_mensuel),
  };
}

// Jours réellement pointés ce mois (pointages_mensuels.jours_travailles) — seule source de jours
// pour un employé rémunéré au jour, à la place de « 30 − absences » utilisé pour les mensualisés.
// Exige une fiche validée : sans ça, aucun moyen fiable de savoir combien de jours payer.
async function obtenirJoursTravaillesValides(employeId: string, periode: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT statut, jours_travailles FROM pointages_mensuels
     WHERE employe_id = $1 AND mois_paie = date_trunc('month', $2::date)`,
    [employeId, periode]
  );

  if (!rows[0] || rows[0].statut !== 'valide') {
    throw new ErreurApplicative(
      409,
      'Aucune fiche de pointage validée pour ce mois — impossible de calculer la paie de cet employé rémunéré au jour'
    );
  }

  return Number(rows[0].jours_travailles);
}

function mapBulletin(l: Record<string, unknown>): BulletinPaie {
  return {
    id: l.id as string,
    employeId: l.employe_id as string,
    periode: l.periode as string,
    joursPrisEnCompte: Number(l.jours_pris_en_compte),
    personnesACharge: Number(l.personnes_a_charge),
    fonctionIntitule: l.fonction_intitule as string | null,
    salaireBase: Number(l.salaire_base),
    sursalaire: Number(l.sursalaire),
    indemniteLogement: Number(l.indemnite_logement),
    indemniteTransport: Number(l.indemnite_transport),
    indemniteFonction: Number(l.indemnite_fonction),
    indemniteSujetion: Number(l.indemnite_sujetion),
    indemniteAstreinte: Number(l.indemnite_astreinte),
    ancienneteAnnees: Number(l.anciennete_annees),
    primeAnciennete: Number(l.prime_anciennete),
    heuresSupplementaires: Number(l.heures_supplementaires),
    hs15: Number(l.hs_15),
    hs35: Number(l.hs_35),
    hs50: Number(l.hs_50),
    hs60: Number(l.hs_60),
    hs120: Number(l.hs_120),
    primePanier: Number(l.prime_panier),
    primeSalissure: Number(l.prime_salissure),
    primeLait: Number(l.prime_lait),
    autresIndemnites: Number(l.autres_indemnites),
    avanceAcompte: Number(l.avance_acompte),
    reliquat: Number(l.reliquat),
    reversementTropPercu: Number(l.reversement_trop_percu),
    brut: Number(l.brut),
    exonerationsIndemnites: Number(l.exonerations_indemnites),
    abattementForfaitaire: Number(l.abattement_forfaitaire),
    salaireNetImposable: Number(l.salaire_net_imposable),
    baseImposable: Number(l.base_imposable),
    iuts: Number(l.iuts),
    cnssSalariale: Number(l.cnss_salariale),
    salaireNet: Number(l.salaire_net),
    fsp: Number(l.fsp),
    autresRetenues: Number(l.autres_retenues),
    netAPayer: Number(l.net_a_payer),
    coutEmployeur: Number(l.cout_employeur),
    statut: l.statut as StatutBulletin,
    pdfUrl: l.pdf_url as string | null,
  };
}

// Bloque le calcul de paie d'un employé marqué « soumis au pointage » (employes.soumis_pointage,
// décision RH explicite par employé — cf. schema.sql) tant que sa fiche Pointage du mois n'est
// pas au statut 'valide'. Volontairement indépendant de chantier_id (simple localisation, pas un
// indicateur fiable) et de l'existence d'un contrat (un employé sans contrat, payé hors SIRH, peut
// très bien être pointé quand même sans jamais passer par le calcul de bulletin). Blocage explicite
// (message porté par l'erreur) plutôt qu'exclusion silencieuse — SPEC_MODULE_POINTAGE_AMP.md §7.
async function verifierPointageValidePourEmploye(employeId: string, periode: string): Promise<void> {
  const { rows: employeRows } = await pool.query('SELECT soumis_pointage FROM employes WHERE id = $1', [employeId]);
  if (!employeRows[0]?.soumis_pointage) return;

  const { rows: ficheRows } = await pool.query(
    `SELECT statut FROM pointages_mensuels WHERE employe_id = $1 AND mois_paie = date_trunc('month', $2::date)`,
    [employeId, periode]
  );
  if (ficheRows[0]?.statut !== 'valide') {
    throw new ErreurApplicative(409, 'Pointage non validé — paie bloquée');
  }
}

// Valeurs communes aux deux moteurs (mensualisé via contrat, ou journalier via taux_journaliers)
// juste avant l'écriture en base — permet à calculerEtEnregistrerBulletin de ne garder qu'un seul
// bloc INSERT/UPDATE, quel que soit le moteur qui a produit ces chiffres.
interface ValeursBulletin {
  joursPrisEnCompte: number;
  salaireBase: number;
  sursalaire: number;
  indemniteLogement: number;
  indemniteTransport: number;
  indemniteFonction: number;
  indemniteSujetion: number;
  indemniteAstreinte: number;
  ancienneteAnnees: number;
  primeAnciennete: number;
  totalHeuresSupplementaires: number;
  hs15: number;
  hs35: number;
  hs50: number;
  hs60: number;
  hs120: number;
  primePanier: number;
  primeSalissure: number;
  primeLait: number;
  autresIndemnites: number;
  avanceAcompte: number;
  reliquat: number;
  reversementTropPercu: number;
  remunerationTotale: number;
  exonerationsTotal: number;
  abattementForfaitaire: number;
  salaireNetImposable: number;
  baseImposable: number;
  iutsNet: number;
  cnssSalariale: number;
  salaireNet: number;
  fsp: number;
  netAPayer: number;
}

export async function calculerEtEnregistrerBulletin(elements: ElementsCalculBulletin): Promise<BulletinPaie> {
  await verifierCycleOuvertPourEmploye(elements.employeId, elements.periode);
  await verifierPointageValidePourEmploye(elements.employeId, elements.periode);

  const employe = await obtenirEmployePourPaie(elements.employeId);

  // Éléments saisis via l'écran "Éléments du mois" (prime/avance/panier/reliquat/absence/trop
  // perçu) — une seule ligne par (employé, mois, type) grâce à la contrainte d'unicité, donc
  // SUM = valeur saisie. Source unique, reprise en calcul individuel comme en calcul de masse, et
  // par les deux moteurs (mensualisé et journalier).
  // heure_sup_15/35/60 sont alimentées automatiquement par la validation d'une fiche Pointage
  // (en heures, pas en F CFA — colonne `montant` réutilisée) ; heure_sup_50/120 restent des cas
  // exceptionnels saisis à la main (cf. SPEC_MODULE_POINTAGE_AMP.md, décision produit).
  const { rows: elementsMoisRows } = await pool.query(
    `SELECT type,
            COALESCE(SUM(montant), 0) AS total_montant,
            COALESCE(SUM(jours), 0) AS total_jours
     FROM elements_variables_paie
     WHERE employe_id = $1 AND periode = date_trunc('month', $2::date)
       AND type IN (
         'prime', 'avance', 'panier', 'reliquat', 'absence_injustifiee', 'trop_percu',
         'heure_sup_15', 'heure_sup_35', 'heure_sup_50', 'heure_sup_60', 'heure_sup_120',
         'prime_salissure', 'prime_lait'
       )
     GROUP BY type`,
    [elements.employeId, elements.periode]
  );
  const parType = new Map(elementsMoisRows.map((l) => [l.type as string, l]));
  const montantDuType = (type: string) => Number(parType.get(type)?.total_montant ?? 0);

  let valeurs: ValeursBulletin;

  if (employe.remunereAuJour) {
    // Ouvrier sans contrat, payé sur un montant mensuel de référence (cf. taux_journaliers)
    // proratisé par jours réellement pointés / 30 — pas de prime d'ancienneté (aucune référence
    // mensuelle pour l'asseoir), ni de retenues CNSS/IUTS/1% (non déclaré à la CNSS en l'absence
    // de contrat — décision produit), cf. calculerBulletinJournalier. Les heures sup comptent en
    // revanche comme pour un salarié sous contrat, assises sur le salaire de base mensuel.
    const taux = await obtenirTauxJournalierActif(elements.employeId);
    const joursTravailles = await obtenirJoursTravaillesValides(elements.employeId, elements.periode);

    const resultat = calculerBulletinJournalier({
      joursTravailles,
      salaireBaseMensuel: taux.salaireBaseMensuel,
      indemniteTransportMensuel: taux.indemniteTransportMensuel,
      primeLaitMensuel: taux.primeLaitMensuel,
      primeSalissureMensuel: taux.primeSalissureMensuel,
      heuresSupplementaires: {
        taux15: montantDuType('heure_sup_15'),
        taux35: montantDuType('heure_sup_35'),
        taux50: montantDuType('heure_sup_50'),
        taux60: montantDuType('heure_sup_60'),
        taux120: montantDuType('heure_sup_120'),
      },
      panier: montantDuType('panier'),
      autresIndemnites: montantDuType('prime'),
      retenuesAvancesDuMois: montantDuType('avance'),
      reversementTropPercu: montantDuType('trop_percu'),
      reliquat: montantDuType('reliquat'),
    });

    valeurs = {
      joursPrisEnCompte: joursTravailles,
      salaireBase: resultat.salaireBase,
      sursalaire: 0,
      indemniteLogement: 0,
      indemniteTransport: resultat.indemniteTransport,
      indemniteFonction: 0,
      indemniteSujetion: 0,
      indemniteAstreinte: 0,
      ancienneteAnnees: 0,
      primeAnciennete: 0,
      totalHeuresSupplementaires: resultat.totalHeuresSupplementaires,
      hs15: montantParTaux(resultat.heuresSupplementaires, 15),
      hs35: montantParTaux(resultat.heuresSupplementaires, 35),
      hs50: montantParTaux(resultat.heuresSupplementaires, 50),
      hs60: montantParTaux(resultat.heuresSupplementaires, 60),
      hs120: montantParTaux(resultat.heuresSupplementaires, 120),
      primePanier: montantDuType('panier'),
      primeSalissure: resultat.primeSalissure,
      primeLait: resultat.primeLait,
      autresIndemnites: montantDuType('prime'),
      avanceAcompte: montantDuType('avance'),
      reliquat: montantDuType('reliquat'),
      reversementTropPercu: montantDuType('trop_percu'),
      remunerationTotale: resultat.remunerationTotale,
      exonerationsTotal: resultat.exonerationsIndemnites.total,
      abattementForfaitaire: resultat.abattementForfaitaire,
      salaireNetImposable: resultat.salaireNetImposable,
      baseImposable: resultat.baseImposable,
      iutsNet: resultat.iutsNet,
      cnssSalariale: resultat.retenueCNSS,
      salaireNet: resultat.salaireNet,
      fsp: resultat.retenueFSP,
      netAPayer: resultat.netAPayer,
    };
  } else {
    const contrat = await obtenirContratActif(elements.employeId);
    const joursAbsenceInjustifiee = Number(parType.get('absence_injustifiee')?.total_jours ?? 0);
    const joursPrisEnCompte = Math.max(0, 30 - joursAbsenceInjustifiee);

    const resultat = calculerBulletinPaie(
      {
        salaireDeBase: contrat.salaireBase,
        indemniteLogement: contrat.indemniteLogement,
        indemniteTransport: contrat.indemniteTransport,
        indemniteSujetion: contrat.indemniteSujetion,
        indemniteAstreinte: contrat.indemniteAstreinte,
        indemniteFonction: contrat.indemniteFonction,
        sursalaire: contrat.sursalaire,
        dateEntree: employe.dateEmbauche,
        categorie: employe.categorie,
        declarationCnss: 'O', // toujours soumis à CNSS aujourd'hui — pas de champ dédié pour distinguer
        personnesACharge: employe.personnesACharge,
      },
      {
        joursPrisEnCompte,
        heuresSupplementaires: {
          taux15: montantDuType('heure_sup_15'),
          taux35: montantDuType('heure_sup_35'),
          taux50: montantDuType('heure_sup_50'),
          taux60: montantDuType('heure_sup_60'),
          taux120: montantDuType('heure_sup_120'),
        },
        heuresSupplementairesForfaitaires: 0,
        autresIndemnites: montantDuType('prime'),
        // "Éléments du mois" n'a qu'une seule saisie "avance" : c'est ce qui est effectivement
        // retenu ce mois-ci, donc mappé sur retenuesAvancesDuMois (le seul terme utilisé par la
        // formule du net à payer, cf. SPEC_MOTEUR_PAIE_AMP.md §17) — pas avancesAccordees.
        avancesAccordees: 0,
        retenuesAvancesDuMois: montantDuType('avance'),
        reversementTropPercu: montantDuType('trop_percu'),
        reliquat: montantDuType('reliquat'),
        panier: montantDuType('panier'),
        primeSalissure: montantDuType('prime_salissure'),
        primeLait: montantDuType('prime_lait'),
      }
    );

    valeurs = {
      joursPrisEnCompte,
      salaireBase: resultat.elementsProratises.salaireDeBase,
      sursalaire: resultat.elementsProratises.sursalaire,
      indemniteLogement: resultat.elementsProratises.indemniteLogement,
      indemniteTransport: resultat.elementsProratises.indemniteTransport,
      indemniteFonction: resultat.elementsProratises.indemniteFonction,
      indemniteSujetion: resultat.elementsProratises.indemniteSujetion,
      indemniteAstreinte: resultat.elementsProratises.indemniteAstreinte,
      ancienneteAnnees: resultat.ancienneteAnnees,
      primeAnciennete: resultat.primeAnciennete,
      totalHeuresSupplementaires: resultat.totalHeuresSupplementaires,
      // Montant calculé (F CFA) par tranche, pas les heures saisies — resultat.heuresSupplementaires
      // contient déjà { majorationPourcent, nombreHeures, tauxHoraire, montant } par taux.
      hs15: montantParTaux(resultat.heuresSupplementaires, 15),
      hs35: montantParTaux(resultat.heuresSupplementaires, 35),
      hs50: montantParTaux(resultat.heuresSupplementaires, 50),
      hs60: montantParTaux(resultat.heuresSupplementaires, 60),
      hs120: montantParTaux(resultat.heuresSupplementaires, 120),
      primePanier: montantDuType('panier'),
      primeSalissure: montantDuType('prime_salissure'),
      primeLait: montantDuType('prime_lait'),
      autresIndemnites: montantDuType('prime'),
      avanceAcompte: montantDuType('avance'),
      reliquat: montantDuType('reliquat'),
      reversementTropPercu: montantDuType('trop_percu'),
      remunerationTotale: resultat.remunerationTotale,
      exonerationsTotal: resultat.exonerationsIndemnites.total,
      abattementForfaitaire: resultat.abattementForfaitaire,
      salaireNetImposable: resultat.salaireNetImposable,
      baseImposable: resultat.baseImposable,
      iutsNet: resultat.iutsNet,
      cnssSalariale: resultat.retenueCNSS,
      salaireNet: resultat.salaireNet,
      fsp: resultat.retenueFSP,
      netAPayer: resultat.netAPayer,
    };
  }

  // BUG CORRIGÉ (ADDENDUM_JOURNAL_PAIE_AMP.md §3) : la cotisation patronale plafonnait sur le
  // salaire de base nominal seul, alors que la formule réelle plafonne sur la rémunération
  // totale (= 16% × rémunération totale, plafonné à 800 000×16% = 128 000). Faux dès que les
  // indemnités/sursalaire dépassent le salaire de base, ce qui est quasi systématique.
  const tauxCnssPatronale = await obtenirParametre('taux_cnss_patronale');
  const tauxTpa = await obtenirParametre('taux_tpa');
  const coutEmployeur = Math.round(
    valeurs.remunerationTotale +
      tauxCnssPatronale * Math.min(valeurs.remunerationTotale, PLAFOND_CNSS) +
      tauxTpa * valeurs.remunerationTotale
  );

  const { rows } = await pool.query(
    `INSERT INTO bulletins_paie (
       employe_id, periode, jours_pris_en_compte, personnes_a_charge, fonction_intitule,
       salaire_base, sursalaire, indemnite_logement, indemnite_transport, indemnite_fonction,
       indemnite_sujetion, indemnite_astreinte, anciennete_annees, prime_anciennete,
       heures_supplementaires, hs_15, hs_35, hs_50, hs_60, hs_120,
       prime_panier, prime_salissure, prime_lait, autres_indemnites, avance_acompte, reliquat,
       reversement_trop_percu, brut, exonerations_indemnites, abattement_forfaitaire,
       salaire_net_imposable, base_imposable, iuts, cnss_salariale, salaire_net, fsp,
       autres_retenues, net_a_payer, cout_employeur, statut
     ) VALUES (
       $1, date_trunc('month', $2::date), $3, $4, $5,
       $6, $7, $8, $9, $10,
       $11, $12, $13, $14,
       $15, $16, $17, $18, $19, $20,
       $21, $22, $23, $24, $25, $26,
       $27, $28, $29, $30,
       $31, $32, $33, $34, $35, $36,
       0, $37, $38, 'calcule'
     )
     ON CONFLICT (employe_id, periode) DO UPDATE SET
       jours_pris_en_compte = EXCLUDED.jours_pris_en_compte, personnes_a_charge = EXCLUDED.personnes_a_charge,
       fonction_intitule = EXCLUDED.fonction_intitule,
       salaire_base = EXCLUDED.salaire_base, sursalaire = EXCLUDED.sursalaire,
       indemnite_logement = EXCLUDED.indemnite_logement, indemnite_transport = EXCLUDED.indemnite_transport,
       indemnite_fonction = EXCLUDED.indemnite_fonction, indemnite_sujetion = EXCLUDED.indemnite_sujetion,
       indemnite_astreinte = EXCLUDED.indemnite_astreinte, anciennete_annees = EXCLUDED.anciennete_annees,
       prime_anciennete = EXCLUDED.prime_anciennete, heures_supplementaires = EXCLUDED.heures_supplementaires,
       hs_15 = EXCLUDED.hs_15, hs_35 = EXCLUDED.hs_35, hs_50 = EXCLUDED.hs_50, hs_60 = EXCLUDED.hs_60, hs_120 = EXCLUDED.hs_120,
       prime_panier = EXCLUDED.prime_panier, prime_salissure = EXCLUDED.prime_salissure, prime_lait = EXCLUDED.prime_lait,
       autres_indemnites = EXCLUDED.autres_indemnites,
       avance_acompte = EXCLUDED.avance_acompte, reliquat = EXCLUDED.reliquat,
       reversement_trop_percu = EXCLUDED.reversement_trop_percu,
       brut = EXCLUDED.brut, exonerations_indemnites = EXCLUDED.exonerations_indemnites,
       abattement_forfaitaire = EXCLUDED.abattement_forfaitaire, salaire_net_imposable = EXCLUDED.salaire_net_imposable,
       base_imposable = EXCLUDED.base_imposable, iuts = EXCLUDED.iuts, cnss_salariale = EXCLUDED.cnss_salariale,
       salaire_net = EXCLUDED.salaire_net, fsp = EXCLUDED.fsp, net_a_payer = EXCLUDED.net_a_payer,
       cout_employeur = EXCLUDED.cout_employeur, statut = 'calcule', updated_at = now()
     RETURNING *`,
    [
      elements.employeId,
      elements.periode,
      valeurs.joursPrisEnCompte,
      employe.personnesACharge,
      employe.fonctionIntitule,
      valeurs.salaireBase,
      valeurs.sursalaire,
      valeurs.indemniteLogement,
      valeurs.indemniteTransport,
      valeurs.indemniteFonction,
      valeurs.indemniteSujetion,
      valeurs.indemniteAstreinte,
      valeurs.ancienneteAnnees,
      valeurs.primeAnciennete,
      valeurs.totalHeuresSupplementaires,
      valeurs.hs15,
      valeurs.hs35,
      valeurs.hs50,
      valeurs.hs60,
      valeurs.hs120,
      valeurs.primePanier,
      valeurs.primeSalissure,
      valeurs.primeLait,
      valeurs.autresIndemnites,
      valeurs.avanceAcompte,
      valeurs.reliquat,
      valeurs.reversementTropPercu,
      valeurs.remunerationTotale,
      valeurs.exonerationsTotal,
      valeurs.abattementForfaitaire,
      valeurs.salaireNetImposable,
      valeurs.baseImposable,
      valeurs.iutsNet,
      valeurs.cnssSalariale,
      valeurs.salaireNet,
      valeurs.fsp,
      valeurs.netAPayer,
      coutEmployeur,
    ]
  );

  return mapBulletin(rows[0]);
}

// Calcule en une fois le bulletin de chaque employé actif de la filiale ayant un contrat
// actif, pour la période donnée. Séquentiel (pas Promise.all) — volumes modestes attendus
// pour une PME multi-filiales, et ça isole proprement l'échec d'un employé des autres.
export async function calculerMasseSalariale(filialeId: string, periode: string): Promise<ResultatCalculMasse> {
  await verifierCycleOuvertPourFiliale(filialeId, periode);

  const { rows } = await pool.query(
    `SELECT e.id, e.nom, e.prenoms, e.remunere_au_jour,
            EXISTS (SELECT 1 FROM contrats c WHERE c.employe_id = e.id AND c.statut = 'actif') AS a_contrat_actif
     FROM employes e
     WHERE e.statut = 'actif' AND e.filiale_id = $1
     ORDER BY e.nom, e.prenoms`,
    [filialeId]
  );

  const bulletinsCalcules: BulletinPaie[] = [];
  const echecs: ResultatCalculMasse['echecs'] = [];

  for (const ligne of rows) {
    // Un employé rémunéré au jour n'a jamais de contrat par construction — ne pas l'exclure ici,
    // calculerEtEnregistrerBulletin vérifie lui-même qu'un taux journalier est configuré.
    if (!ligne.a_contrat_actif && !ligne.remunere_au_jour) {
      echecs.push({ employeId: ligne.id, nom: ligne.nom, prenoms: ligne.prenoms, motif: 'Aucun contrat actif' });
      continue;
    }

    try {
      const bulletin = await calculerEtEnregistrerBulletin({ employeId: ligne.id, periode });
      bulletinsCalcules.push(bulletin);
    } catch (erreur) {
      echecs.push({
        employeId: ligne.id,
        nom: ligne.nom,
        prenoms: ligne.prenoms,
        motif: erreur instanceof ErreurApplicative ? erreur.message : 'Erreur inattendue',
      });
    }
  }

  return { periode, bulletinsCalcules, echecs };
}

// Simulateur Net → Brut (ADDENDUM_CALCUL_INVERSE_PAIE_AMP.md) — ne persiste rien, réutilise
// calculerBrutDepuisNet() qui appelle elle-même calculerBulletinPaie() en dichotomie.
export async function simulerNetVersBrut(donnees: SimulationNetVersBrut): Promise<ResultatSimulationNetVersBrut> {
  const dateReference = new Date();
  const dateEntree = new Date(dateReference);
  dateEntree.setFullYear(dateEntree.getFullYear() - (donnees.ancienneteAnnees ?? 0));

  const resultat = calculerBrutDepuisNet(
    donnees.netCible,
    {
      // Fixe quand on calcule le sursalaire (l'utilisateur connaît déjà le salaire de base et
      // cherche le complément) ; ignoré par la dichotomie quand champVariable='salaireDeBase'
      // puisqu'elle écrase alors ce champ à chaque itération.
      salaireDeBase: donnees.salaireDeBase ?? 0,
      indemniteLogement: donnees.indemniteLogement ?? 0,
      indemniteTransport: donnees.indemniteTransport ?? 0,
      indemniteSujetion: donnees.indemniteSujetion ?? 0,
      indemniteAstreinte: donnees.indemniteAstreinte ?? 0,
      indemniteFonction: donnees.indemniteFonction ?? 0,
      sursalaire: donnees.sursalaire ?? 0,
      dateEntree,
      categorie: donnees.categorie,
      declarationCnss: 'O',
      personnesACharge: donnees.personnesACharge ?? 0,
    },
    {
      joursPrisEnCompte: donnees.joursPrisEnCompte ?? 30,
      heuresSupplementaires: { taux15: 0, taux35: 0, taux50: 0, taux60: 0, taux120: 0 },
      heuresSupplementairesForfaitaires: 0,
      autresIndemnites: donnees.autresIndemnites ?? 0,
      avancesAccordees: 0,
      retenuesAvancesDuMois: donnees.retenuesAvancesDuMois ?? 0,
      reversementTropPercu: donnees.reversementTropPercu ?? 0,
      reliquat: donnees.reliquat ?? 0,
      panier: donnees.panier ?? 0,
      dateReference,
    },
    donnees.champVariable ?? 'salaireDeBase'
  );

  const b = resultat.bulletin;
  return {
    champVariable: resultat.champVariable,
    valeurTrouvee: resultat.valeurTrouvee,
    convergence: resultat.convergence,
    ecartFinal: resultat.ecartFinal,
    bulletin: {
      joursPrisEnCompte: donnees.joursPrisEnCompte ?? 30,
      personnesACharge: donnees.personnesACharge ?? 0,
      salaireBase: b.elementsProratises.salaireDeBase,
      sursalaire: b.elementsProratises.sursalaire,
      indemniteLogement: b.elementsProratises.indemniteLogement,
      indemniteTransport: b.elementsProratises.indemniteTransport,
      indemniteFonction: b.elementsProratises.indemniteFonction,
      indemniteSujetion: b.elementsProratises.indemniteSujetion,
      indemniteAstreinte: b.elementsProratises.indemniteAstreinte,
      ancienneteAnnees: b.ancienneteAnnees,
      primeAnciennete: b.primeAnciennete,
      heuresSupplementaires: b.totalHeuresSupplementaires,
      primePanier: donnees.panier ?? 0,
      autresIndemnites: donnees.autresIndemnites ?? 0,
      reliquat: donnees.reliquat ?? 0,
      reversementTropPercu: donnees.reversementTropPercu ?? 0,
      retenuesAvancesDuMois: donnees.retenuesAvancesDuMois ?? 0,
      brut: b.remunerationTotale,
      exonerationsIndemnites: b.exonerationsIndemnites.total,
      abattementForfaitaire: b.abattementForfaitaire,
      salaireNetImposable: b.salaireNetImposable,
      baseImposable: b.baseImposable,
      iuts: b.iutsNet,
      cnssSalariale: b.retenueCNSS,
      salaireNet: b.salaireNet,
      fsp: b.retenueFSP,
      netAPayer: b.netAPayer,
    },
  };
}

export async function listerBulletinsEmploye(employeId: string): Promise<BulletinPaie[]> {
  const { rows } = await pool.query('SELECT * FROM bulletins_paie WHERE employe_id = $1 ORDER BY periode DESC', [
    employeId,
  ]);
  return rows.map(mapBulletin);
}

export async function changerStatutBulletin(id: string, statut: StatutBulletin): Promise<BulletinPaie> {
  const { rows } = await pool.query(
    'UPDATE bulletins_paie SET statut = $2, updated_at = now() WHERE id = $1 RETURNING *',
    [id, statut]
  );

  if (!rows[0]) {
    throw new ErreurApplicative(404, 'Bulletin introuvable');
  }

  return mapBulletin(rows[0]);
}

// ============================================================================
// Contrôleur
// ============================================================================

// Sursalaire/indemnités viennent du contrat actif ; primes/avances/panier/reliquat/absences
// viennent de l'écran "Éléments du mois" (module elementsVariables) — plus aucune saisie
// manuelle ici, le calcul individuel et le calcul de masse partagent la même source.
const schemaCalcul = z.object({
  employeId: z.string().uuid(),
  periode: z.string(),
});

const schemaCalculMasse = z.object({
  filialeId: z.string().uuid(),
  periode: z.string(),
});

const schemaStatut = z.object({
  statut: z.enum(['valide', 'valide_drh', 'cloture']),
});

const schemaSimulation = z.object({
  netCible: z.number().positive(),
  categorie: z.enum(['CADRE', 'NON_CADRE']),
  personnesACharge: z.number().int().nonnegative().optional(),
  ancienneteAnnees: z.number().int().nonnegative().optional(),
  salaireDeBase: z.number().nonnegative().optional(),
  sursalaire: z.number().nonnegative().optional(),
  indemniteLogement: z.number().nonnegative().optional(),
  indemniteTransport: z.number().nonnegative().optional(),
  indemniteSujetion: z.number().nonnegative().optional(),
  indemniteAstreinte: z.number().nonnegative().optional(),
  indemniteFonction: z.number().nonnegative().optional(),
  panier: z.number().nonnegative().optional(),
  autresIndemnites: z.number().nonnegative().optional(),
  retenuesAvancesDuMois: z.number().nonnegative().optional(),
  reliquat: z.number().nonnegative().optional(),
  reversementTropPercu: z.number().nonnegative().optional(),
  joursPrisEnCompte: z.number().nonnegative().optional(),
  champVariable: z.enum(['salaireDeBase', 'sursalaire']).optional(),
});

export async function calculer(req: Request, res: Response) {
  const donnees = schemaCalcul.parse(req.body);
  res.status(201).json(await calculerEtEnregistrerBulletin(donnees));
}

export async function calculerMasse(req: Request, res: Response) {
  const { filialeId, periode } = schemaCalculMasse.parse(req.body);
  const filiales = filialesAutoriseesPour(req.utilisateur!);

  if (filiales !== null && !filiales.includes(filialeId)) {
    throw new ErreurApplicative(403, "Cette filiale n'est pas dans votre périmètre");
  }

  res.json(await calculerMasseSalariale(filialeId, periode));
}

// Vérifie que l'utilisateur peut voir les bulletins de cet employé : lui-même, ou une
// filiale dans son périmètre. Absent avant cette révision — n'importe quel authentifié
// pouvait lire le détail de salaire de n'importe qui en changeant employeId dans l'URL.
async function verifierAccesEmploye(req: Request, employeId: string): Promise<void> {
  const utilisateur = req.utilisateur!;
  if (utilisateur.employeId === employeId) return;

  const filiales = filialesAutoriseesPour(utilisateur);
  if (filiales === null) return;

  const { rows } = await pool.query('SELECT filiale_id FROM employes WHERE id = $1', [employeId]);
  if (!rows[0] || !filiales.includes(rows[0].filiale_id)) {
    throw new ErreurApplicative(403, 'Accès refusé à la paie de cet employé');
  }
}

export async function lister(req: Request, res: Response) {
  const employeId = req.query.employeId as string;
  if (!employeId) {
    throw new ErreurApplicative(400, 'Le paramètre employeId est requis');
  }
  await verifierAccesEmploye(req, employeId);
  res.json(await listerBulletinsEmploye(employeId));
}

export async function simuler(req: Request, res: Response) {
  const donnees = schemaSimulation.parse(req.body);
  res.json(await simulerNetVersBrut(donnees));
}

export async function changerStatut(req: Request, res: Response) {
  const { statut } = schemaStatut.parse(req.body);
  res.json(await changerStatutBulletin(req.params.id, statut));
}

export async function fiche(req: Request, res: Response) {
  const { rows } = await pool.query('SELECT employe_id FROM bulletins_paie WHERE id = $1', [req.params.id]);
  if (!rows[0]) {
    throw new ErreurApplicative(404, 'Bulletin introuvable');
  }
  await verifierAccesEmploye(req, rows[0].employe_id);

  const pdf = await genererBulletinPdf(req.params.id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="bulletin-${req.params.id}.pdf"`);
  res.send(pdf);
}

// ============================================================================
// Routes
// ============================================================================

export const routesPaie = Router();

routesPaie.use(authentification);

const gestionnairesPaie = autoriserRoles('super_admin', 'drh_holding', 'rh_filiale');

routesPaie.get('/bulletins', asyncHandler(lister));
routesPaie.get('/bulletins/:id/fiche', asyncHandler(fiche));
routesPaie.post('/bulletins/calculer', gestionnairesPaie, asyncHandler(calculer));
routesPaie.post('/bulletins/calculer-masse', gestionnairesPaie, asyncHandler(calculerMasse));
routesPaie.post('/simuler-net-vers-brut', gestionnairesPaie, asyncHandler(simuler));
routesPaie.post('/bulletins/:id/statut', autoriserRoles('super_admin', 'drh_holding'), asyncHandler(changerStatut));
