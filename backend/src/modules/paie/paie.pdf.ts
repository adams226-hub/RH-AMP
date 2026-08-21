import PDFDocument from 'pdfkit';
import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';

interface DonneesBulletinPdf {
  matricule: string;
  employeNom: string;
  employePrenoms: string;
  fonctionIntitule: string | null;
  filialeNom: string;
  banque: string | null;
  compte: string | null;
  modePaiement: string | null;
  periode: Date;
  joursPrisEnCompte: number;
  personnesACharge: number;

  salaireBase: number;
  sursalaire: number;
  indemniteLogement: number;
  indemniteTransport: number;
  indemniteFonction: number;
  indemniteSujetion: number;
  indemniteAstreinte: number;
  primePanier: number;
  autresIndemnites: number;
  ancienneteAnnees: number;
  primeAnciennete: number;
  heuresSupplementaires: number;
  reliquat: number;

  cnssSalariale: number;
  iuts: number;
  fsp: number;
  reversementTropPercu: number;
  avanceAcompte: number;
  autresRetenues: number;

  brut: number;
  salaireNetImposable: number;
  abattementForfaitaire: number;
  baseImposable: number;
  netAPayer: number;
}

// fonction_intitule vient directement de bulletins_paie (snapshot pris au calcul, cf. commentaire
// de la colonne) — plus de JOIN vers fonctions ici : un renommage/archivage ultérieur de la
// fonction ne doit jamais changer un bulletin déjà généré, même téléchargé à nouveau plus tard.
async function chargerDonneesBulletin(id: string): Promise<DonneesBulletinPdf> {
  const { rows } = await pool.query(
    `SELECT b.*, e.matricule, e.nom AS employe_nom, e.prenoms AS employe_prenoms, e.banque, e.rib,
            e.mode_paiement, f.nom AS filiale_nom
     FROM bulletins_paie b
     JOIN employes e ON e.id = b.employe_id
     JOIN filiales f ON f.id = e.filiale_id
     WHERE b.id = $1`,
    [id]
  );

  const l = rows[0];
  if (!l) {
    throw new ErreurApplicative(404, 'Bulletin introuvable');
  }

  return {
    matricule: l.matricule,
    employeNom: l.employe_nom,
    employePrenoms: l.employe_prenoms,
    fonctionIntitule: l.fonction_intitule,
    filialeNom: l.filiale_nom,
    banque: l.banque,
    compte: l.rib,
    modePaiement: l.mode_paiement,
    periode: l.periode,
    joursPrisEnCompte: Number(l.jours_pris_en_compte),
    personnesACharge: Number(l.personnes_a_charge),
    salaireBase: Number(l.salaire_base),
    sursalaire: Number(l.sursalaire),
    indemniteLogement: Number(l.indemnite_logement),
    indemniteTransport: Number(l.indemnite_transport),
    indemniteFonction: Number(l.indemnite_fonction),
    indemniteSujetion: Number(l.indemnite_sujetion),
    indemniteAstreinte: Number(l.indemnite_astreinte),
    primePanier: Number(l.prime_panier),
    autresIndemnites: Number(l.autres_indemnites),
    ancienneteAnnees: Number(l.anciennete_annees),
    primeAnciennete: Number(l.prime_anciennete),
    heuresSupplementaires: Number(l.heures_supplementaires),
    reliquat: Number(l.reliquat),
    cnssSalariale: Number(l.cnss_salariale),
    iuts: Number(l.iuts),
    fsp: Number(l.fsp),
    reversementTropPercu: Number(l.reversement_trop_percu),
    avanceAcompte: Number(l.avance_acompte),
    autresRetenues: Number(l.autres_retenues),
    brut: Number(l.brut),
    salaireNetImposable: Number(l.salaire_net_imposable),
    abattementForfaitaire: Number(l.abattement_forfaitaire),
    baseImposable: Number(l.base_imposable),
    netAPayer: Number(l.net_a_payer),
  };
}

const MOIS_FR = [
  'JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN',
  'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE',
];

