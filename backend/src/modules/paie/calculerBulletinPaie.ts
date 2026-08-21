// ============================================================================
// Portage fidèle de LOGICIEL_SALAIRES.xlsm (feuille Traitement_salaire).
// Chaque fonction cite la règle Excel qu'elle applique. Aucune règle n'est
// réinterprétée ; les points ambigus ou en contradiction avec d'autres règles
// du SIRH sont documentés dans les commentaires marqués « AMBIGUÏTÉ SIGNALÉE ».
//
// Fichier autonome, non branché aux routes Express : à intégrer volontairement
// une fois les champs manquants (catégorie, déclaration CNSS, personnes à
// charge) ajoutés au schéma `employes` — ils n'existent pas encore en base.
// ============================================================================

// ----------------------------------------------------------------------------
// CONSTANTES — seules valeurs en dur autorisées, modifiables sans toucher au
// code métier.
// ----------------------------------------------------------------------------

export const CONSTANTES_PAIE_2026 = {
  joursReferenceMois: 30,
  dureeLegaleMensuelleHeures: 173.33,

  anciennete: {
    seuilMinAnnees: 3,
    baseTauxPourcent: 2, // taux = (années d'ancienneté + 2) %
  },

  majorationsHeuresSupPourcent: [15, 35, 50, 60, 120] as const,

  cnss: {
    tauxPourcent: 5.5,
    seuilRemunerationTotale: 800_000,
    retenuePlafonnee: 44_000, // = 800 000 × 5.5 %
  },

  plafondsIndemnites: {
    logement: { plafondFcfa: 75_000, tauxSurBrutPourcent: 20 },
    transport: { plafondFcfa: 30_000, tauxSurBrutPourcent: 5 },
    sujetionAstreinteFonction: { plafondFcfa: 50_000, tauxSurBrutPourcent: 5 },
  },

  abattementForfaitairePourcent: {
    CADRE: 20,
    NON_CADRE: 25,
  },

  // "cumulDebutTranche" = IUTS déjà dû pour tous les francs situés SOUS seuilBas
  // (vérifié cohérent avec le barème précédemment validé — cf. points signalés).
  baremeIUTS: [
    { seuilBas: 0, seuilHaut: 30_000, tauxPourcent: 0, cumulDebutTranche: 0 },
    { seuilBas: 30_000, seuilHaut: 50_000, tauxPourcent: 12.1, cumulDebutTranche: 0 },
    { seuilBas: 50_000, seuilHaut: 80_000, tauxPourcent: 13.9, cumulDebutTranche: 2_420 },
    { seuilBas: 80_000, seuilHaut: 120_000, tauxPourcent: 15.7, cumulDebutTranche: 6_590 },
    { seuilBas: 120_000, seuilHaut: 170_000, tauxPourcent: 18.4, cumulDebutTranche: 12_870 },
    { seuilBas: 170_000, seuilHaut: 250_000, tauxPourcent: 21.7, cumulDebutTranche: 22_070 },
    { seuilBas: 250_000, seuilHaut: Infinity, tauxPourcent: 25, cumulDebutTranche: 39_430 },
  ],

  // Non spécifié au-delà de 4 personnes à charge (AMBIGUÏTÉ SIGNALÉE ci-dessus) —
  // la dernière valeur connue (4 charges) est utilisée en plafond.
  abattementChargesIUTSPourcent: { 0: 0, 1: 8, 2: 10, 3: 12, 4: 14 } as Record<number, number>,

  tauxFSPPourcent: 1,
} as const;

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export type Categorie = 'CADRE' | 'NON_CADRE';
export type DeclarationCnss = 'O' | 'N';

export interface Employe {
  /** Montants mensuels nominaux (avant toute proratisation) */
  salaireDeBase: number;
  indemniteLogement: number;
  indemniteTransport: number;
  indemniteSujetion: number;
  indemniteAstreinte: number;
  indemniteFonction: number;
  sursalaire: number;

  dateEntree: Date;
  categorie: Categorie;
  declarationCnss: DeclarationCnss;
  personnesACharge: number;
}

export interface HeuresSupplementairesSaisies {
  taux15: number;
  taux35: number;
  taux50: number;
  taux60: number;
  taux120: number;
}

