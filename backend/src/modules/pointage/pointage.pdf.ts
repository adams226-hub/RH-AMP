import PDFDocument from 'pdfkit';
import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { calculerPointageDepuisJours } from './pointage.calcul';
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
  periodeDebut: string;
  periodeFin: string;
  jours: JourBrut[];
  joursFeries: Set<string>;
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

  const { rows: feriesRows } = await pool.query(
    `SELECT jf.date FROM jours_feries jf
     JOIN chantiers c ON c.id = $1
     WHERE (jf.filiale_id IS NULL OR jf.filiale_id = c.filiale_id) AND jf.date BETWEEN $2 AND $3`,
    [l.chantier_id, l.periode_debut, l.periode_fin]
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
    jours: joursRows.map((j) => ({
      date: new Date(j.date as string),
      heures: j.heures !== null ? Number(j.heures) : null,
      codeAbsence: j.code_absence as CodeAbsencePointage | null,
    })),
    joursFeries: new Set(feriesRows.map((r) => r.date as string)),
  };
}

function formaterDateFr(d: Date | string): string {
  return new Date(d).toLocaleDateString('fr-FR');
}

// Reconstruit les semaines calendaires (lundi→dimanche) couvrant [debut, fin], même si ces
// bornes ne tombent pas sur un lundi/dimanche — cellules hors-période laissées vides. `debut`/`fin`
// sont des chaînes 'AAAA-MM-JJ' (colonnes DATE renvoyées en texte brut, cf. config/db.ts) — Date
// les parse correctement en argument de constructeur, mais ne jamais les comparer à un Date avec
// >=/<= ensuite (toujours false : Date coercée en nombre, chaîne non numérique).
function construireSemaines(debut: string, fin: string): Date[][] {
  const semaines: Date[][] = [];
  const curseur = new Date(debut);
  const bornefin = new Date(fin);
  const jourSemaine = (curseur.getDay() + 6) % 7; // 0 = lundi
  curseur.setDate(curseur.getDate() - jourSemaine);

  while (curseur <= bornefin) {
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
  const joursCalcul = d.jours.map((j) => ({
    date: j.date.toISOString().slice(0, 10),
    heures: j.heures,
    codeAbsence: j.codeAbsence,
  }));

  for (const semaine of semaines) {
    doc.rect(xGauche, y, largeurTotale, hauteurLigne).strokeColor('#999').stroke();
    let totalSemaine = 0;
    const joursSemaine: typeof joursCalcul = [];

    semaine.forEach((jourDate, i) => {
      const cle = jourDate.toISOString().slice(0, 10);
      const dansPeriode = cle >= d.periodeDebut && cle <= d.periodeFin;
      const x = xGauche + i * largeurJour;
      doc.moveTo(x, y).lineTo(x, y + hauteurLigne).strokeColor('#ccc').stroke();

      if (!dansPeriode) return;
      const entree = joursParDate.get(cle);
      doc.font('Helvetica').fontSize(6.5).fillColor('#888').text(String(jourDate.getDate()), x + 2, y + 2);

      if (entree?.heures !== null && entree?.heures !== undefined) {
        doc.font('Helvetica').fontSize(9).fillColor('#000').text(String(entree.heures), x, y + 10, { width: largeurJour, align: 'center' });
        totalSemaine += entree.heures;
        joursSemaine.push({ date: cle, heures: entree.heures, codeAbsence: null });
      } else if (entree?.codeAbsence) {
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#a33').text(CODE_ABREGE[entree.codeAbsence], x, y + 10, { width: largeurJour, align: 'center' });
        joursSemaine.push({ date: cle, heures: null, codeAbsence: entree.codeAbsence });
      }
    });

    const totauxSemaine = calculerPointageDepuisJours(joursSemaine, d.joursFeries);
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(9);
    doc.text(String(totalSemaine || ''), colTotHres, y + 8, { width: largeurTotHres, align: 'center' });
    doc.text(String(totauxSemaine.heuresNormales || ''), colHresNor, y + 8, { width: largeurAutre, align: 'center' });
    doc.text(String(totauxSemaine.heuresHs15 || ''), colHs15, y + 8, { width: largeurAutre, align: 'center' });
    doc.text(String(totauxSemaine.heuresHs35 || ''), colHs35, y + 8, { width: largeurAutre, align: 'center' });
    doc.text(String(totauxSemaine.heuresHs60 || ''), colHs60, y + 8, { width: largeurAutre, align: 'center' });
    doc.text(String(totauxSemaine.joursPanier || ''), colPanier, y + 8, { width: largeurAutre, align: 'center' });
    totalHresGeneral += totalSemaine;
    y += hauteurLigne;
  }

  const totalMensuel = calculerPointageDepuisJours(joursCalcul, d.joursFeries);

  // hres nor./15/35/60/panier recalculés depuis le détail journalier (règle HN=MIN(40)/semaine,
  // H15%=40e→48e heure, H35%=au-delà, H60%=dimanche/férié, panier=jour pointé à ≥10h).
  doc.moveTo(xGauche, y).lineTo(xGauche + largeurTotale, y).strokeColor('#000').stroke();
  y += 4;
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('TOTAL', xGauche, y + 4, { width: 7 * largeurJour, align: 'right' });
  doc.text(String(totalHresGeneral), colTotHres, y + 4, { width: largeurTotHres, align: 'center' });
  doc.text(String(totalMensuel.heuresNormales), colHresNor, y + 4, { width: largeurAutre, align: 'center' });
  doc.text(String(totalMensuel.heuresHs15), colHs15, y + 4, { width: largeurAutre, align: 'center' });
  doc.text(String(totalMensuel.heuresHs35), colHs35, y + 4, { width: largeurAutre, align: 'center' });
  doc.text(String(totalMensuel.heuresHs60), colHs60, y + 4, { width: largeurAutre, align: 'center' });
  doc.text(String(totalMensuel.joursPanier), colPanier, y + 4, { width: largeurAutre, align: 'center' });
  y += 25;

  doc.font('Helvetica').fontSize(9);
  const recap: [string, number][] = [
    ['Absence injustifiée', totalMensuel.nbJoursAbsenceInjustifiee],
    ['Repos Médical', totalMensuel.nbJoursReposMedical],
    ['Permission non payée', totalMensuel.nbJoursPermissionNonPayee],
    ['Permission payée', totalMensuel.nbJoursPermissionPayee],
    ['Congé Annuel', totalMensuel.nbJoursCongeAnnuel],
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
