// Tests de non-régression du moteur de paie (SPEC_MOTEUR_PAIE_AMP.md) et du calcul
// inverse (ADDENDUM_CALCUL_INVERSE_PAIE_AMP.md §6), sur les 2 bulletins réels déjà
// vérifiés au franc CFA près en conversation (ZALE IDRISSA, ILI ADAMA).
import { describe, expect, test } from 'vitest';
import {
  calculerBrutDepuisNet,
  calculerBulletinPaie,
  Employe,
  ElementsVariables,
  TauxConfigurables,
} from './calculerBulletinPaie';

// dateEntree = dateReference : ancienneté forcée à 0, indépendamment de la date d'exécution
// du test — les deux employés réels avaient une ancienneté nulle au moment des bulletins.
const DATE_REFERENCE = new Date(2026, 6, 31);

// Valeurs historiquement codées en dur dans le moteur, désormais configurables (Paramètres >
// Paramètres de paie) — reprises ici telles quelles pour que ces tests de non-régression
// continuent de vérifier les mêmes bulletins réels au franc CFA près.
const TAUX_CONNUS: TauxConfigurables = {
  tauxFSP: 0.01,
  tauxAbattementCadre: 0.2,
  tauxAbattementNonCadre: 0.25,
};

const ELEMENTS_SANS_AJUSTEMENT: ElementsVariables = {
  joursPrisEnCompte: 30,
  heuresSupplementaires: { taux15: 0, taux35: 0, taux50: 0, taux60: 0, taux120: 0 },
  heuresSupplementairesForfaitaires: 0,
  autresIndemnites: 0,
  avancesAccordees: 0,
  retenuesAvancesDuMois: 0,
  reversementTropPercu: 0,
  reliquat: 0,
  panier: 0,
  dateReference: DATE_REFERENCE,
};

describe('calculerBulletinPaie — bulletins réels', () => {
  test('ZALE IDRISSA (matricule AMP1) — net à payer = 69 440 F CFA', () => {
    const employe: Employe = {
      salaireDeBase: 76992,
      indemniteLogement: 0,
      indemniteTransport: 0,
      indemniteSujetion: 0,
      indemniteAstreinte: 0,
      indemniteFonction: 0,
      sursalaire: 0,
      dateEntree: DATE_REFERENCE,
      categorie: 'NON_CADRE',
      declarationCnss: 'O',
      personnesACharge: 2,
    };

    const resultat = calculerBulletinPaie(employe, ELEMENTS_SANS_AJUSTEMENT, TAUX_CONNUS);

    expect(resultat.retenueCNSS).toBeCloseTo(4235, 0);
    expect(resultat.netAPayer).toBeCloseTo(69440, 0);
  });

  test('ILI ADAMA (matricule P0238) — net à payer = 217 323 F CFA', () => {
    const employe: Employe = {
      salaireDeBase: 76992,
      indemniteLogement: 35000,
      indemniteTransport: 20000,
      indemniteSujetion: 10000,
      indemniteAstreinte: 30000,
      indemniteFonction: 0,
      sursalaire: 54143,
      dateEntree: DATE_REFERENCE,
      categorie: 'NON_CADRE',
      declarationCnss: 'O',
      personnesACharge: 0,
    };

    const resultat = calculerBulletinPaie(employe, { ...ELEMENTS_SANS_AJUSTEMENT, panier: 23400 }, TAUX_CONNUS);

    expect(resultat.retenueCNSS).toBeCloseTo(12437, 0);
    expect(resultat.iutsNet).toBeCloseTo(17580, 0);
    expect(resultat.netAPayer).toBeCloseTo(217323, 0);
  });
});

describe('calculerBulletinPaie — heures sup au forfait (demande explicite)', () => {
  const employe: Employe = {
    salaireDeBase: 150000,
    indemniteLogement: 0,
    indemniteTransport: 0,
    indemniteSujetion: 0,
    indemniteAstreinte: 0,
    indemniteFonction: 0,
    sursalaire: 0,
    dateEntree: DATE_REFERENCE,
    categorie: 'CADRE',
    declarationCnss: 'O',
    personnesACharge: 0,
  };

  test('le forfait remplace le calcul horaire, il ne s’y ajoute jamais', () => {
    // Avec heures horaires seules (pas de forfait) : total = heures calculées depuis le pointage.
    const sansForfait = calculerBulletinPaie(
      employe,
      { ...ELEMENTS_SANS_AJUSTEMENT, heuresSupplementaires: { taux15: 10, taux35: 0, taux50: 0, taux60: 0, taux120: 0 } },
      TAUX_CONNUS
    );
    expect(sansForfait.totalHeuresSupplementaires).toBeGreaterThan(0);

    // Avec forfait ET heures horaires saisies en même temps : le forfait doit l'emporter seul,
    // pas s'additionner aux heures horaires.
    const avecForfaitEtHoraire = calculerBulletinPaie(
      employe,
      {
        ...ELEMENTS_SANS_AJUSTEMENT,
        heuresSupplementaires: { taux15: 10, taux35: 0, taux50: 0, taux60: 0, taux120: 0 },
        heuresSupplementairesForfaitaires: 50000,
      },
      TAUX_CONNUS
    );
    expect(avecForfaitEtHoraire.totalHeuresSupplementaires).toBe(50000);
    expect(avecForfaitEtHoraire.heuresSupplementaires).toEqual([]);
    expect(avecForfaitEtHoraire.remunerationTotale).toBe(sansForfait.remunerationTotale - sansForfait.totalHeuresSupplementaires + 50000);
  });

  test('sans forfait (0), le calcul horaire reste inchangé', () => {
    const resultat = calculerBulletinPaie(
      employe,
      { ...ELEMENTS_SANS_AJUSTEMENT, heuresSupplementaires: { taux15: 10, taux35: 0, taux50: 0, taux60: 0, taux120: 0 } },
      TAUX_CONNUS
    );
    expect(resultat.heuresSupplementaires.length).toBeGreaterThan(0);
  });
});