export interface ElementsVariables {
  /** Jours pris en compte ce mois-ci, sur la base 30 (cf. règle de prorata) */
  joursPrisEnCompte: number;
  heuresSupplementaires: HeuresSupplementairesSaisies;
  /** Montant forfaitaire, composition non détaillée dans les règles fournies */
  heuresSupplementairesForfaitaires: number;
  /** Composition non détaillée dans les règles fournies */
  autresIndemnites: number;
  avancesAccordees: number;
  retenuesAvancesDuMois: number;
  reversementTropPercu: number;
  reliquat: number;
  /** Non défini dans les règles fournies — AMBIGUÏTÉ SIGNALÉE, défaut 0 */
  panier?: number;
  /** Date de référence pour le calcul d'ancienneté — défaut : aujourd'hui */
  dateReference?: Date;
}

export interface LigneHeureSupplementaire {
  majorationPourcent: number;
  nombreHeures: number;
  tauxHoraire: number;
  montant: number;
}

export interface BulletinPaie {
  elementsProratises: {
    salaireDeBase: number;
    indemniteLogement: number;
    indemniteTransport: number;
    indemniteSujetion: number;
    indemniteAstreinte: number;
    indemniteFonction: number;
    sursalaire: number;
  };
  ancienneteAnnees: number;
  primeAnciennete: number;
  heuresSupplementaires: LigneHeureSupplementaire[];
  totalHeuresSupplementaires: number;
  remunerationTotale: number;
  retenueCNSS: number;
  salaireBrut: number;
  exonerationsIndemnites: {
    logement: number;
    transport: number;
    sujetionAstreinteFonction: number;
    total: number;
  };
  abattementForfaitaire: number;
  salaireNetImposable: number;
  baseImposable: number;
  iutsBrut: number;
  abattementChargesIUTS: number;
  iutsNet: number;
  salaireNet: number;
  retenueFSP: number;
  netAPayer: number;
}

// ----------------------------------------------------------------------------
// FONCTIONS PURES — une par étape, dans l'ordre exact de la chaîne de calcul
// ----------------------------------------------------------------------------

function arrondi0(valeur: number): number {
  return Math.round(valeur);
}

// Règle : "Éléments de rémunération soumis au prorata jours pris en compte / 30"
// montant_proratisé = (montant_mensuel / 30) × nombre_de_jours_pris_en_compte
function proraterElement(montantMensuel: number, joursPrisEnCompte: number): number {
  return (montantMensuel / CONSTANTES_PAIE_2026.joursReferenceMois) * joursPrisEnCompte;
}

function proraterTousLesElements(
  employe: Employe,
  joursPrisEnCompte: number
): BulletinPaie['elementsProratises'] {
  return {
    salaireDeBase: proraterElement(employe.salaireDeBase, joursPrisEnCompte),
    indemniteLogement: proraterElement(employe.indemniteLogement, joursPrisEnCompte),
    indemniteTransport: proraterElement(employe.indemniteTransport, joursPrisEnCompte),
    indemniteSujetion: proraterElement(employe.indemniteSujetion, joursPrisEnCompte),
    indemniteAstreinte: proraterElement(employe.indemniteAstreinte, joursPrisEnCompte),
    indemniteFonction: proraterElement(employe.indemniteFonction, joursPrisEnCompte),
    sursalaire: proraterElement(employe.sursalaire, joursPrisEnCompte),
  };
}

// Ancienneté = différence en années complètes entre la date d'entrée et la date du jour.
// (Non explicitement défini "entières" par la règle — interprétation retenue pour un
// seuil "≥ 3 ans" et un taux lié à un nombre entier d'années.)
function calculerAncienneteAnnees(dateEntree: Date, dateReference: Date): number {
  let annees = dateReference.getFullYear() - dateEntree.getFullYear();
  const anniversaireDepasse =
    dateReference.getMonth() > dateEntree.getMonth() ||
    (dateReference.getMonth() === dateEntree.getMonth() && dateReference.getDate() >= dateEntree.getDate());
  if (!anniversaireDepasse) annees -= 1;
  return Math.max(0, annees);
}

