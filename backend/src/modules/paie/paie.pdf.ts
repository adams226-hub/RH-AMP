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
  filialeSecteurActivite: string | null;
  filialeMentionsLegalesBulletin: string | null;
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
// report d'historique antérieur à 2026) — LEFT JOIN ; si aucun solde n'a encore été initialisé
// cette année, repli sur le cumul annuel standard (30 j, 0 pris) plutôt que sur une case vide.
// SOLDE = CUMUL CONGÉS − CONGÉS PRIS, recalculé ici (pas repris de soldes_conges.solde_disponible,
// qui inclut aussi les déductions du module Absences — non affichées séparément sur ce bulletin,
// donc l'identité visuelle CUMUL − PRIS = SOLDE doit rester exacte).
async function chargerDonneesBulletin(id: string): Promise<DonneesBulletinPdf> {
  const { rows } = await pool.query(
    `SELECT b.*, e.matricule, e.nom AS employe_nom, e.prenoms AS employe_prenoms, e.banque, e.rib,
            e.mode_paiement, f.nom AS filiale_nom, f.adresse AS filiale_adresse, f.rccm AS filiale_rccm,
            f.ifu AS filiale_ifu, f.telephone AS filiale_telephone, f.site_web AS filiale_site_web,
            f.secteur_activite AS filiale_secteur_activite,
            f.mentions_legales_bulletin AS filiale_mentions_legales_bulletin, f.logo_url AS filiale_logo_url,
            COALESCE(sc.solde_initial, 0) + COALESCE(sc.jours_acquis, 30) AS cumul_conges,
            COALESCE(sc.jours_consommes, 0) AS conges_pris
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
    filialeSecteurActivite: l.filiale_secteur_activite,
    filialeMentionsLegalesBulletin: l.filiale_mentions_legales_bulletin,
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
    soldeConges: Number(l.cumul_conges) - Number(l.conges_pris),
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

function formaterMontant(valeur: number, toujoursAfficher = false): string {
  if (!valeur && !toujoursAfficher) return '-';
  // toLocaleString('fr-FR') sépare les milliers par une espace fine insécable (U+202F) ou une
  // espace insécable (U+00A0) selon l'environnement — absentes de la police PDF (Helvetica/
  // WinAnsi), elles s'affichaient comme un caractère invalide (barre oblique). Remplacées ici par
  // une espace normale (U+0020), qui existe dans toutes les polices — regex par code point pour
  // ne pas dépendre du rendu visuel de caractères invisibles dans le fichier source.
  return Math.round(valeur).toLocaleString('fr-FR').replace(/[  ]/g, ' ');
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

  // Marge basse réduite : le contenu (tableau + blocs congés/fiscal + pied de page légal)
  // arrivait à quelques points de la limite basse par défaut (marge 40) et PDFKit basculait
  // alors le pied de page sur une 2e page dès qu'une filiale avait ses mentions légales
  // renseignées — le bulletin doit tenir sur une seule page A4.
  const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 8, left: 40, right: 40 } });
  const morceaux: Buffer[] = [];
  doc.on('data', (c) => morceaux.push(c));
  const fin = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(morceaux))));

  const xGauche = 40;
  const largeurTotale = 515;

  // Bandeau gris en haut de page — site web aligné à droite (modèle fourni : le site web est
  // séparé des autres coordonnées légales, qui restent en pied de page).
  doc.rect(0, 22, 595, 10).fillColor('#e2e2e2').fill();
  if (d.filialeSiteWeb) {
    doc.fillColor('#555').font('Helvetica').fontSize(7).text(d.filialeSiteWeb, xGauche, 25, { width: largeurTotale, align: 'right' });
  }
  doc.fillColor('#000');

  // En-tête société — logo de la filiale s'il a été déposé (Paramètres > Référentiels), sinon
  // repli sur le nom en texte seul (cf. décision produit, filiales sans logo pour l'instant).
  // Logo remonté (au lieu de pousser tout le reste vers le bas) pour laisser la place à un
  // format 100x100 sans faire déborder le bulletin sur une 2e page — seul le bandeau décoratif
  // gris est recouvert dans la zone du logo, sans conséquence (aucun texte n'y passe à cet endroit).
  const xTexteEntete = logo ? xGauche + 140 : xGauche;
  if (logo) {
    try {
      doc.image(logo, xGauche, 15, { fit: [130, 130] });
    } catch {
      // Fichier corrompu/format non supporté par pdfkit (seuls JPEG/PNG sont acceptés) — le
      // bulletin doit quand même se générer, juste sans logo plutôt que planter la génération.
    }
  }
  doc.font('Helvetica-Bold').fontSize(17).text(d.filialeNom, xTexteEntete, 50);
  // '' (chaîne vide, distincte de NULL) = demande explicite de ne rien afficher sous le nom de la
  // filiale ; NULL = repli sur le texte générique du groupe, tant que rien n'a été renseigné.
  const secteurActivite = d.filialeSecteurActivite ?? 'BTP - Génie-Civil - Équipements - Miniers - Import-Export';
  if (secteurActivite) {
    doc.font('Helvetica').fontSize(9).fillColor('#555').text(secteurActivite, xTexteEntete, 70);
  }
  doc.fillColor('#000');
  doc.font('Helvetica-Bold').fontSize(18).text('BULLETIN DE SALAIRE', xGauche, 86, { width: largeurTotale, align: 'center' });

  // Logo 110x110 : espace resserré sous "BULLETIN DE SALAIRE" (juste ce qu'il faut pour dégager
  // le logo) plutôt que la marge large laissée par l'ancien logo 150x150 — la place gagnée sert
  // à agrandir un peu l'écriture du corps du bulletin plus bas.
  let y = 150;

  // Bloc identité (2 colonnes) — libellés tels que sur le modèle fourni (casse normale, pas
  // tout en majuscules).
  const xDroite = xGauche + 270;
  function champInfo(x: number, yy: number, label: string, valeur: string) {
    doc.font('Helvetica-Bold').fontSize(10.5).text(`${label} :`, x, yy, { continued: true });
    doc.font('Helvetica').text(` ${valeur}`);
  }

  // Pas de champ "Entreprise" ici : le nom de la filiale figure déjà en toutes lettres dans
  // l'en-tête à côté du logo (cf. plus haut) — le répéter créait une redondance visuelle.
  champInfo(xGauche, y, 'Matricule', d.matricule);
  y += 14.5;
  champInfo(xGauche, y, 'Noms et prénoms', `${d.employeNom} ${d.employePrenoms}`);
  champInfo(xDroite, y, 'Banque', d.banque ?? '-');
  y += 14.5;
  champInfo(xGauche, y, 'Emploi', d.fonctionIntitule ?? '-');
  champInfo(xDroite, y, 'N° de compte', d.compte ?? '-');
  y += 14.5;
  champInfo(xGauche, y, 'Nombre de jours', String(d.joursPrisEnCompte));
  champInfo(xDroite, y, 'Mode de paiement', d.modePaiement ?? '-');
  y += 14.5;
  champInfo(xGauche, y, 'Charge sociale', String(d.personnesACharge));
  champInfo(xDroite, y, 'Période', formaterPeriode(d.periode));
  y += 14;

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

  const yTableauDebut = y;
  doc.rect(xGauche, y, largeurTotale, 20).fillColor('#e2e2e2').fill();
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(10);
  doc.text('LIBELLÉ', colLibelle + 4, y + 5);
  doc.text('BASE', colBase, y + 5, { width: largeurBase, align: 'right' });
  doc.text('TAUX', colTaux, y + 5, { width: largeurTaux, align: 'right' });
  doc.text('RETENUES', colRetenues, y + 5, { width: largeurRetenues, align: 'right' });
  doc.text('AVOIRS', colAvoirs, y + 5, { width: largeurAvoirs - 4, align: 'right' });
  y += 20;
  y += 5; // espacement avant la première ligne — sans ça le texte touche la barre grise de l'en-tête

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
      y += 5;
      continue;
    }
    doc.font(ligne.gras ? 'Helvetica-Bold' : ligne.indent ? 'Helvetica-Oblique' : 'Helvetica').fontSize(10.5);
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
    y += 14.5;
  }

  const totalRetenues = d.cnssSalariale + d.iuts + d.fsp + d.reversementTropPercu + d.avanceAcompte + d.autresRetenues;
  const totalAvoirs = d.brut + d.reliquat;

  y += 2;
  doc.moveTo(xGauche, y).lineTo(xGauche + largeurTotale, y).strokeColor('#000').stroke();
  y += 5;
  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('TOTAL', colBase, y, { width: largeurBase, align: 'right' });
  doc.text(formaterMontant(totalRetenues), colRetenues, y, { width: largeurRetenues, align: 'right' });
  doc.text(formaterMontant(totalAvoirs), colAvoirs, y, { width: largeurAvoirs - 4, align: 'right' });

  // Cadre englobant tout le tableau des rubriques, de l'en-tête de colonnes à la ligne TOTAL.
  const yTableauFin = y + 12;
  doc.rect(xGauche, yTableauDebut, largeurTotale, yTableauFin - yTableauDebut).strokeColor('#000').stroke();

  y += 8;

  // Bloc congés — année de référence = année de la période du bulletin (cf. décision produit)
  const largeurTiers = largeurTotale / 3;
  doc.rect(xGauche, y, largeurTotale, 16).fillColor('#e2e2e2').fill();
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(8.5);
  doc.text('CUMUL CONGÉS', xGauche, y + 4, { width: largeurTiers, align: 'center' });
  doc.text('CONGÉS PRIS', xGauche + largeurTiers, y + 4, { width: largeurTiers, align: 'center' });
  doc.text('SOLDE', xGauche + 2 * largeurTiers, y + 4, { width: largeurTiers, align: 'center' });
  y += 16;
  doc.rect(xGauche, y, largeurTotale, 16).strokeColor('#000').stroke();
  doc.font('Helvetica').fontSize(10);
  doc.text(formaterMontant(d.cumulConges), xGauche, y + 3, { width: largeurTiers, align: 'center' });
  doc.text(formaterMontant(d.congesPris), xGauche + largeurTiers, y + 3, { width: largeurTiers, align: 'center' });
  doc.text(formaterMontant(d.soldeConges, true), xGauche + 2 * largeurTiers, y + 3, { width: largeurTiers, align: 'center' });
  y += 16;

  // Bloc récapitulatif fiscal — 4 cases sur une ligne (3 fiscales + net à payer), largeurs
  // calculées pour occuper exactement largeurTotale avec 3 espaces de 10 pt entre elles.
  const ecart = 10;
  const largeurCaseFiscale = 110;
  const hauteurCase = 34;
  function caseFiscale(x: number, label: string, valeur: number) {
    doc.rect(x, y, largeurCaseFiscale, hauteurCase).strokeColor('#000').stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .text(label.toUpperCase(), x + 4, y + 5, { width: largeurCaseFiscale - 8, align: 'center' });
    doc
      .font('Helvetica')
      .fontSize(11)
      .text(formaterMontant(valeur), x + 4, y + 18, { width: largeurCaseFiscale - 8, align: 'center' });
  }

  caseFiscale(xGauche, 'Salaire net imposable', d.salaireNetImposable);
  caseFiscale(xGauche + largeurCaseFiscale + ecart, 'Abattement', d.abattementForfaitaire);
  caseFiscale(xGauche + 2 * (largeurCaseFiscale + ecart), 'Base imposable', d.baseImposable);

  const xNet = xGauche + 3 * (largeurCaseFiscale + ecart);
  const largeurNet = largeurTotale - 3 * (largeurCaseFiscale + ecart);
  doc.rect(xNet, y, largeurNet, hauteurCase).fillColor('#f0ceA0').fill().strokeColor('#000').stroke();
  doc
    .fillColor('#000')
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .text('NET À PAYER', xNet + 6, y + 5, { width: largeurNet - 12, align: 'center' });
  doc.fontSize(12).text(`${formaterMontant(d.netAPayer)} F CFA`, xNet + 6, y + 18, { width: largeurNet - 12, align: 'center' });

  y += hauteurCase + 22;
  doc.font('Helvetica').fontSize(10).text("L'employeur", xGauche + largeurTotale - 150, y, { width: 150, align: 'center' });
  y += 62; // espace de signature entre "L'employeur" et les mentions légales, cf. modèle papier fourni

  // Pied de page — coordonnées légales de la filiale (une par filiale, cf. décision produit).
  // Position dynamique (dépend de y accumulé) plutôt qu'une position absolue figée, pour rester
  // cohérente si l'espacement au-dessus change à nouveau. Champs non renseignés simplement omis
  // plutôt que d'afficher des tirets vides en cascade.
  const piedLignes = [
    d.filialeAdresse,
    d.filialeRccm ? `RCCM ${d.filialeRccm}` : null,
    d.filialeIfu ? `IFU N°${d.filialeIfu}` : null,
    d.filialeTelephone ? `Tél : ${d.filialeTelephone}` : null,
  ].filter(Boolean);

  // Mentions légales riches (capital social, section cadastrale, régime d'imposition...) : texte
  // libre saisi tel quel par filiale (une ligne par \n), à la place du gabarit simple
  // adresse/RCCM/IFU/téléphone qui ne peut pas exprimer ce niveau de détail.
  const piedTexteLignes = d.filialeMentionsLegalesBulletin
    ? d.filialeMentionsLegalesBulletin.split('\n').map((l) => l.trim()).filter(Boolean)
    : piedLignes.length > 0
      ? [piedLignes.join(' – ')]
      : [];

  // Position fixe proche du bas de page (indépendante du y accumulé au-dessus, qui ne bouge
  // plus) — demande explicite : descendre uniquement cette ligne, sans toucher au reste. Calculée
  // à rebours depuis le bas pour que 1 ligne (gabarit simple) comme 3 lignes (mentions riches)
  // finissent toutes les deux juste au-dessus de la marge basse, sans déborder sur une 2e page.
  const hauteurLignePied = 9;
  const yDepartPied = 833 - piedTexteLignes.length * hauteurLignePied;
  doc.font('Helvetica').fontSize(7.5).fillColor('#999');
  piedTexteLignes.forEach((ligne, i) => {
    doc.text(ligne, xGauche, yDepartPied + i * hauteurLignePied, { width: largeurTotale, align: 'center' });
  });

  doc.end();
  return fin;
}