// Le simulateur vise le SALAIRE NET (avant FSP 1%), pas le net à payer — cf. calculerBrutDepuisNet.
// Les cibles sont donc les salaires nets des bulletins réels ci-dessus, recalculés par le moteur
// direct : le net à payer réel (69 440 / 217 323) doit alors être retrouvé lui aussi.
describe('calculerBrutDepuisNet — calcul inverse (ADDENDUM §6)', () => {
  test('retrouve le salaire de base de ZALE IDRISSA à partir de son salaire net', () => {
    const employeSansBase: Employe = {
      salaireDeBase: 0,
      indemniteLogement: 0,
      indemniteTransport: 0,
      indemniteSujetion: 0,
      indemniteAstreinte: 0,
      indemniteFonction: 0,
      sursalaire: 0,
      dateEntree: DATE_REFERENCE,
      categorie: 'NON_CADRE',
      declarationCnss: 'O',
      personnesACharge: 2,
    };
    const netCible = calculerBulletinPaie({ ...employeSansBase, salaireDeBase: 76992 }, ELEMENTS_SANS_AJUSTEMENT, TAUX_CONNUS).salaireNet;

    const resultat = calculerBrutDepuisNet(netCible, employeSansBase, ELEMENTS_SANS_AJUSTEMENT, TAUX_CONNUS, 'salaireDeBase');

    expect(resultat.convergence).toBe(true);
    expect(resultat.bulletin.salaireNet).toBe(netCible);
    expect(resultat.bulletin.netAPayer).toBeCloseTo(69440, 0);
    expect(Number.isInteger(resultat.valeurTrouvee)).toBe(true);
    // Le moteur arrondit à plusieurs étapes en cascade (prime ancienneté, abattement,
    // IUTS...) : plusieurs salaires de base voisins produisent le même net arrondi au
    // franc, et l'IUTS calculé par tranches de 100 F fait même redescendre le net par
    // endroits (ILI ADAMA : 76 973 et 76 992 donnent le même net) — la recherche retient le
    // plus bas de ces montants, au plus égal à la valeur d'origine.
    expect(resultat.valeurTrouvee).toBeLessThanOrEqual(76992);
    expect(resultat.valeurTrouvee).toBeGreaterThan(76992 - 100);
  });

  test('retrouve le salaire de base de ILI ADAMA à partir de son salaire net', () => {
    const employeSansBase: Employe = {
      salaireDeBase: 0,
      indemniteLogement: 35000,
      indemniteTransport: 20000,
      indemniteSujetion: 10000,
      indemniteAstreinte: 30000,
      indemniteFonction: 0,
      sursalaire: 54143,
      dateEntree: DATE_REFERENCE,
      categorie: 'NON_CADRE',
      declarationCnss: 'O',
      personnesACharge: 0,
    };
    const elements = { ...ELEMENTS_SANS_AJUSTEMENT, panier: 23400 };
    const netCible = calculerBulletinPaie({ ...employeSansBase, salaireDeBase: 76992 }, elements, TAUX_CONNUS).salaireNet;

    const resultat = calculerBrutDepuisNet(netCible, employeSansBase, elements, TAUX_CONNUS, 'salaireDeBase');

    expect(resultat.convergence).toBe(true);
    expect(resultat.bulletin.salaireNet).toBe(netCible);
    expect(resultat.bulletin.netAPayer).toBeCloseTo(217323, 0);
    expect(Number.isInteger(resultat.valeurTrouvee)).toBe(true);
    expect(resultat.valeurTrouvee).toBeLessThanOrEqual(76992);
    expect(resultat.valeurTrouvee).toBeGreaterThan(76992 - 100);
  });

  // Cas remonté par la RH depuis le Simulateur : un net de 3 000 000 affichait 3 000 001.
  test('sursalaire pour un salaire net de 3 000 000 : jamais au-dessus de la cible', () => {
    const cadre: Employe = {
      salaireDeBase: 75000,
      indemniteLogement: 75000,
      indemniteTransport: 17500,
      indemniteSujetion: 64000,
      indemniteAstreinte: 75000,
      indemniteFonction: 75000,
      sursalaire: 0,
      dateEntree: DATE_REFERENCE,
      categorie: 'CADRE',
      declarationCnss: 'O',
      personnesACharge: 0,
    };

    const resultat = calculerBrutDepuisNet(3_000_000, cadre, ELEMENTS_SANS_AJUSTEMENT, TAUX_CONNUS, 'sursalaire');

    expect(Number.isInteger(resultat.valeurTrouvee)).toBe(true);
    expect(resultat.bulletin.salaireNet).toBeLessThanOrEqual(3_000_000);
    // Aucun sursalaire ne donne un net plus proche sans dépasser, et aucun plus bas ne donne le même net.
    for (let ecart = -300; ecart <= 300; ecart++) {
      const net = calculerBulletinPaie({ ...cadre, sursalaire: resultat.valeurTrouvee + ecart }, ELEMENTS_SANS_AJUSTEMENT, TAUX_CONNUS).salaireNet;
      if (net <= 3_000_000) expect(net).toBeLessThanOrEqual(resultat.bulletin.salaireNet);
      if (ecart < 0) expect(net).toBeLessThan(resultat.bulletin.salaireNet);
    }
  });
});
