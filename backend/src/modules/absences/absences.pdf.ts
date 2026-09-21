import PDFDocument from 'pdfkit';
import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { BAREME_PERMISSIONS_EXCEPTIONNELLES } from './absences.service';

interface DonneesFiche {
  employeNom: string;
  employePrenoms: string;
  filialeNom: string;
  departementNom: string | null;
  serviceNom: string | null;
  fonctionIntitule: string | null;
  type: string;
  motifBareme: string | null;
  motif: string;
  dateDebut: Date;
  dateFin: Date;
  nbJours: number;
  nbJoursBareme: number;
  nbJoursHorsBareme: number;
  statut: string;
  avisHierarchique: string | null;
  commentaireHierarchique: string | null;
  decisionRh: string | null;
  commentaireRh: string | null;
  classification: string | null;
  soldeCongeJoursConsommes: number | null;
  soldeCongeDisponible: number | null;
}

// departement_nom/service_nom/fonction_intitule viennent directement de demandes_absences
// (snapshot pris au dépôt) — plus de JOIN vers departements/services/fonctions ici : un
// renommage/archivage ultérieur ne doit jamais changer une fiche déjà déposée.
async function chargerDonneesFiche(id: string): Promise<DonneesFiche> {
  const { rows } = await pool.query(
    `SELECT d.*, e.nom AS employe_nom, e.prenoms AS employe_prenoms, f.nom AS filiale_nom
     FROM demandes_absences d
     JOIN employes e ON e.id = d.employe_id
     JOIN filiales f ON f.id = e.filiale_id
     WHERE d.id = $1`,
    [id]
  );

  const ligne = rows[0];
  if (!ligne) {
    throw new ErreurApplicative(404, 'Demande introuvable');
  }

  const annee = new Date(ligne.date_debut as Date).getFullYear();
  const { rows: soldeRows } = await pool.query(
    'SELECT jours_consommes, solde_disponible FROM soldes_conges WHERE employe_id = $1 AND annee = $2',
    [ligne.employe_id, annee]
  );

  return {
    employeNom: ligne.employe_nom,
    employePrenoms: ligne.employe_prenoms,
    filialeNom: ligne.filiale_nom,
    departementNom: ligne.departement_nom,
    serviceNom: ligne.service_nom,
    fonctionIntitule: ligne.fonction_intitule,
    type: ligne.type,
    motifBareme: ligne.motif_bareme,
    motif: ligne.motif,
    dateDebut: ligne.date_debut,
    dateFin: ligne.date_fin,
    nbJours: Number(ligne.nb_jours),
    nbJoursBareme: Number(ligne.nb_jours_bareme),
    nbJoursHorsBareme: Number(ligne.nb_jours_hors_bareme),
    statut: ligne.statut,
    avisHierarchique: ligne.avis_hierarchique,
    commentaireHierarchique: ligne.commentaire_hierarchique,
    decisionRh: ligne.decision_rh,
    commentaireRh: ligne.commentaire_rh,
    classification: ligne.classification,
    soldeCongeJoursConsommes: soldeRows[0] ? Number(soldeRows[0].jours_consommes) : null,
    soldeCongeDisponible: soldeRows[0] ? Number(soldeRows[0].solde_disponible) : null,
  };
}

function formaterDate(d: Date): string {
  return new Date(d).toLocaleDateString('fr-FR');
}

function libelleMotifBareme(cle: string | null): string | null {
  if (!cle) return null;
  if (cle === 'autre') return 'Autre';
  return BAREME_PERMISSIONS_EXCEPTIONNELLES.find((e) => e.cle === cle)?.libelle ?? cle;
}

// Label + valeur sur une seule ligne, sans faire avancer le curseur pdfkit (positionnement manuel).
function champLigne(doc: PDFKit.PDFDocument, x: number, y: number, label: string, valeur: string) {
  const texteLabel = `${label} :`;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000').text(texteLabel, x, y, { lineBreak: false });
  const largeurLabel = doc.widthOfString(texteLabel);
  doc.font('Helvetica').text(` ${valeur || ''}`, x + largeurLabel, y, { lineBreak: false });
}

// Case à cocher précédée de son libellé (ordre du formulaire officiel : libellé puis case).
function caseAvecLibelle(doc: PDFKit.PDFDocument, x: number, y: number, label: string, coche: boolean) {
  doc.font('Helvetica').fontSize(9.5).fillColor('#000').text(label, x, y, { lineBreak: false });
  const xCase = x + doc.widthOfString(label) + 6;
  doc.rect(xCase, y - 1, 9, 9).lineWidth(1).stroke();
  if (coche) {
    doc.moveTo(xCase + 1.5, y + 0.5).lineTo(xCase + 7.5, y + 6.5).stroke();
    doc.moveTo(xCase + 7.5, y + 0.5).lineTo(xCase + 1.5, y + 6.5).stroke();
  }
}

