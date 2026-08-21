import PDFDocument from 'pdfkit';
import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { CodeAbsencePointage } from './pointage.types';

interface JourBrut {
  date: Date;
  heures: number | null;
  codeAbsence: CodeAbsencePointage | null;
}

interface DonneesFiche {
  matricule: string;
  nom: string;
  prenoms: string;
  fonctionIntitule: string | null;
  categorieProfessionnelle: string | null;
  chantierNom: string;
  statutEmploye: string;
  dateDebutContrat: string | null;
  periodeDebut: Date;
  periodeFin: Date;
  heuresHs15: number;
  heuresHs35: number;
  heuresHs60: number;
  joursPanier: number;
  nbJoursAbsenceInjustifiee: number;
  nbJoursReposMedical: number;
  nbJoursPermissionNonPayee: number;
  nbJoursPermissionPayee: number;
  nbJoursCongeAnnuel: number;
  jours: JourBrut[];
}

const CODE_ABREGE: Record<CodeAbsencePointage, string> = {
  absence_injustifiee: 'ABI',
  repos_medical: 'RM',
  permission_non_payee: 'PNP',
  permission_payee: 'PP',
  conge_annuel: 'CA',
  ferie: 'F',
};

async function chargerDonneesFiche(id: string): Promise<DonneesFiche> {
  const { rows } = await pool.query(
    `SELECT p.*, e.matricule, e.nom, e.prenoms, e.statut AS statut_employe, c.nom AS chantier_nom,
            fo.intitule AS fonction_intitule, e.categorie_professionnelle,
            (SELECT date_debut FROM contrats ct WHERE ct.employe_id = e.id AND ct.statut = 'actif'
             ORDER BY ct.date_debut DESC LIMIT 1) AS date_debut_contrat
     FROM pointages_mensuels p
     JOIN employes e ON e.id = p.employe_id
     JOIN chantiers c ON c.id = p.chantier_id
     LEFT JOIN contrats ct ON ct.employe_id = e.id AND ct.statut = 'actif'
     LEFT JOIN fonctions fo ON fo.id = ct.fonction_id
     WHERE p.id = $1
     LIMIT 1`,
    [id]
  );

  const l = rows[0];
  if (!l) {
    throw new ErreurApplicative(404, 'Fiche introuvable');
  }

  const { rows: joursRows } = await pool.query(
    'SELECT date, heures, code_absence FROM pointages_jours WHERE pointage_mensuel_id = $1 ORDER BY date',
    [id]
  );

  return {
    matricule: l.matricule,
    nom: l.nom,
    prenoms: l.prenoms,
    fonctionIntitule: l.fonction_intitule,
    categorieProfessionnelle: l.categorie_professionnelle,
    chantierNom: l.chantier_nom,
    statutEmploye: l.statut_employe,
    dateDebutContrat: l.date_debut_contrat,
    periodeDebut: l.periode_debut,
    periodeFin: l.periode_fin,
    heuresHs15: Number(l.heures_hs_15),
    heuresHs35: Number(l.heures_hs_35),
    heuresHs60: Number(l.heures_hs_60),
    joursPanier: Number(l.jours_panier),
    nbJoursAbsenceInjustifiee: Number(l.nb_jours_absence_injustifiee),
    nbJoursReposMedical: Number(l.nb_jours_repos_medical),
    nbJoursPermissionNonPayee: Number(l.nb_jours_permission_non_payee),
    nbJoursPermissionPayee: Number(l.nb_jours_permission_payee),
    nbJoursCongeAnnuel: Number(l.nb_jours_conge_annuel),
    jours: joursRows.map((j) => ({
      date: new Date(j.date as string),
      heures: j.heures !== null ? Number(j.heures) : null,
      codeAbsence: j.code_absence as CodeAbsencePointage | null,
    })),
  };
}

function formaterDateFr(d: Date | string): string {
  return new Date(d).toLocaleDateString('fr-FR');
}

