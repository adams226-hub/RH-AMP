import PDFDocument from 'pdfkit';
import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { obtenirLogoFiliale } from '../postes/postes.service';

interface DonneesBulletinPdf {
  matricule: string;
  employeNom: string;
  employePrenoms: string;
  fonctionIntitule: string | null;
  filialeNom: string;
  filialeAdresse: string | null;
  filialeRccm: string | null;
  filialeIfu: string | null;
  filialeTelephone: string | null;
  filialeSiteWeb: string | null;
  filialeLogoUrl: string | null;
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
  primeSalissure: number;
  primeLait: number;
  autresIndemnites: number;
  ancienneteAnnees: number;
  primeAnciennete: number;
  heuresSupplementaires: number;
  hs15: number;
  hs35: number;
  hs50: number;
  hs60: number;
  hs120: number;
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

  cumulConges: number;
  congesPris: number;
  soldeConges: number;
}

// fonction_intitule vient directement de bulletins_paie (snapshot pris au calcul, cf. commentaire
// de la colonne) — plus de JOIN vers fonctions ici : un renommage/archivage ultérieur de la
// fonction ne doit jamais changer un bulletin déjà généré, même téléchargé à nouveau plus tard.
// Congés : année de référence = année de la période du bulletin (cf. décision produit, pas de
// report d'historique antérieur à 2026) — LEFT JOIN, 0/0/0 si aucun solde initialisé cette année.
async function chargerDonneesBulletin(id: string): Promise<DonneesBulletinPdf> {
  const { rows } = await pool.query(
    `SELECT b.*, e.matricule, e.nom AS employe_nom, e.prenoms AS employe_prenoms, e.banque, e.rib,
            e.mode_paiement, f.nom AS filiale_nom, f.adresse AS filiale_adresse, f.rccm AS filiale_rccm,
            f.ifu AS filiale_ifu, f.telephone AS filiale_telephone, f.site_web AS filiale_site_web,
            f.logo_url AS filiale_logo_url,
            COALESCE(sc.solde_initial, 0) + COALESCE(sc.jours_acquis, 0) AS cumul_conges,
            COALESCE(sc.jours_consommes, 0) AS conges_pris,
            COALESCE(sc.solde_disponible, 0) AS solde_conges
     FROM bulletins_paie b
     JOIN employes e ON e.id = b.employe_id
     JOIN filiales f ON f.id = e.filiale_id
     LEFT JOIN soldes_conges sc ON sc.employe_id = b.employe_id AND sc.annee = EXTRACT(YEAR FROM b.periode)
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
    filialeAdresse: l.filiale_adresse,
    filialeRccm: l.filiale_rccm,
    filialeIfu: l.filiale_ifu,
    filialeTelephone: l.filiale_telephone,
    filialeSiteWeb: l.filiale_site_web,
    filialeLogoUrl: l.filiale_logo_url,
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
    primeSalissure: Number(l.prime_salissure),
    primeLait: Number(l.prime_lait),
    autresIndemnites: Number(l.autres_indemnites),
    ancienneteAnnees: Number(l.anciennete_annees),
    primeAnciennete: Number(l.prime_anciennete),
    heuresSupplementaires: Number(l.heures_supplementaires),
    hs15: Number(l.hs_15),
    hs35: Number(l.hs_35),
    hs50: Number(l.hs_50),
    hs60: Number(l.hs_60),
    hs120: Number(l.hs_120),
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
    cumulConges: Number(l.cumul_conges),
    congesPris: Number(l.conges_pris),
    soldeConges: Number(l.solde_conges),
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
  return Math.round(valeur).toLocaleString('fr-FR').replace(/ /g, ' ');
}

interface LigneTableau {
  libelle: string;
  base?: number;
  taux?: string;
  retenue?: number;
  avoir?: number;
  gras?: boolean;
  indent?: boolean;
}

export async function genererBulletinPdf(id: string): Promise<Buffer> {
  const d = await chargerDonneesBulletin(id);
  const logo = await obtenirLogoFiliale(d.filialeLogoUrl);

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const morceaux: Buffer[] = [];
  doc.on('data', (c) => morceaux.push(c));
  const fin = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(morceaux))));

  const xGauche = 40;
  const largeurTotale = 515;

  // Bandeau gris en haut de page — site web aligné à droite (modèle fourni : le site web est
  // séparé des autres coordonnées légales, qui restent en pied de page).
  doc.rect(0, 22, 595, 10).fillColor('#e2e2e2').fill();
  if (d.filialeSiteWeb) {
    doc.fillColor('#555').font('Helvetica').fontSize(6.5).text(d.filialeSiteWeb, xGauche, 25, { width: largeurTotale, align: 'right' });
  }
  doc.fillColor('#000');

  // En-tête société — logo de la filiale s'il a été déposé (Paramètres > Référentiels), sinon
  // repli sur le nom en texte seul (cf. décision produit, filiales sans logo pour l'instant).
  const xTexteEntete = logo ? xGauche + 55 : xGauche;
  if (logo) {
    try {
      doc.image(logo, xGauche, 40, { fit: [45, 45] });
    } catch {
      // Fichier corrompu/format non supporté par pdfkit (seuls JPEG/PNG sont acceptés) — le
      // bulletin doit quand même se générer, juste sans logo plutôt que planter la génération.
    }
  }
  doc.font('Helvetica-Bold').fontSize(15).text(d.filialeNom, xTexteEntete, 42);
  doc.font('Helvetica').fontSize(8).fillColor('#555').text('BTP - Génie-Civil - Équipements - Miniers - Import-Export', xTexteEntete, 60);
  doc.fillColor('#000');
  doc.font('Helvetica-Bold').fontSize(16).text('BULLETIN DE SALAIRE', xGauche, 86, { width: largeurTotale, align: 'center' });

  let y = 117;

  // Bloc identité (2 colonnes) — libellés tels que sur le modèle fourni (casse normale, pas
  // tout en majuscules).
  const xDroite = xGauche + 270;
  function champInfo(x: number, yy: number, label: string, valeur: string) {
    doc.font('Helvetica-Bold').fontSize(8.5).text(`${label} :`, x, yy, { continued: true });
    doc.font('Helvetica').text(` ${valeur}`);
  }

  champInfo(xGauche, y, 'Matricule', d.matricule);
  champInfo(xDroite, y, 'Entreprise', d.filialeNom);
  y += 15;
  champInfo(xGauche, y, 'Noms et prénoms', `${d.employeNom} ${d.employePrenoms}`);
  champInfo(xDroite, y, 'Banque', d.banque ?? '-');
  y += 15;
  champInfo(xGauche, y, 'Emploi', d.fonctionIntitule ?? '-');
  champInfo(xDroite, y, 'N° de compte', d.compte ?? '-');
  y += 15;
  champInfo(xGauche, y, 'Nombre de jours', String(d.joursPrisEnCompte));
  champInfo(xDroite, y, 'Mode de paiement', d.modePaiement ?? '-');
  y += 15;
  champInfo(xGauche, y, 'Charge sociale', String(d.personnesACharge));
  champInfo(xDroite, y, 'Période', formaterPeriode(d.periode));
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

  // Détail par taux des heures sup, toutes tranches affichées (même à 0, cf. modèle fourni —
  // formaterMontant affiche "-" pour une valeur nulle, comme les autres lignes).
  const tranchesHS: { taux: string; montant: number }[] = [
    { taux: '15%', montant: d.hs15 },
    { taux: '35%', montant: d.hs35 },
    { taux: '50%', montant: d.hs50 },
    { taux: '60%', montant: d.hs60 },
    { taux: '120%', montant: d.hs120 },
  ];

  // BASE = même valeur que AVOIRS pour chaque ligne de rémunération (fidèle au modèle fourni,
  // qui répète le montant dans les deux colonnes plutôt que de laisser BASE vide). Ordre des
  // lignes et présence de chaque ligne (même à 0, via formaterMontant) tels que sur le modèle.
  const ligneRemuneration = (libelle: string, montant: number, gras?: boolean): LigneTableau => ({
    libelle,
    base: montant,
    avoir: montant,
    gras,
  });

  const lignes: (LigneTableau | null)[] = [
    ligneRemuneration('Salaire de base', d.salaireBase),
    ligneRemuneration('Sursalaire', d.sursalaire),
    null,
    ligneRemuneration('Indemnité de logement', d.indemniteLogement),
    ligneRemuneration('Indemnité de transport', d.indemniteTransport),
    ligneRemuneration('Indemnité de fonction', d.indemniteFonction),
    ligneRemuneration('Indemnité de sujétion', d.indemniteSujetion),
    ligneRemuneration('Indemnité d’astreinte', d.indemniteAstreinte),
    ligneRemuneration('Prime de panier', d.primePanier),
    ligneRemuneration('Prime de salissure', d.primeSalissure),
    ligneRemuneration('Prime de lait', d.primeLait),
    ligneRemuneration('Prime d’ancienneté', d.primeAnciennete),
    ligneRemuneration('Autres indemnités', d.autresIndemnites),
    null,
    { libelle: 'Heures supplémentaires', avoir: d.heuresSupplementaires, gras: true },
    ...tranchesHS.map((t) => ({ libelle: `HS ${t.taux}`, taux: t.taux, avoir: t.montant, indent: true })),
    { libelle: 'TOTAL HEURES SUPPLÉMENTAIRES', avoir: d.heuresSupplementaires, gras: true },
    null,
    { libelle: 'Avance et acompte', retenue: d.avanceAcompte },
    { libelle: 'Reversement trop perçu', retenue: d.reversementTropPercu },
    { libelle: 'Reliquat de salaire', avoir: d.reliquat },
    null,
    { libelle: 'Retenue CNSS', taux: '5,5 %', retenue: d.cnssSalariale },
    { libelle: 'IUTS net', retenue: d.iuts },
    { libelle: 'Retenue 1 %', taux: '1 %', retenue: d.fsp },
  ];

  for (const ligne of lignes) {
    if (ligne === null) {
      y += 6;
      continue;
    }
    doc.font(ligne.gras ? 'Helvetica-Bold' : ligne.indent ? 'Helvetica-Oblique' : 'Helvetica').fontSize(8.5);
    doc.fillColor('#000').text(ligne.libelle, colLibelle + (ligne.indent ? 12 : 4), y, { width: largeurLibelle - (ligne.indent ? 16 : 8) });
    if (ligne.base !== undefined) {
      doc.text(formaterMontant(ligne.base), colBase, y, { width: largeurBase, align: 'right' });
    }
    if (ligne.taux && !ligne.indent) {
      doc.text(ligne.taux, colTaux, y, { width: largeurTaux, align: 'right' });
    }
    if (ligne.retenue !== undefined) {
      doc.text(formaterMontant(ligne.retenue), colRetenues, y, { width: largeurRetenues, align: 'right' });
    }
    if (ligne.avoir !== undefined) {
      doc.text(formaterMontant(ligne.avoir), colAvoirs, y, { width: largeurAvoirs - 4, align: 'right' });
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
  y += 22;

  // Bloc congés — année de référence = année de la période du bulletin (cf. décision produit)
  const largeurTiers = largeurTotale / 3;
  doc.rect(xGauche, y, largeurTotale, 16).fillColor('#e2e2e2').fill();
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(7.5);
  doc.text('CUMUL CONGÉS', xGauche, y + 4, { width: largeurTiers, align: 'center' });
  doc.text('CONGÉS PRIS', xGauche + largeurTiers, y + 4, { width: largeurTiers, align: 'center' });
  doc.text('SOLDE', xGauche + 2 * largeurTiers, y + 4, { width: largeurTiers, align: 'center' });
  y += 16;
  doc.rect(xGauche, y, largeurTotale, 16).strokeColor('#000').stroke();
  doc.font('Helvetica').fontSize(9);
  doc.text(formaterMontant(d.cumulConges), xGauche, y + 3, { width: largeurTiers, align: 'center' });
  doc.text(formaterMontant(d.congesPris), xGauche + largeurTiers, y + 3, { width: largeurTiers, align: 'center' });
  doc.text(formaterMontant(d.soldeConges), xGauche + 2 * largeurTiers, y + 3, { width: largeurTiers, align: 'center' });
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

  y += 50;
  doc.font('Helvetica').fontSize(9).text("L'employeur", xGauche + largeurTotale - 150, y, { width: 150, align: 'center' });

  // Pied de page — coordonnées légales de la filiale (une par filiale, cf. décision produit).
  // Champs non renseignés simplement omis plutôt que d'afficher des tirets vides en cascade.
  const piedLignes = [
    d.filialeAdresse,
    d.filialeRccm ? `RCCM ${d.filialeRccm}` : null,
    d.filialeIfu ? `IFU N°${d.filialeIfu}` : null,
    d.filialeTelephone ? `Tél : ${d.filialeTelephone}` : null,
  ].filter(Boolean);

  doc.font('Helvetica').fontSize(7).fillColor('#999');
  if (piedLignes.length > 0) {
    doc.text(piedLignes.join(' – '), xGauche, 770, { width: largeurTotale, align: 'center' });
  }
  doc.text(`Bulletin généré automatiquement — ${d.matricule} — ${formaterPeriode(d.periode)}`, xGauche, 782, {
    width: largeurTotale,
    align: 'center',
  });

  doc.end();
  return fin;
}