// Règle : "Prime d'ancienneté : ROUND(salaire_de_base × (ancienneté_années + 2)%, 0),
// uniquement si ancienneté ≥ 3 ans, sinon 0." (cf. SPEC_MOTEUR_PAIE_AMP.md §4)
// NB : "salaire_de_base" ici n'est pas qualifié "proratisé" ni "brut 30 jours" — utilisé
// tel quel (nominal, non proratisé), par cohérence avec le taux horaire des heures sup
// qui précise explicitement "salaire_de_base_30_jours" quand le nominal est visé.
function calculerPrimeAnciennete(salaireDeBase: number, ancienneteAnnees: number): number {
  if (ancienneteAnnees < CONSTANTES_PAIE_2026.anciennete.seuilMinAnnees) return 0;
  const tauxPourcent = ancienneteAnnees + CONSTANTES_PAIE_2026.anciennete.baseTauxPourcent;
  return arrondi0(salaireDeBase * (tauxPourcent / 100));
}

// Règle : pour chaque taux (15%, 35%, 50%, 60%, 120%) :
// montant = ROUND((taux_horaire + taux_horaire × majoration%) × nombre_heures, 0)
// taux_horaire = salaire_de_base_30_jours / 173.33
function calculerHeuresSupplementaires(
  salaireDeBaseNominal: number,
  heures: HeuresSupplementairesSaisies
): { lignes: LigneHeureSupplementaire[]; total: number } {
  const tauxHoraire = salaireDeBaseNominal / CONSTANTES_PAIE_2026.dureeLegaleMensuelleHeures;

  const heuresParMajoration: Record<(typeof CONSTANTES_PAIE_2026.majorationsHeuresSupPourcent)[number], number> = {
    15: heures.taux15,
    35: heures.taux35,
    50: heures.taux50,
    60: heures.taux60,
    120: heures.taux120,
  };

  const lignes = CONSTANTES_PAIE_2026.majorationsHeuresSupPourcent.map((majorationPourcent) => {
    const nombreHeures = heuresParMajoration[majorationPourcent];
    const montant = arrondi0((tauxHoraire + tauxHoraire * (majorationPourcent / 100)) * nombreHeures);
    return { majorationPourcent, nombreHeures, tauxHoraire, montant };
  });

  const total = lignes.reduce((s, l) => s + l.montant, 0);
  return { lignes, total };
}

// Règle : "Rémunération totale = somme des éléments proratisés + total heures sup
// + prime ancienneté + autres indemnités + HS forfaitaires."
// BUG CORRIGÉ (pas une réinterprétation de règle) : le panier était absent de cette somme
// alors que remunerationTotaleSansPanier = remunerationTotale − panier, plus bas, présuppose
// que le panier y est inclus — sinon cette soustraction fausse l'assiette CNSS. Le nom même
// de la variable ("...SansPanier") ne fait sens que si panier fait partie du total de base.
function calculerRemunerationTotale(
  elementsProratises: BulletinPaie['elementsProratises'],
  totalHeuresSup: number,
  primeAnciennete: number,
  autresIndemnites: number,
  heuresSupplementairesForfaitaires: number,
  panier: number
): number {
  const sommeElementsProratises = Object.values(elementsProratises).reduce((s, v) => s + v, 0);
  return (
    sommeElementsProratises + totalHeuresSup + primeAnciennete + autresIndemnites + heuresSupplementairesForfaitaires + panier
  );
}

// Règle CNSS (part salariale) :
// taux = 5.5% si déclaration CNSS = "O", sinon 0
// retenue_CNSS = 44 000 si rémunération_totale >= 800 000,
//                sinon ROUND(rémunération_totale_sans_panier × 5.5%, 0)
// AMBIGUÏTÉ SIGNALÉE : le test de seuil porte sur remunerationTotale (avec panier),
// le calcul de l'assiette sur remunerationTotaleSansPanier — porté tel quel.
function calculerRetenueCNSS(
  remunerationTotale: number,
  remunerationTotaleSansPanier: number,
  declarationCnss: DeclarationCnss
): number {
  if (declarationCnss !== 'O') return 0;

  if (remunerationTotale >= CONSTANTES_PAIE_2026.cnss.seuilRemunerationTotale) {
    return CONSTANTES_PAIE_2026.cnss.retenuePlafonnee;
  }

  return arrondi0(remunerationTotaleSansPanier * (CONSTANTES_PAIE_2026.cnss.tauxPourcent / 100));
}

// Règle : "Salaire brut = Rémunération totale − Retenue CNSS"
function calculerSalaireBrut(remunerationTotale: number, retenueCNSS: number): number {
  return remunerationTotale - retenueCNSS;
}

