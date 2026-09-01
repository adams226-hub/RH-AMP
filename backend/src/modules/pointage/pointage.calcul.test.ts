import { describe, expect, it } from 'vitest';
import { calculerPointageDepuisJours, JourPointageCalcul } from './pointage.calcul';

function jourTravaille(date: string, heures: number): JourPointageCalcul {
  return { date, heures, codeAbsence: null };
}

function jourAbsence(date: string, codeAbsence: JourPointageCalcul['codeAbsence']): JourPointageCalcul {
  return { date, heures: null, codeAbsence };
}

const AUCUN_FERIE = new Set<string>();

describe('calculerPointageDepuisJours', () => {
  it('40h/semaine en semaine ne génère aucune heure sup', () => {
    const jours = ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19'].map((d) => jourTravaille(d, 8));
    const r = calculerPointageDepuisJours(jours, AUCUN_FERIE);
    expect(r).toMatchObject({ heuresHs15: 0, heuresHs35: 0, heuresHs60: 0 });
  });

  it('excédent <= 8h part entièrement en 15%', () => {
    // lundi->samedi = 6 jours x 8h = 48h hors dimanche
    const jours = ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20'].map((d) =>
      jourTravaille(d, 8)
    );
    const r = calculerPointageDepuisJours(jours, AUCUN_FERIE);
    expect(r).toMatchObject({ heuresHs15: 8, heuresHs35: 0, heuresHs60: 0 });
  });

  it('excédent > 8h bascule le reste en 35%', () => {
    // lundi->samedi = 6 jours x 10h = 60h hors dimanche -> excédent 20h
    const jours = ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20'].map((d) =>
      jourTravaille(d, 10)
    );
    const r = calculerPointageDepuisJours(jours, AUCUN_FERIE);
    expect(r).toMatchObject({ heuresHs15: 8, heuresHs35: 12, heuresHs60: 0 });
  });

  it('heures du dimanche vont en 60% et ne comptent pas dans le plafond hebdo', () => {
    const jours = [
      ...['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19'].map((d) => jourTravaille(d, 8)),
      jourTravaille('2026-06-21', 6), // dimanche
    ];
    const r = calculerPointageDepuisJours(jours, AUCUN_FERIE);
    expect(r).toMatchObject({ heuresHs15: 0, heuresHs35: 0, heuresHs60: 6 });
  });

  it('heures un jour férié en semaine vont aussi en 60%', () => {
    const jours = [jourTravaille('2026-08-15', 8)]; // samedi, férié dans le calendrier
    const r = calculerPointageDepuisJours(jours, new Set(['2026-08-15']));
    expect(r).toMatchObject({ heuresHs15: 0, heuresHs35: 0, heuresHs60: 8 });
  });

  it('panier = 1 jour par jour pointé à 10h ou plus', () => {
    const jours = [jourTravaille('2026-06-15', 9), jourTravaille('2026-06-16', 10), jourTravaille('2026-06-17', 11)];
    const r = calculerPointageDepuisJours(jours, AUCUN_FERIE);
    expect(r.joursPanier).toBe(2);
  });

  it('compte les jours par type de code absence', () => {
    const jours = [
      jourAbsence('2026-06-15', 'absence_injustifiee'),
      jourAbsence('2026-06-16', 'absence_injustifiee'),
      jourAbsence('2026-06-17', 'repos_medical'),
      jourAbsence('2026-06-18', 'permission_non_payee'),
      jourAbsence('2026-06-19', 'permission_payee'),
      jourAbsence('2026-06-20', 'conge_annuel'),
      jourAbsence('2026-06-21', 'ferie'), // pas dans le récap imprimé, juste ignoré
    ];
    const r = calculerPointageDepuisJours(jours, AUCUN_FERIE);
    expect(r).toMatchObject({
      nbJoursAbsenceInjustifiee: 2,
      nbJoursReposMedical: 1,
      nbJoursPermissionNonPayee: 1,
      nbJoursPermissionPayee: 1,
      nbJoursCongeAnnuel: 1,
    });
  });

  it('reproduit les 4 semaines complètes de la fiche de référence (SANDWIDI Jonathan, juillet 2026)', () => {
    // Semaine 2 : 63h en semaine, pas de dimanche travaillé -> attendu HN 40 / H15 8 / H35 15 / H60 0
    const semaine2 = ['2026-06-22', '2026-06-23', '2026-06-24', '2026-06-25', '2026-06-26', '2026-06-27'].map((d, i) =>
      jourTravaille(d, [13, 11, 9, 9, 12, 9][i])
    ); // 63h, pas de dimanche
    let r = calculerPointageDepuisJours(semaine2, AUCUN_FERIE);
    expect(r).toMatchObject({ heuresHs15: 8, heuresHs35: 15, heuresHs60: 0 });

    // Semaine 3 : 53h en semaine + 14h un dimanche -> attendu H15 8 / H35 5 / H60 14
    const semaine3 = [
      ...['2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04'].map((d, i) =>
        jourTravaille(d, [9, 9, 10, 10, 9, 6][i])
      ), // 53h hors dimanche
      jourTravaille('2026-07-05', 14), // dimanche
    ];
    r = calculerPointageDepuisJours(semaine3, AUCUN_FERIE);
    expect(r).toMatchObject({ heuresHs15: 8, heuresHs35: 5, heuresHs60: 14 });

    // Semaine 4 : 64h en semaine + 4h un dimanche -> attendu H15 8 / H35 16 / H60 4
    const semaine4 = [
      ...['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10', '2026-07-11'].map((d, i) =>
        jourTravaille(d, [9, 11, 9, 9, 10, 16][i])
      ), // 64h hors dimanche
      jourTravaille('2026-07-12', 4), // dimanche
    ];
    r = calculerPointageDepuisJours(semaine4, AUCUN_FERIE);
    expect(r).toMatchObject({ heuresHs15: 8, heuresHs35: 16, heuresHs60: 4 });
  });
});