function enteteBoite(doc: PDFKit.PDFDocument, x: number, y: number, largeur: number, hauteur: number, titre: string) {
  doc.rect(x, y, largeur, hauteur).lineWidth(1).strokeColor('#000').stroke();
  doc.rect(x, y, largeur, 16).fillColor('#d9d9d9').fill();
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(9.5).text(titre, x, y + 3.5, { width: largeur, align: 'center' });
}

export async function genererFichePdf(id: string): Promise<Buffer> {
  const d = await chargerDonneesFiche(id);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const morceaux: Buffer[] = [];
  doc.on('data', (c) => morceaux.push(c));
  const fin = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(morceaux))));

  const xGauche = 50;
  const largeurTotale = 495;
  const xDroite = xGauche + largeurTotale;

  // Titre (case à droite pour la version, comme le formulaire officiel)
  const largeurVersion = 115;
  const xVersion = xDroite - largeurVersion;
  doc.rect(xGauche, 50, largeurTotale, 42).stroke();
  doc.moveTo(xVersion, 50).lineTo(xVersion, 92).stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .text("DEMANDE D'AUTORISATION D'ABSENCE", xGauche + 8, 62, { width: xVersion - xGauche - 16, align: 'center' });
  doc.font('Helvetica').fontSize(9).text('Version 001_07_2026', xVersion, 67, { width: largeurVersion, align: 'center' });

  let y = 110;

  champLigne(doc, xGauche, y, 'Nom et Prénoms', `${d.employeNom} ${d.employePrenoms}`);
  y += 22;

  champLigne(
    doc,
    xGauche,
    y,
    'Projet/Chantier/Direction/Service',
    [d.filialeNom, d.departementNom, d.serviceNom].filter(Boolean).join(' — ')
  );
  y += 22;

  champLigne(doc, xGauche, y, 'Fonction', d.fonctionIntitule ?? '');
  champLigne(doc, xGauche + 280, y, 'Section/Équipe', '');
  y += 26;

  champLigne(
    doc,
    xGauche,
    y,
    'Nombre de jours',
    `${d.nbJours} jour(s), à compter du ${formaterDate(d.dateDebut)} au ${formaterDate(d.dateFin)} inclus`
  );
  y += 22;

  doc.font('Helvetica-Bold').fontSize(10).text('Motif(s) de la demande :', xGauche, y);
  y += 15;
  const motifAffiche = [libelleMotifBareme(d.motifBareme), d.motif].filter(Boolean).join(' — ');
  doc.rect(xGauche, y, largeurTotale, 44).strokeColor('#999').stroke().strokeColor('#000');
  doc.font('Helvetica').fontSize(10).text(motifAffiche, xGauche + 6, y + 6, { width: largeurTotale - 12, height: 34 });
  y += 44;

  doc
    .font('Helvetica-Oblique')
    .fontSize(8)
    .fillColor('#555')
    .text('(Soyez explicite, clair et concis, au besoin bien vouloir fournir les pièces justificatives)', xGauche, y + 4, {
      width: largeurTotale,
    });
  doc.fillColor('#000');
  y += 20;

  doc.font('Helvetica').fontSize(9).text('Date : ______________________', xGauche, y, { lineBreak: false });
  doc.text('Signature :', xGauche + 350, y);
  y += 24;

  // ---- Avis du supérieur hiérarchique ----
  const hauteurAvis = 70;
  const largeurCol1 = 155;
  const largeurCol2 = 220;
  const xCol2 = xGauche + largeurCol1;
  const xCol3 = xCol2 + largeurCol2;

  enteteBoite(doc, xGauche, y, largeurTotale, hauteurAvis, 'Avis du supérieur hiérarchique');
  doc.moveTo(xCol2, y + 16).lineTo(xCol2, y + hauteurAvis).stroke();
  doc.moveTo(xCol3, y + 16).lineTo(xCol3, y + hauteurAvis).stroke();

  caseAvecLibelle(doc, xGauche + 8, y + 26, 'Avis favorable', d.avisHierarchique === 'favorable');
  caseAvecLibelle(doc, xGauche + 8, y + 44, 'Avis défavorable', d.avisHierarchique === 'defavorable');

  doc.font('Helvetica').fontSize(8.5).text('Observation :', xCol2 + 6, y + 22, { width: largeurCol2 - 12 });
  doc.text(d.commentaireHierarchique ?? '', xCol2 + 6, y + 34, { width: largeurCol2 - 12, height: 30 });

  doc.font('Helvetica').fontSize(8.5).text('Date : ____/____/______', xCol3 + 8, y + 26, { width: largeurTotale - (xCol3 - xGauche) - 16 });
  doc.text('Signature', xCol3 + 8, y + 42);

  y += hauteurAvis + 10;

  // ---- Réservé aux ressources humaines ----
  const hauteurRh = 85;
  enteteBoite(doc, xGauche, y, largeurTotale, hauteurRh, 'Réservé aux ressources humaines');
  doc.moveTo(xCol2, y + 16).lineTo(xCol2, y + hauteurRh).stroke();
  doc.moveTo(xCol3, y + 16).lineTo(xCol3, y + hauteurRh).stroke();

  // Si la demande mélange jours barème (toujours non déductibles) et jours hors barème,
  // une seule case ne suffit pas à représenter les deux — on l'explicite en toutes lettres
  // à la place des 3 cases plutôt que de cocher une case qui ne dirait qu'une partie du vrai.
  const repartitionMixte = d.nbJoursBareme > 0 && d.nbJoursHorsBareme > 0;

  if (repartitionMixte) {
    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text(`${d.nbJoursBareme} j non déductibles (barème)`, xGauche + 8, y + 26, { width: largeurCol1 - 16 });
    doc.text(
      `+ ${d.nbJoursHorsBareme} j ${d.classification === 'sans_solde' ? 'sans solde' : 'déductibles des congés'}`,
      xGauche + 8,
      y + 44,
      { width: largeurCol1 - 16 }
    );
  } else {
    caseAvecLibelle(doc, xGauche + 8, y + 26, 'Déductible des congés', d.classification === 'deductible_conge');
    caseAvecLibelle(doc, xGauche + 8, y + 44, 'Non déductible des congés¹', d.classification === 'non_deductible');
    caseAvecLibelle(doc, xGauche + 8, y + 62, 'Congés sans solde', d.classification === 'sans_solde');
  }

  doc.font('Helvetica').fontSize(8.5).text(
    `Total congés pris : ${d.soldeCongeJoursConsommes !== null ? d.soldeCongeJoursConsommes : '…………'} jours`,
    xCol2 + 6,
    y + 24,
    { width: largeurCol2 - 12 }
  );
  doc.text(
    `Solde restant des jours de congés : ${d.soldeCongeDisponible !== null ? d.soldeCongeDisponible : '…………'} jours`,
    xCol2 + 6,
    y + 46,
    { width: largeurCol2 - 12 }
  );

  doc.font('Helvetica').fontSize(8.5).text('Date : ____/____/______', xCol3 + 8, y + 32, { width: largeurTotale - (xCol3 - xGauche) - 16 });
  doc.text('Signature', xCol3 + 8, y + 48);

  y += hauteurRh + 10;

  // ---- NB barème ----
  doc.font('Helvetica-Bold').fontSize(8.5).text('NB : ne sont pas déductibles des congés les absences suivantes :', xGauche, y);
  y += 13;
  doc.font('Helvetica').fontSize(8.5);
  for (const evenement of BAREME_PERMISSIONS_EXCEPTIONNELLES) {
    doc.text(`-     ${evenement.libelle} : ${evenement.jours} jours`, xGauche + 6, y);
    y += 12;
  }
  y += 4;

  doc
    .font('Helvetica-Oblique')
    .fontSize(7.5)
    .fillColor('#555')
    .text('¹ En référence au Nota Bene ci-dessus mentionné', xGauche, y);
  y += 14;

  doc
    .font('Helvetica-Oblique')
    .fontSize(7.5)
    .text(
      "Fiche à remplir en accord avec le supérieur hiérarchique et à déposer au service ressources humaines. Toute demande d'autorisation d'absence doit être déposée au moins 72h avant le jour d'absence sauf cas de force majeure",
      xGauche,
      y,
      { width: largeurTotale, align: 'center' }
    );
  doc.fillColor('#000');

  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor('#aaa')
    .text(
      `Fiche générée automatiquement le ${new Date().toLocaleDateString('fr-FR')} — statut système : ${d.statut}`,
      xGauche,
      780,
      { align: 'center', width: largeurTotale }
    );

  doc.end();
  return fin;
}