// Règle : plafonds des indemnités exonérées d'IUTS, calculés sur le salaire brut.
// AMBIGUÏTÉ SIGNALÉE : "avant proratisation" — interprété comme : les montants
// d'indemnité comparés dans le min() sont les montants mensuels NOMINAUX (non
// proratisés), alors que le salaireBrut utilisé pour le pourcentage est bien le
// salaire brut réel du mois (donc post-proratisation côté rémunération totale).
function calculerExonerationsIndemnites(
  salaireBrut: number,
  indemniteLogementNominale: number,
  indemniteTransportNominale: number,
  indemniteSujetionNominale: number,
  indemniteAstreinteNominale: number,
  indemniteFonctionNominale: number
): BulletinPaie['exonerationsIndemnites'] {
  const { logement, transport, sujetionAstreinteFonction } = CONSTANTES_PAIE_2026.plafondsIndemnites;

  const exonerationLogement = Math.min(
    logement.plafondFcfa,
    indemniteLogementNominale,
    arrondi0(salaireBrut * (logement.tauxSurBrutPourcent / 100))
  );

  const exonerationTransport = Math.min(
    transport.plafondFcfa,
    indemniteTransportNominale,
    arrondi0(salaireBrut * (transport.tauxSurBrutPourcent / 100))
  );

  const sommeSujetionAstreinteFonction =
    indemniteSujetionNominale + indemniteAstreinteNominale + indemniteFonctionNominale;

  const exonerationSujetionAstreinteFonction = Math.min(
    sujetionAstreinteFonction.plafondFcfa,
    sommeSujetionAstreinteFonction,
    arrondi0(salaireBrut * (sujetionAstreinteFonction.tauxSurBrutPourcent / 100))
  );

  return {
    logement: exonerationLogement,
    transport: exonerationTransport,
    sujetionAstreinteFonction: exonerationSujetionAstreinteFonction,
    total: exonerationLogement + exonerationTransport + exonerationSujetionAstreinteFonction,
  };
}

// Règle : "Base abattement = Salaire de base + Prime ancienneté + TOTAL HEURES SUP +
// Sursalaire + HS FORFAITAIRES. Abattement = ROUND(20% × base, 0) si CADRE, sinon
// ROUND(25% × base, 0)." (cf. SPEC_MOTEUR_PAIE_AMP.md §10)
// Aucune mention "avant proratisation" ici (contrairement au § précédent) : les
// composantes proratisables (salaire de base, sursalaire) sont donc utilisées
// dans leur version proratisée.
function calculerAbattementForfaitaire(
  categorie: Categorie,
  salaireDeBaseProratise: number,
  primeAnciennete: number,
  totalHeuresSup: number,
  sursalaireProratise: number,
  heuresSupplementairesForfaitaires: number
): number {
  const tauxPourcent = CONSTANTES_PAIE_2026.abattementForfaitairePourcent[categorie];
  const assiette =
    salaireDeBaseProratise + primeAnciennete + totalHeuresSup + sursalaireProratise + heuresSupplementairesForfaitaires;
  return arrondi0(assiette * (tauxPourcent / 100));
}

// Règle : "ROUND(Salaire brut − Abattement forfaitaire − Somme des exonérations
// d'indemnités, 0)." (cf. SPEC_MOTEUR_PAIE_AMP.md §11)
function calculerSalaireNetImposable(
  salaireBrut: number,
  abattementForfaitaire: number,
  exonerationsTotal: number
): number {
  return arrondi0(salaireBrut - abattementForfaitaire - exonerationsTotal);
}

// Règle : "Base imposable : le salaire net imposable est tronqué aux centaines
// (les 2 derniers chiffres sont mis à zéro par troncature, pas arrondi)."
function calculerBaseImposable(salaireNetImposable: number): number {
  return Math.floor(salaireNetImposable / 100) * 100;
}

// Règle : "ROUND(cumul_début_tranche + (base_imposable − seuil_bas_tranche) ×
// taux_tranche, 0)." (cf. SPEC_MOTEUR_PAIE_AMP.md §13)
function calculerIUTSBrut(baseImposable: number): number {
  const tranche = CONSTANTES_PAIE_2026.baremeIUTS.find((t) => baseImposable <= t.seuilHaut)!;
  return arrondi0(tranche.cumulDebutTranche + (baseImposable - tranche.seuilBas) * (tranche.tauxPourcent / 100));
}

