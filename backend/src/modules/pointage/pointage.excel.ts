import ExcelJS from 'exceljs';
import { calculerPointageDepuisJours, JourPointageCalcul } from './pointage.calcul';
import { CODE_ABREGE, chargerDonneesFiche, construireSemaines, DonneesFiche } from './pointage.pdf';
import { listerFiches } from './pointage.service';
import { PointageMensuelAvecDetails } from './pointage.types';

// 6 blocs semaine fixes (comme le fichier source CARTE_POINTAGE) — les semaines au-delà de la
// période réelle restent vides plutôt que d'être omises, pour garder des colonnes alignées d'une
// ligne à l'autre.
const NB_SEMAINES = 6;
const ENTETES_JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

interface SemaineExport {
  jours: (number | string | null)[];
  nbJours: number;
  ht: number;
  hn: number;
  h15: number;
  h35: number;
  h60: number;
  panier: number;
}

interface LigneExport {
  fiche: PointageMensuelAvecDetails;
  donnees: DonneesFiche;
  semaines: SemaineExport[];
}

function formaterDateFr(iso: string): string {
  const [a, m, j] = iso.slice(0, 10).split('-');
  return `${j}/${m}/${a}`;
}

// Détail HT/HN/H15/H35/H60/Panier par semaine — jamais stocké tel quel en base (seuls les totaux
// du mois le sont, dans pointages_mensuels). Recalculé ici avec le même moteur déterministe
// (pointage.calcul.ts) que celui qui a produit ces totaux mensuels stockés, à partir du même
// détail journalier stocké (pointages_jours) — jamais une formule différente ou inventée pour
// l'export. Les totaux mensuels affichés dans l'onglet "fiche pointage horaire", eux, viennent
// directement des colonnes stockées de la fiche (LigneExport.fiche), pas de ce recalcul.
function calculerSemainesExport(donnees: DonneesFiche): SemaineExport[] {
  const semainesDates = construireSemaines(donnees.periodeDebut, donnees.periodeFin).slice(0, NB_SEMAINES);
  const joursParDate = new Map(donnees.jours.map((j) => [j.date.toISOString().slice(0, 10), j]));

  const resultat = semainesDates.map((semaine) => {
    const cellules: (number | string | null)[] = [];
    const joursCalcul: JourPointageCalcul[] = [];
    let nbJours = 0;
    let ht = 0;

    for (const jourDate of semaine) {
      const cle = jourDate.toISOString().slice(0, 10);
      const dansPeriode = cle >= donnees.periodeDebut && cle <= donnees.periodeFin;
      if (!dansPeriode) {
        cellules.push(null);
        continue;
      }

      const entree = joursParDate.get(cle);
      if (entree?.heures !== null && entree?.heures !== undefined) {
        cellules.push(entree.heures);
        joursCalcul.push({ date: cle, heures: entree.heures, codeAbsence: null });
        nbJours += 1;
        ht += entree.heures;
      } else if (entree?.codeAbsence) {
        cellules.push(CODE_ABREGE[entree.codeAbsence]);
        joursCalcul.push({ date: cle, heures: null, codeAbsence: entree.codeAbsence });
        nbJours += 1;
      } else {
        cellules.push(null);
      }
    }

    const totaux = calculerPointageDepuisJours(joursCalcul, donnees.joursFeries);
    return {
      jours: cellules,
      nbJours,
      ht,
      hn: totaux.heuresNormales,
      h15: totaux.heuresHs15,
      h35: totaux.heuresHs35,
      h60: totaux.heuresHs60,
      panier: totaux.joursPanier,
    };
  });

  while (resultat.length < NB_SEMAINES) {
    resultat.push({ jours: [null, null, null, null, null, null, null], nbJours: 0, ht: 0, hn: 0, h15: 0, h35: 0, h60: 0, panier: 0 });
  }

  return resultat;
}

function entetesSemaine(n: number): string[] {
  return [
    ...ENTETES_JOURS.map((j) => `${j} ${n}`),
    `Nombre de jours ${n}`,
    `Heures totales ${n}`,
    `Heures normales ${n}`,
    `Heures sup 15% ${n}`,
    `Heures sup 35% ${n}`,
    `Heures sup 60% ${n}`,
    `Panier ${n}`,
  ];
}

function ecrireDecorticage(feuille: ExcelJS.Worksheet, lignes: LigneExport[]) {
  const colonnesFixes = ['Matricule', 'Nom', 'Prénom', 'Fonction', 'Catégorie', 'Section', 'Statut', 'Date début'];
  const entetes: string[] = [...colonnesFixes];
  for (let s = 1; s <= NB_SEMAINES; s++) entetes.push(...entetesSemaine(s));

  feuille.columns = entetes.map((h, i) => ({ header: h, width: i < colonnesFixes.length ? 14 : 6 }));
  feuille.getRow(1).font = { bold: true };
  feuille.views = [{ state: 'frozen', xSplit: colonnesFixes.length, ySplit: 1 }];

  for (const { donnees: d, semaines } of lignes) {
    const valeurs: (string | number | null)[] = [
      d.matricule,
      d.nom,
      d.prenoms,
      d.fonctionIntitule ?? '',
      d.categorieProfessionnelle ?? '',
      d.chantierNom,
      d.statutEmploye,
      d.dateDebutContrat ? formaterDateFr(d.dateDebutContrat) : '',
    ];
    for (const s of semaines) {
      valeurs.push(...s.jours, s.nbJours || null, s.ht || null, s.hn || null, s.h15 || null, s.h35 || null, s.h60 || null, s.panier || null);
    }
    feuille.addRow(valeurs);
  }
}

