import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { verifierCycleOuvertPourEmploye, verifierCycleOuvertPourFiliale } from '../cyclesPaie/verrouCycle';
import { calculerBrutDepuisNet, calculerBulletinPaie, Categorie } from './calculerBulletinPaie';
import {
  BulletinPaie,
  ElementsCalculBulletin,
  ResultatCalculMasse,
  ResultatSimulationNetVersBrut,
  SimulationNetVersBrut,
  StatutBulletin,
} from './paie.types';

const PLAFOND_CNSS = 800_000;

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
    `SELECT e.date_embauche, e.personnes_a_charge, fo.intitule AS fonction_intitule,
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
  };
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
    primePanier: Number(l.prime_panier),
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

export async function calculerEtEnregistrerBulletin(elements: ElementsCalculBulletin): Promise<BulletinPaie> {
  await verifierCycleOuvertPourEmploye(elements.employeId, elements.periode);

  const contrat = await obtenirContratActif(elements.employeId);
  const employe = await obtenirEmployePourPaie(elements.employeId);

  // Éléments saisis via l'écran "Éléments du mois" (prime/avance/panier/reliquat/absence/trop
  // perçu) — une seule ligne par (employé, mois, type) grâce à la contrainte d'unicité, donc
  // SUM = valeur saisie. Source unique, reprise en calcul individuel comme en calcul de masse.
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
         'heure_sup_15', 'heure_sup_35', 'heure_sup_50', 'heure_sup_60', 'heure_sup_120'
       )
     GROUP BY type`,
    [elements.employeId, elements.periode]
  );
  const parType = new Map(elementsMoisRows.map((l) => [l.type as string, l]));
  const montantDuType = (type: string) => Number(parType.get(type)?.total_montant ?? 0);
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
    }
  );

  // BUG CORRIGÉ (ADDENDUM_JOURNAL_PAIE_AMP.md §3) : la cotisation patronale plafonnait sur le
  // salaire de base nominal seul, alors que la formule réelle plafonne sur la rémunération
  // totale (= 16% × rémunération totale, plafonné à 800 000×16% = 128 000). Faux dès que les
  // indemnités/sursalaire dépassent le salaire de base, ce qui est quasi systématique.
  const tauxCnssPatronale = await obtenirParametre('taux_cnss_patronale');
  const tauxTpa = await obtenirParametre('taux_tpa');
  const coutEmployeur = Math.round(
    resultat.remunerationTotale +
      tauxCnssPatronale * Math.min(resultat.remunerationTotale, PLAFOND_CNSS) +
      tauxTpa * resultat.remunerationTotale
  );

  const { rows } = await pool.query(
    `INSERT INTO bulletins_paie (
       employe_id, periode, jours_pris_en_compte, personnes_a_charge, fonction_intitule,
       salaire_base, sursalaire, indemnite_logement, indemnite_transport, indemnite_fonction,
       indemnite_sujetion, indemnite_astreinte, anciennete_annees, prime_anciennete,
       heures_supplementaires, prime_panier, autres_indemnites, avance_acompte, reliquat,
       reversement_trop_percu, brut, exonerations_indemnites, abattement_forfaitaire,
       salaire_net_imposable, base_imposable, iuts, cnss_salariale, salaire_net, fsp,
       autres_retenues, net_a_payer, cout_employeur, statut
     ) VALUES (
       $1, date_trunc('month', $2::date), $3, $4, $5,
       $6, $7, $8, $9, $10,
       $11, $12, $13, $14,
       $15, $16, $17, $18, $19,
       $20, $21, $22, $23,
       $24, $25, $26, $27, $28, $29,
       0, $30, $31, 'calcule'
     )
     ON CONFLICT (employe_id, periode) DO UPDATE SET
       jours_pris_en_compte = EXCLUDED.jours_pris_en_compte, personnes_a_charge = EXCLUDED.personnes_a_charge,
       fonction_intitule = EXCLUDED.fonction_intitule,
       salaire_base = EXCLUDED.salaire_base, sursalaire = EXCLUDED.sursalaire,
       indemnite_logement = EXCLUDED.indemnite_logement, indemnite_transport = EXCLUDED.indemnite_transport,
       indemnite_fonction = EXCLUDED.indemnite_fonction, indemnite_sujetion = EXCLUDED.indemnite_sujetion,
       indemnite_astreinte = EXCLUDED.indemnite_astreinte, anciennete_annees = EXCLUDED.anciennete_annees,
       prime_anciennete = EXCLUDED.prime_anciennete, heures_supplementaires = EXCLUDED.heures_supplementaires,
       prime_panier = EXCLUDED.prime_panier, autres_indemnites = EXCLUDED.autres_indemnites,
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
      joursPrisEnCompte,
      employe.personnesACharge,
      employe.fonctionIntitule,
      resultat.elementsProratises.salaireDeBase,
      resultat.elementsProratises.sursalaire,
      resultat.elementsProratises.indemniteLogement,
      resultat.elementsProratises.indemniteTransport,
      resultat.elementsProratises.indemniteFonction,
      resultat.elementsProratises.indemniteSujetion,
      resultat.elementsProratises.indemniteAstreinte,
      resultat.ancienneteAnnees,
      resultat.primeAnciennete,
      resultat.totalHeuresSupplementaires,
      montantDuType('panier'),
      montantDuType('prime'),
      montantDuType('avance'),
      montantDuType('reliquat'),
      montantDuType('trop_percu'),
      resultat.remunerationTotale,
      resultat.exonerationsIndemnites.total,
      resultat.abattementForfaitaire,
      resultat.salaireNetImposable,
      resultat.baseImposable,
      resultat.iutsNet,
      resultat.retenueCNSS,
      resultat.salaireNet,
      resultat.retenueFSP,
      resultat.netAPayer,
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
    `SELECT e.id, e.nom, e.prenoms,
            EXISTS (SELECT 1 FROM contrats c WHERE c.employe_id = e.id AND c.statut = 'actif') AS a_contrat_actif
     FROM employes e
     WHERE e.statut = 'actif' AND e.filiale_id = $1
     ORDER BY e.nom, e.prenoms`,
    [filialeId]
  );

  const bulletinsCalcules: BulletinPaie[] = [];
  const echecs: ResultatCalculMasse['echecs'] = [];

  for (const ligne of rows) {
    if (!ligne.a_contrat_actif) {
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
      salaireDeBase: 0,
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
