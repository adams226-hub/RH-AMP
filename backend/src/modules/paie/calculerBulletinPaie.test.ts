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

describe('calculerBrutDepuisNet — calcul inverse (ADDENDUM §6)', () => {
  test('retrouve le salaire de base de ZALE IDRISSA à partir du net 69 440', () => {
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

    const resultat = calculerBrutDepuisNet(69440, employeSansBase, ELEMENTS_SANS_AJUSTEMENT, TAUX_CONNUS, 'salaireDeBase', 0.1);

    expect(resultat.convergence).toBe(true);
    expect(resultat.bulletin.netAPayer).toBeCloseTo(69440, 0);
    // Le moteur arrondit à plusieurs étapes en cascade (prime ancienneté, abattement,
    // IUTS...) : plusieurs salaires de base voisins produisent le même net arrondi au
    // franc — la dichotomie retombe n'importe où dans cette plage de quelques francs,
    // pas nécessairement sur la valeur d'origine au F CFA près. Tolérance élargie en
    // conséquence (le net, lui, reste vérifié au F CFA près ci-dessus).
    expect(Math.abs(resultat.valeurTrouvee - 76992)).toBeLessThan(5);
  });

  test('retrouve le salaire de base de ILI ADAMA à partir du net 217 323', () => {
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

    const resultat = calculerBrutDepuisNet(
      217323,
      employeSansBase,
      { ...ELEMENTS_SANS_AJUSTEMENT, panier: 23400 },
      TAUX_CONNUS,
      'salaireDeBase',
      0.1
    );

    expect(resultat.convergence).toBe(true);
    expect(resultat.bulletin.netAPayer).toBeCloseTo(217323, 0);
    // cf. commentaire du test ZALE ci-dessus — plage de quelques francs inhérente aux
    // arrondis en cascade, pas une imprécision de la dichotomie elle-même.
    expect(Math.abs(resultat.valeurTrouvee - 76992)).toBeLessThan(5);
  });
});