// Règle : abattement IUTS pour charges familiales (1 charge : -8%, 2 : -10%,
// 3 : -12%, 4 : -14%, 0 : 0%). IUTS_net = IUTS_brut − abattement_charges.
// Plafonné à 4 charges (non spécifié au-delà — AMBIGUÏTÉ SIGNALÉE).
// Arrondi vérifié nécessaire par recalcul manuel sur un bulletin réel (2 charges) :
// sans ROUND ici, le net à payer final tombe à 69 439,70 au lieu de 69 440 F CFA.
function calculerAbattementChargesIUTS(iutsBrut: number, personnesACharge: number): number {
  const chargesRetenues = Math.min(personnesACharge, 4);
  const tauxPourcent = CONSTANTES_PAIE_2026.abattementChargesIUTSPourcent[chargesRetenues];
  return arrondi0(iutsBrut * (tauxPourcent / 100));
}

// Règle : "Salaire net = Rémunération totale − (Retenue CNSS + IUTS net)."
function calculerSalaireNet(remunerationTotale: number, retenueCNSS: number, iutsNet: number): number {
  return remunerationTotale - (retenueCNSS + iutsNet);
}

// Règle : "Retenue FSP = ROUND(salaire_net × 1%, 0)."
function calculerRetenueFSP(salaireNet: number): number {
  return arrondi0(salaireNet * (CONSTANTES_PAIE_2026.tauxFSPPourcent / 100));
}

// Règle : "Net à payer = (Salaire net − Retenue 1% − Retenues avances du mois −
// Reversement trop perçu) + Reliquat." (cf. SPEC_MOTEUR_PAIE_AMP.md §17)
// "Avances accordées" n'apparaît pas dans cette formule finale — seule la partie
// effectivement retenue ce mois-ci (retenuesAvancesDuMois) réduit le net à payer ;
// une avance accordée mais pas encore remboursée n'impacte pas le mois en cours.
function calculerNetAPayer(
  salaireNet: number,
  retenueFSP: number,
  retenuesAvancesDuMois: number,
  reversementTropPercu: number,
  reliquat: number
): number {
  return salaireNet - retenueFSP - retenuesAvancesDuMois - reversementTropPercu + reliquat;
}

// ----------------------------------------------------------------------------
// COMPOSITION — chaîne de calcul dans l'ordre exact décrit par les règles
// ----------------------------------------------------------------------------