// Reconstruit les semaines calendaires (lundi→dimanche) couvrant [debut, fin], même si ces
// bornes ne tombent pas sur un lundi/dimanche — cellules hors-période laissées vides.
function construireSemaines(debut: Date, fin: Date): Date[][] {
  const semaines: Date[][] = [];
  const curseur = new Date(debut);
  const jourSemaine = (curseur.getDay() + 6) % 7; // 0 = lundi
  curseur.setDate(curseur.getDate() - jourSemaine);

  while (curseur <= fin) {
    const semaine: Date[] = [];
    for (let i = 0; i < 7; i++) {
      semaine.push(new Date(curseur));
      curseur.setDate(curseur.getDate() + 1);
    }
    semaines.push(semaine);
  }

  return semaines;
}

export async function genererFichePointagePdf(id: string): Promise<Buffer> {
  const d = await chargerDonneesFiche(id);

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
  const morceaux: Buffer[] = [];
  doc.on('data', (c) => morceaux.push(c));
  const fin = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(morceaux))));

  const xGauche = 30;
  const largeurTotale = 782;

  doc.font('Helvetica-Bold').fontSize(15).text('FICHE DE POINTAGE', xGauche, 25, { width: largeurTotale, align: 'center', underline: true });

  let y = 55;
  function champ(x: number, label: string, valeur: string) {
    doc.font('Helvetica-Bold').fontSize(9).text(`${label} :`, x, y, { continued: true, lineBreak: false });
    doc.font('Helvetica').text(` ${valeur}`, { lineBreak: false });
  }

  champ(xGauche, 'PERIODE DU', formaterDateFr(d.periodeDebut));
  champ(xGauche + 350, 'Matricule', d.matricule);
  y += 13;
  champ(xGauche, 'AU', formaterDateFr(d.periodeFin));
  y += 13;
  champ(xGauche, 'PRENOM', d.prenoms);
  champ(xGauche + 350, 'NOM', d.nom);
  y += 13;
  champ(xGauche, 'EMPLOI', d.fonctionIntitule ?? '-');
  champ(xGauche + 350, 'CATEGORIE', d.categorieProfessionnelle ?? '-');
  y += 13;
  champ(xGauche, 'SECTION', d.chantierNom);
  champ(xGauche + 350, 'STATUT', d.statutEmploye);
  y += 13;
  champ(xGauche + 350, 'Date début', d.dateDebutContrat ? formaterDateFr(d.dateDebutContrat) : '-');
  y += 22;

  const semaines = construireSemaines(d.periodeDebut, d.periodeFin);
  const joursParDate = new Map(d.jours.map((j) => [j.date.toISOString().slice(0, 10), j]));

  const largeurJour = 78;
  const largeurTotHres = 45;
  const largeurAutre = 40;
  const colTotHres = xGauche + 7 * largeurJour;
  const colHresNor = colTotHres + largeurTotHres;
  const colHs15 = colHresNor + largeurAutre;
  const colHs35 = colHs15 + largeurAutre;
  const colHs60 = colHs35 + largeurAutre;
  const colPanier = colHs60 + largeurAutre;

  doc.rect(xGauche, y, largeurTotale, 16).fillColor('#e2e2e2').fill();
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(7.5);
  const joursLabels = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  joursLabels.forEach((lbl, i) => doc.text(lbl, xGauche + i * largeurJour + 3, y + 4, { width: largeurJour - 6 }));
  doc.text('total hres', colTotHres, y + 4, { width: largeurTotHres, align: 'center' });
  doc.text('hres nor.', colHresNor, y + 4, { width: largeurAutre, align: 'center' });
  doc.text('hres 15%', colHs15, y + 4, { width: largeurAutre, align: 'center' });
  doc.text('hres 35%', colHs35, y + 4, { width: largeurAutre, align: 'center' });
  doc.text('hres 60%', colHs60, y + 4, { width: largeurAutre, align: 'center' });
  doc.text('panier', colPanier, y + 4, { width: largeurAutre, align: 'center' });
  y += 16;

  const hauteurLigne = 24;
  let totalHresGeneral = 0;

  for (const semaine of semaines) {
    doc.rect(xGauche, y, largeurTotale, hauteurLigne).strokeColor('#999').stroke();
    let totalSemaine = 0;

    semaine.forEach((jourDate, i) => {
      const dansPeriode = jourDate >= d.periodeDebut && jourDate <= d.periodeFin;
      const x = xGauche + i * largeurJour;
      doc.moveTo(x, y).lineTo(x, y + hauteurLigne).strokeColor('#ccc').stroke();

      if (!dansPeriode) return;

      const cle = jourDate.toISOString().slice(0, 10);
      const entree = joursParDate.get(cle);
      doc.font('Helvetica').fontSize(6.5).fillColor('#888').text(String(jourDate.getDate()), x + 2, y + 2);

      if (entree?.heures !== null && entree?.heures !== undefined) {
        doc.font('Helvetica').fontSize(9).fillColor('#000').text(String(entree.heures), x, y + 10, { width: largeurJour, align: 'center' });
        totalSemaine += entree.heures;
      } else if (entree?.codeAbsence) {
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#a33').text(CODE_ABREGE[entree.codeAbsence], x, y + 10, { width: largeurJour, align: 'center' });
      }
    });

    doc.fillColor('#000').font('Helvetica-Bold').fontSize(9);
    doc.text(String(totalSemaine || ''), colTotHres, y + 8, { width: largeurTotHres, align: 'center' });
    totalHresGeneral += totalSemaine;
    y += hauteurLigne;
  }

  // hres nor./15/35/60/panier saisis en totaux mensuels (pas de règle de répartition
  // hebdomadaire confirmée) — affichés uniquement sur la ligne de total ci-dessous.
  doc.moveTo(xGauche, y).lineTo(xGauche + largeurTotale, y).strokeColor('#000').stroke();
  y += 4;
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('TOTAL', xGauche, y + 4, { width: 7 * largeurJour, align: 'right' });
  doc.text(String(totalHresGeneral), colTotHres, y + 4, { width: largeurTotHres, align: 'center' });
  doc.text(String(Math.min(totalHresGeneral, 160)), colHresNor, y + 4, { width: largeurAutre, align: 'center' });
  doc.text(String(d.heuresHs15), colHs15, y + 4, { width: largeurAutre, align: 'center' });
  doc.text(String(d.heuresHs35), colHs35, y + 4, { width: largeurAutre, align: 'center' });
  doc.text(String(d.heuresHs60), colHs60, y + 4, { width: largeurAutre, align: 'center' });
  doc.text(String(d.joursPanier), colPanier, y + 4, { width: largeurAutre, align: 'center' });
  y += 25;

  doc.font('Helvetica').fontSize(9);
  const recap: [string, number][] = [
    ['Absence injustifiée', d.nbJoursAbsenceInjustifiee],
    ['Repos Médical', d.nbJoursReposMedical],
    ['Permission non payée', d.nbJoursPermissionNonPayee],
    ['Permission payée', d.nbJoursPermissionPayee],
    ['Congé Annuel', d.nbJoursCongeAnnuel],
  ];
  for (const [libelle, valeur] of recap) {
    doc.text(`${libelle} : ${valeur} jour(s)`, xGauche + 200, y, { width: 250 });
    y += 13;
  }
  y += 15;

  const largeurSignature = largeurTotale / 3;
  ['Employé', 'Responsable', 'RH'].forEach((titre, i) => {
    const x = xGauche + i * largeurSignature;
    doc.rect(x, y, largeurSignature, 70).strokeColor('#000').stroke();
    doc.font('Helvetica-Bold').fontSize(9).text(titre, x, y + 4, { width: largeurSignature, align: 'center' });
  });

  doc.end();
  return fin;
}