// Une fiche par employé, empilées verticalement — reprend le même gabarit que la fiche PDF
// imprimable (SPEC_MODULE_POINTAGE_AMP.md §5), adapté en tableau Excel.
function ecrireFicheHoraire(feuille: ExcelJS.Worksheet, lignes: LigneExport[]) {
  for (let i = 1; i <= 7; i++) feuille.getColumn(i).width = 11;
  for (let i = 8; i <= 13; i++) feuille.getColumn(i).width = 10;

  const entetesSemaineHoraire = [
    'Lundi',
    'Mardi',
    'Mercredi',
    'Jeudi',
    'Vendredi',
    'Samedi',
    'Dimanche',
    'Heures totales',
    'Heures normales',
    'Heures sup 15%',
    'Heures sup 35%',
    'Heures sup 60%',
    'Panier',
  ];

  let ligne = 1;
  for (const { fiche, donnees: d, semaines } of lignes) {
    const titre = feuille.getCell(ligne, 1);
    titre.value = 'FICHE DE POINTAGE HORAIRE';
    titre.font = { bold: true, size: 12 };
    ligne += 2;

    const infos: [string, string][] = [
      ['Matricule', d.matricule],
      ['Nom', d.nom],
      ['Prénom', d.prenoms],
      ['Emploi', d.fonctionIntitule ?? '-'],
      ['Catégorie', d.categorieProfessionnelle ?? '-'],
      ['Section', d.chantierNom],
      ['Statut', d.statutEmploye],
      ['Période', `du ${formaterDateFr(d.periodeDebut)} au ${formaterDateFr(d.periodeFin)}`],
    ];
    for (const [label, valeur] of infos) {
      feuille.getCell(ligne, 1).value = label;
      feuille.getCell(ligne, 1).font = { bold: true };
      feuille.getCell(ligne, 2).value = valeur;
      ligne += 1;
    }
    ligne += 1;

    entetesSemaineHoraire.forEach((h, i) => {
      const cell = feuille.getCell(ligne, i + 1);
      cell.value = h;
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E2E2' } };
    });
    ligne += 1;

    for (const s of semaines) {
      s.jours.forEach((valeur, i) => {
        feuille.getCell(ligne, i + 1).value = valeur ?? '';
      });
      feuille.getCell(ligne, 8).value = s.ht || '';
      feuille.getCell(ligne, 9).value = s.hn || '';
      feuille.getCell(ligne, 10).value = s.h15 || '';
      feuille.getCell(ligne, 11).value = s.h35 || '';
      feuille.getCell(ligne, 12).value = s.h60 || '';
      feuille.getCell(ligne, 13).value = s.panier || '';
      ligne += 1;
    }
    ligne += 1;

    // Récapitulatif — valeurs stockées de la fiche (pointages_mensuels), pas recalculées.
    const recap: [string, number][] = [
      ['Absence injustifiée (j)', fiche.nbJoursAbsenceInjustifiee],
      ['Repos médical (j)', fiche.nbJoursReposMedical],
      ['Permission non payée (j)', fiche.nbJoursPermissionNonPayee],
      ['Permission payée (j)', fiche.nbJoursPermissionPayee],
      ['Congé annuel (j)', fiche.nbJoursCongeAnnuel],
      ['HS 15% — mois (h)', fiche.heuresHs15],
      ['HS 35% — mois (h)', fiche.heuresHs35],
      ['HS 60% — mois (h)', fiche.heuresHs60],
      ['Jours panier — mois', fiche.joursPanier],
    ];
    for (const [label, valeur] of recap) {
      feuille.getCell(ligne, 1).value = label;
      feuille.getCell(ligne, 1).font = { bold: true };
      feuille.getCell(ligne, 2).value = valeur;
      ligne += 1;
    }

    ligne += 2;
  }
}

export interface FiltresExportPointage {
  chantiersAutorises: string[] | null;
  chantierId?: string;
  statut?: string;
  moisPaie: string;
}

export async function genererExportExcelPointage(filtres: FiltresExportPointage): Promise<ExcelJS.Buffer> {
  let chantiers = filtres.chantiersAutorises;
  if (filtres.chantierId) {
    // Le chantier demandé doit rester dans le périmètre de l'utilisateur — jamais faire confiance
    // au filtre écran seul pour la portée d'accès.
    chantiers = chantiers === null || chantiers.includes(filtres.chantierId) ? [filtres.chantierId] : [];
  }

  const fiches = await listerFiches(chantiers, filtres.statut, filtres.moisPaie);

  const lignes: LigneExport[] = await Promise.all(
    fiches.map(async (fiche) => {
      const donnees = await chargerDonneesFiche(fiche.id);
      return { fiche, donnees, semaines: calculerSemainesExport(donnees) };
    })
  );

  const classeur = new ExcelJS.Workbook();
  ecrireDecorticage(classeur.addWorksheet('decorticage'), lignes);
  ecrireFicheHoraire(classeur.addWorksheet('fiche pointage horaire'), lignes);

  return classeur.xlsx.writeBuffer();
}