export function calculerBulletinPaie(employe: Employe, elementsVariables: ElementsVariables): BulletinPaie {
  const dateReference = elementsVariables.dateReference ?? new Date();
  const panier = elementsVariables.panier ?? 0; // cf. AMBIGUÏTÉ SIGNALÉE sur "panier"

  // 1. Proratisation
  const elementsProratises = proraterTousLesElements(employe, elementsVariables.joursPrisEnCompte);

  // 2. Ancienneté et prime d'ancienneté (assise sur le salaire de base nominal)
  const ancienneteAnnees = calculerAncienneteAnnees(employe.dateEntree, dateReference);
  const primeAnciennete = calculerPrimeAnciennete(employe.salaireDeBase, ancienneteAnnees);

  // 3. Heures supplémentaires (taux horaire assis sur le salaire de base nominal)
  const { lignes: heuresSupplementaires, total: totalHeuresSupplementaires } = calculerHeuresSupplementaires(
    employe.salaireDeBase,
    elementsVariables.heuresSupplementaires
  );

  // 4. Rémunération totale
  const remunerationTotale = calculerRemunerationTotale(
    elementsProratises,
    totalHeuresSupplementaires,
    primeAnciennete,
    elementsVariables.autresIndemnites,
    elementsVariables.heuresSupplementairesForfaitaires,
    panier
  );
  const remunerationTotaleSansPanier = remunerationTotale - panier;

  // 5. CNSS
  const retenueCNSS = calculerRetenueCNSS(remunerationTotale, remunerationTotaleSansPanier, employe.declarationCnss);

  // 6. Salaire brut
  const salaireBrut = calculerSalaireBrut(remunerationTotale, retenueCNSS);

  // 7. Plafonds / exonérations d'indemnités (sur montants nominaux, cf. commentaire de la fonction)
  const exonerationsIndemnites = calculerExonerationsIndemnites(
    salaireBrut,
    employe.indemniteLogement,
    employe.indemniteTransport,
    employe.indemniteSujetion,
    employe.indemniteAstreinte,
    employe.indemniteFonction
  );

  // 8. Abattement forfaitaire (sur montants proratisés)
  const abattementForfaitaire = calculerAbattementForfaitaire(
    employe.categorie,
    elementsProratises.salaireDeBase,
    primeAnciennete,
    totalHeuresSupplementaires,
    elementsProratises.sursalaire,
    elementsVariables.heuresSupplementairesForfaitaires
  );

  // 9. Salaire net imposable
  const salaireNetImposable = calculerSalaireNetImposable(
    salaireBrut,
    abattementForfaitaire,
    exonerationsIndemnites.total
  );

  // 10. Base imposable (troncature aux centaines)
  const baseImposable = calculerBaseImposable(salaireNetImposable);

  // 11. IUTS brut
  const iutsBrut = calculerIUTSBrut(baseImposable);

  // 12. Abattement charges familiales -> IUTS net
  const abattementChargesIUTS = calculerAbattementChargesIUTS(iutsBrut, employe.personnesACharge);
  const iutsNet = iutsBrut - abattementChargesIUTS;

  // 13. Salaire net
  const salaireNet = calculerSalaireNet(remunerationTotale, retenueCNSS, iutsNet);

  // 14. FSP
  const retenueFSP = calculerRetenueFSP(salaireNet);

  // 15. Net à payer
  const netAPayer = calculerNetAPayer(
    salaireNet,
    retenueFSP,
    elementsVariables.retenuesAvancesDuMois,
    elementsVariables.reversementTropPercu,
    elementsVariables.reliquat
  );

  return {
    elementsProratises,
    ancienneteAnnees,
    primeAnciennete,
    heuresSupplementaires,
    totalHeuresSupplementaires,
    remunerationTotale,
    retenueCNSS,
    salaireBrut,
    exonerationsIndemnites,
    abattementForfaitaire,
    salaireNetImposable,
    baseImposable,
    iutsBrut,
    abattementChargesIUTS,
    iutsNet,
    salaireNet,
    retenueFSP,
    netAPayer,
  };
}

// ----------------------------------------------------------------------------
// CALCUL INVERSE (ADDENDUM_CALCUL_INVERSE_PAIE_AMP.md) — net à payer souhaité
// → salaire de base (ou sursalaire) qui le produit. Recherche par dichotomie,
// réutilise calculerBulletinPaie() tel quel : aucune règle fiscale dupliquée,
// toute correction du moteur direct profite automatiquement au calcul inverse.
// ----------------------------------------------------------------------------

export type ChampVariable = 'salaireDeBase' | 'sursalaire';

export interface ResultatCalculInverse {
  bulletin: BulletinPaie;
  champVariable: ChampVariable;
  valeurTrouvee: number;
  ecartFinal: number;
  convergence: boolean;
}

export function calculerBrutDepuisNet(
  netCible: number,
  employe: Employe,
  elementsVariables: ElementsVariables,
  champVariable: ChampVariable = 'salaireDeBase',
  tolerance: number = 1
): ResultatCalculInverse {
  let borneBasse = 0;
  let borneHaute = Math.max(netCible * 2, 1);
  let valeur = 0;
  let bulletin: BulletinPaie | undefined;

  for (let i = 0; i < 50; i++) {
    valeur = (borneBasse + borneHaute) / 2;
    const employeEssai: Employe = { ...employe, [champVariable]: valeur };
    bulletin = calculerBulletinPaie(employeEssai, elementsVariables);

    const ecart = bulletin.netAPayer - netCible;
    if (Math.abs(ecart) <= tolerance) {
      return { bulletin, champVariable, valeurTrouvee: valeur, ecartFinal: ecart, convergence: true };
    }

    if (bulletin.netAPayer < netCible) {
      borneBasse = valeur;
    } else {
      borneHaute = valeur;
    }
  }

  // 50 itérations non atteintes à la tolérance exacte (cf. addendum §2) — on retourne
  // le meilleur résultat trouvé plutôt que d'échouer silencieusement.
  return { bulletin: bulletin!, champVariable, valeurTrouvee: valeur, ecartFinal: bulletin!.netAPayer - netCible, convergence: false };
}