function formaterPeriode(d: Date): string {
  const date = new Date(d);
  return `${MOIS_FR[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function formaterMontant(valeur: number): string {
  if (!valeur) return '-';
  return Math.round(valeur).toLocaleString('fr-FR').replace(/ /g, ' ');
}

interface LigneTableau {
  libelle: string;
  base?: number;
  taux?: string;
  retenue?: number;
  avoir?: number;
}

export async function genererBulletinPdf(id: string): Promise<Buffer> {
  const d = await chargerDonneesBulletin(id);

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const morceaux: Buffer[] = [];
  doc.on('data', (c) => morceaux.push(c));
  const fin = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(morceaux))));

  const xGauche = 40;
  const largeurTotale = 515;

  // En-tête société
  doc.font('Helvetica-Bold').fontSize(15).text(d.filialeNom, xGauche, 40);
  doc.font('Helvetica').fontSize(8).fillColor('#555').text('BTP - Génie-Civil - Équipements - Miniers - Import-Export', xGauche, 58);
  doc.fillColor('#000');
  doc.font('Helvetica-Bold').fontSize(16).text('BULLETIN DE SALAIRE', xGauche, 78, { width: largeurTotale, align: 'center' });

  let y = 115;

  // Bloc identité (2 colonnes)
  const xDroite = xGauche + 270;
  function champInfo(x: number, yy: number, label: string, valeur: string) {
    doc.font('Helvetica-Bold').fontSize(8.5).text(`${label} :`, x, yy, { continued: true });
    doc.font('Helvetica').text(` ${valeur}`);
  }

  champInfo(xGauche, y, 'MATRICULE', d.matricule);
  champInfo(xDroite, y, 'ENTREPRISE', d.filialeNom);
  y += 15;
  champInfo(xGauche, y, 'NOMS ET PRÉNOMS', `${d.employeNom} ${d.employePrenoms}`);
  champInfo(xDroite, y, 'BANQUE', d.banque ?? '-');
  y += 15;
  champInfo(xGauche, y, 'EMPLOIS', d.fonctionIntitule ?? '-');
  champInfo(xDroite, y, 'N° DE COMPTE', d.compte ?? '-');
  y += 15;
  champInfo(xGauche, y, 'NOMBRE DE JOURS', String(d.joursPrisEnCompte));
  champInfo(xDroite, y, 'MODE DE PAIEMENT', d.modePaiement ?? '-');
  y += 15;
  champInfo(xGauche, y, 'CHARGE SOCIALE', String(d.personnesACharge));
  champInfo(xDroite, y, 'PÉRIODE', formaterPeriode(d.periode));
  y += 25;

  // Tableau LIBELLÉ / BASE / TAUX / RETENUES / AVOIRS
  const colLibelle = xGauche;
  const largeurLibelle = 195;
  const colBase = colLibelle + largeurLibelle;
  const largeurBase = 80;
  const colTaux = colBase + largeurBase;
  const largeurTaux = 60;
  const colRetenues = colTaux + largeurTaux;
  const largeurRetenues = 90;
  const colAvoirs = colRetenues + largeurRetenues;
  const largeurAvoirs = 90;

  doc.rect(xGauche, y, largeurTotale, 18).fillColor('#e2e2e2').fill();
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(8.5);
  doc.text('LIBELLÉ', colLibelle + 4, y + 5);
  doc.text('BASE', colBase, y + 5, { width: largeurBase, align: 'right' });
  doc.text('TAUX', colTaux, y + 5, { width: largeurTaux, align: 'right' });
  doc.text('RETENUES', colRetenues, y + 5, { width: largeurRetenues, align: 'right' });
  doc.text('AVOIRS', colAvoirs, y + 5, { width: largeurAvoirs - 4, align: 'right' });
  y += 18;

  const lignes: (LigneTableau | null)[] = [
    { libelle: 'Salaire de base', avoir: d.salaireBase },
    { libelle: 'Sursalaire', avoir: d.sursalaire },
    null,
    { libelle: 'Indemnité de logement', avoir: d.indemniteLogement },
    { libelle: 'Indemnité de transport', avoir: d.indemniteTransport },
    { libelle: 'Indemnité de fonction', avoir: d.indemniteFonction },
    { libelle: 'Indemnité de sujétion', avoir: d.indemniteSujetion },
    { libelle: 'Indemnité d’astreinte', avoir: d.indemniteAstreinte },
    { libelle: 'Prime de panier', avoir: d.primePanier },
    { libelle: 'Autres indemnités', avoir: d.autresIndemnites },
    null,
    ...(d.primeAnciennete > 0
      ? [{ libelle: `Prime d’ancienneté (${d.ancienneteAnnees} an${d.ancienneteAnnees > 1 ? 's' : ''})`, avoir: d.primeAnciennete }]
      : []),
    { libelle: 'Heures supplémentaires', avoir: d.heuresSupplementaires },
    { libelle: 'Reliquat de salaire', avoir: d.reliquat },
    null,
    { libelle: 'Retenue CNSS', taux: '5,5 %', retenue: d.cnssSalariale },
    { libelle: 'IUTS net', retenue: d.iuts },
    { libelle: 'Retenue 1 %', taux: '1 %', retenue: d.fsp },
    { libelle: 'Reversement trop perçu', retenue: d.reversementTropPercu },
    { libelle: 'Avance et acompte', retenue: d.avanceAcompte },
  ];

  doc.font('Helvetica').fontSize(8.5);
  for (const ligne of lignes) {
    if (ligne === null) {
      y += 6;
      continue;
    }
    doc.fillColor('#000').text(ligne.libelle, colLibelle + 4, y, { width: largeurLibelle - 8 });
    if (ligne.avoir !== undefined) {
      doc.text(formaterMontant(ligne.avoir), colBase, y, { width: largeurBase, align: 'right' });
    }
    if (ligne.taux) {
      doc.text(ligne.taux, colTaux, y, { width: largeurTaux, align: 'right' });
    }
    if (ligne.retenue !== undefined) {
      doc.text(formaterMontant(ligne.retenue), colRetenues, y, { width: largeurRetenues, align: 'right' });
    }
    y += 13;
  }

  const totalRetenues = d.cnssSalariale + d.iuts + d.fsp + d.reversementTropPercu + d.avanceAcompte + d.autresRetenues;
  const totalAvoirs = d.brut + d.reliquat;

  y += 4;
  doc.moveTo(xGauche, y).lineTo(xGauche + largeurTotale, y).strokeColor('#000').stroke();
  y += 6;
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('TOTAL', colBase, y, { width: largeurBase, align: 'right' });
  doc.text(formaterMontant(totalRetenues), colRetenues, y, { width: largeurRetenues, align: 'right' });
  doc.text(formaterMontant(totalAvoirs), colAvoirs, y, { width: largeurAvoirs - 4, align: 'right' });
  y += 25;

  // Bloc récapitulatif fiscal — 4 cases sur une ligne (3 fiscales + net à payer), largeurs
  // calculées pour occuper exactement largeurTotale avec 3 espaces de 10 pt entre elles.
  const ecart = 10;
  const largeurCaseFiscale = 110;
  const hauteurCase = 34;
  function caseFiscale(x: number, label: string, valeur: number) {
    doc.rect(x, y, largeurCaseFiscale, hauteurCase).strokeColor('#000').stroke();
    doc.font('Helvetica-Bold').fontSize(7.5).text(label.toUpperCase(), x + 4, y + 4, { width: largeurCaseFiscale - 8 });
    doc.font('Helvetica').fontSize(10).text(formaterMontant(valeur), x + 4, y + 17, { width: largeurCaseFiscale - 8 });
  }

  caseFiscale(xGauche, 'Salaire net imposable', d.salaireNetImposable);
  caseFiscale(xGauche + largeurCaseFiscale + ecart, 'Abattement', d.abattementForfaitaire);
  caseFiscale(xGauche + 2 * (largeurCaseFiscale + ecart), 'Base imposable', d.baseImposable);

  const xNet = xGauche + 3 * (largeurCaseFiscale + ecart);
  const largeurNet = largeurTotale - 3 * (largeurCaseFiscale + ecart);
  doc.rect(xNet, y, largeurNet, hauteurCase).fillColor('#f0ceA0').fill().strokeColor('#000').stroke();
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(7.5).text('NET À PAYER', xNet + 6, y + 4, { width: largeurNet - 12 });
  doc.fontSize(11).text(`${formaterMontant(d.netAPayer)} F CFA`, xNet + 6, y + 17, { width: largeurNet - 12 });

  y += 55;
  doc.font('Helvetica').fontSize(9).text("L'employeur", xGauche + largeurTotale - 150, y, { width: 150, align: 'center' });

  doc.font('Helvetica').fontSize(7).fillColor('#999').text(
    `Bulletin généré automatiquement — ${d.matricule} — ${formaterPeriode(d.periode)}`,
    xGauche,
    780,
    { width: largeurTotale, align: 'center' }
  );

  doc.end();
  return fin;
}
