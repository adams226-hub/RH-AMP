import PDFDocument from 'pdfkit';
import { pool } from '../../config/db';
import { ErreurApplicative } from '../../middleware/gestionErreurs';
import { obtenirLogoFiliale } from '../postes/postes.service';
import {
  DonneesAttestation,
  DonneesAttestationStage,
  DonneesAttestationTravail,
  DonneesCertificatTravail,
  TypeAttestation,
} from './attestations.types';
import { champsManquants, numeroComplet } from './attestations.service';

const TITRES: Record<TypeAttestation, string> = {
  att_trav: 'ATTESTATION DE TRAVAIL',
  cert_trav: 'CERTIFICAT DE TRAVAIL',
  att_stage: 'ATTESTATION DE STAGE',
};

interface DonneesPdf {
  type: TypeAttestation;
  numeroComplet: string;
  donnees: DonneesAttestation;
  filialeNom: string;
  filialeRaisonSociale: string | null;
  filialeAdresse: string | null;
  filialeRccm: string | null;
  filialeIfu: string | null;
  filialeTelephone: string | null;
  filialeLogoUrl: string | null;
  filialeCouleurAccent: string | null;
}

// Gris neutre si la filiale n'a pas encore de couleur d'accent définie (Paramètres > Référentiels).
const COULEUR_PAR_DEFAUT = '#94a3b8';

async function chargerDonneesPdf(id: string): Promise<DonneesPdf> {
  const { rows } = await pool.query(
    `SELECT a.type, a.numero, a.annee, a.donnees, f.nom AS filiale_nom, f.raison_sociale AS filiale_raison_sociale,
            f.adresse AS filiale_adresse,
            f.rccm AS filiale_rccm, f.ifu AS filiale_ifu, f.telephone AS filiale_telephone,
            f.logo_url AS filiale_logo_url, f.couleur_accent AS filiale_couleur_accent
     FROM attestations a JOIN filiales f ON f.id = a.filiale_id
     WHERE a.id = $1`,
    [id]
  );
  const l = rows[0];
  if (!l) throw new ErreurApplicative(404, 'Attestation introuvable');

  return {
    type: l.type as TypeAttestation,
    numeroComplet: numeroComplet(l.type as TypeAttestation, Number(l.numero), l.filiale_nom, Number(l.annee)),
    donnees: l.donnees as DonneesAttestation,
    filialeNom: l.filiale_nom,
    filialeRaisonSociale: l.filiale_raison_sociale,
    filialeAdresse: l.filiale_adresse,
    filialeRccm: l.filiale_rccm,
    filialeIfu: l.filiale_ifu,
    filialeTelephone: l.filiale_telephone,
    filialeLogoUrl: l.filiale_logo_url,
    filialeCouleurAccent: l.filiale_couleur_accent,
  };
}

// Format "18 octobre 2025" (jour sur 2 chiffres + mois en toutes lettres) — celui utilisé sur
// les 4 vrais documents AMP/ROMBAT GOLD, jamais le format numérique "18/10/2025".
const MOIS_FR_MINUSCULE = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function formaterDateFr(iso: string): string {
  const [annee, mois, jour] = iso.slice(0, 10).split('-');
  return `${jour.padStart(2, '0')} ${MOIS_FR_MINUSCULE[Number(mois) - 1]} ${annee}`;
}

function civilite(sexe: 'M' | 'F'): { titre: string; ne: string; employe: string; il: string } {
  return sexe === 'F'
    ? { titre: 'Madame', ne: 'née', employe: 'employée', il: 'elle' }
    : { titre: 'Monsieur', ne: 'né', employe: 'employé', il: 'il' };
}

// Élision "de" → "d'" devant un mot commençant par une voyelle (ou h muet) — cf. modèle
// CERTIFICAT_DE_TRAVAIL_AMP : "en qualité d'Opérateur Niveau", pas "en qualité de Opérateur".
function deElide(mot: string): string {
  return /^[aeiouyhàâäéèêëïîôöùûü]/i.test(mot) ? `d'${mot}` : `de ${mot}`;
}

// Formulations calquées sur les modèles Word réels de l'entreprise (ATTESTATION_DE_TRAVAIL_AMP,
// CERTIFICAT_DE_TRAVAIL_AMP, ATTESTATION_DE_STAGE) — port fidèle, ne pas réintroduire les clauses
// (type de contrat, lieu d'affectation, motif de départ...) que ces modèles n'utilisent pas.
function paragraphesAttTrav(d: DonneesAttestationTravail): string[] {
  const c = civilite(d.sexe);
  const naissance = d.dateNaissance
    ? ` ${c.ne} le ${formaterDateFr(d.dateNaissance)}${d.lieuNaissance ? ` à ${d.lieuNaissance}` : ''}`
    : '';

  return [
    `Je soussigné, ${d.nomDirigeant || '________________'}, ${d.fonctionDirigeant || '________________'} de ${d.entreprise} atteste que ${c.titre} ${d.nomPrenomsEmploye}${naissance}, matricule ${d.matricule} est ${c.employe} depuis le ${formaterDateFr(d.dateEmbauche)} à nos jours en qualité ${deElide(d.poste || '________________')}.`,
    `En foi de quoi, la présente attestation de travail lui est délivrée pour servir et valoir ce que de droit.`,
  ];
}

// Fin du 1er paragraphe du Certificat de travail, à partir de "certifie que..." — le début
// ("Je soussigné, {nomDirigeant}, {fonctionDirigeant} de {entreprise} ") est rendu à part par
// dessinerCertTrav() pour pouvoir mettre ces 3 champs en gras (calqué sur maquette_certificat_de_travail.pdf).
function suiteCertTrav(d: DonneesCertificatTravail): string {
  const c = civilite(d.sexe);
  const naissance = d.dateNaissance
    ? ` ${c.ne} le ${formaterDateFr(d.dateNaissance)}${d.lieuNaissance ? ` à ${d.lieuNaissance}` : ''}`
    : '';

  // Un seul poste : rendu en ligne, comme le modèle. Plusieurs postes successifs (obligation
  // légale de tous les lister, cf. SPEC_MODULE_ATTESTATIONS_AMP.md §3) : rendu en liste à puces.
  const qualite =
    d.postesOccupes.length <= 1
      ? `en qualité ${deElide(d.postesOccupes[0]?.poste ?? '________________')}`
      : `en qualité de :\n${d.postesOccupes
          .map((p) => `   - ${p.poste}, du ${formaterDateFr(p.dateDebut)} au ${p.dateFin ? formaterDateFr(p.dateFin) : 'ce jour'}`)
          .join('\n')}`;

  return `certifie que ${c.titre} ${d.nomPrenomsEmploye}${naissance}, matricule ${d.matricule} a été ${c.employe} dans notre entreprise durant la période du ${formaterDateFr(d.dateEmbauche)} au ${formaterDateFr(d.dateSortie)} ${qualite}.`;
}

function paragraphesAttStage(d: DonneesAttestationStage): string[] {
  const c = civilite(d.sexe);
  const naissance = d.dateNaissance
    ? ` ${c.ne} le ${formaterDateFr(d.dateNaissance)}${d.lieuNaissance ? ` à ${d.lieuNaissance}` : ''}`
    : '';
  const etablissement = d.etablissement ? `, étudiant(e) à ${d.etablissement}` : '';
  const section = d.service ? ` au service ${d.service}` : '';
  const superviseur = d.superviseur ? `, sous la supervision de ${d.superviseur}` : '';
  const missions = d.descriptionMissions
    ? `Durant cette période, ${c.il}/elle a été affecté(e) aux tâches suivantes :\n${d.descriptionMissions}`
    : null;

  return [
    `Je soussigné, ${d.nomDirigeant || '________________'}, ${d.fonctionDirigeant || '________________'} de ${d.entreprise} atteste que ${c.titre} ${d.nomPrenomsStagiaire}${naissance}${etablissement}, a effectué son stage pratique en ${d.filiereEtudes || '________________'}${section} durant la période du ${formaterDateFr(d.dateDebutStage)} au ${formaterDateFr(d.dateFinStage)}${superviseur}.`,
    missions,
    d.appreciation || null,
    `En foi de quoi, la présente attestation de stage lui est délivrée pour servir et valoir ce que de droit.`,
  ].filter((p): p is string => p !== null);
}

// Rendu spécifique au Certificat de travail — calqué à l'identique sur
// maquette_certificat_de_travail.pdf (demande explicite, 2e passe après comparaison du 1er rendu
// avec le vrai document téléchargé) : page au format PAYSAGE (pas portrait), double-cadre orange à
// coins droits (pas une simple ligne arrondie), barre grise décorative au-dessus du logo (absente
// du fichier logo lui-même — c'est un élément de mise en page du modèle Word, pas de l'image),
// pas de N° affiché, nom/fonction du dirigeant et nom de l'entreprise en gras dans le 1er
// paragraphe, pas de ligne "Le {fonction}" avant la signature, mentions légales en pied de page en
// italique. Le texte légal (durée d'emploi + liste des postes, cf. suiteCertTrav) reste inchangé —
// seule la mise en page copie la maquette. Filigrane retiré par la suite (demande explicite).
function dessinerCertTrav(
  doc: InstanceType<typeof PDFDocument>,
  d: DonneesPdf,
  logo: Buffer | null,
  couleur: string,
  dims: { xGauche: number; largeurTotale: number; largeurPage: number; hauteurPage: number; MM: number }
): void {
  const { xGauche, largeurTotale, largeurPage, hauteurPage, MM } = dims;
  const donnees = d.donnees as DonneesCertificatTravail;

  // Double cadre à coins droits (pas arrondis) — calqué sur la bordure "double ligne" du modèle,
  // bien distincte du cadre à coin arrondi utilisé jusqu'ici.
  const margeCadreExt = 14;
  const ecartCadre = 5;
  doc.rect(margeCadreExt, margeCadreExt, largeurPage - 2 * margeCadreExt, hauteurPage - 2 * margeCadreExt).lineWidth(2.5).strokeColor(couleur).stroke();
  doc
    .rect(
      margeCadreExt + ecartCadre,
      margeCadreExt + ecartCadre,
      largeurPage - 2 * (margeCadreExt + ecartCadre),
      hauteurPage - 2 * (margeCadreExt + ecartCadre)
    )
    .lineWidth(1)
    .strokeColor(couleur)
    .stroke();

  // Barre grise décorative directement au-dessus du logo — absente du fichier logo lui-même
  // (vérifié : le PNG stocké ne contient que le pictogramme + le nom), c'est un élément de mise en
  // page propre au modèle du certificat.
  const largeurLogoBox = 150;
  const hauteurBoiteLogo = 70;
  const yBarre = margeCadreExt + ecartCadre + 20;
  doc.rect(xGauche, yBarre, largeurLogoBox, 9).fillColor('#52525b').fill();

  const yLogo = yBarre + 9;
  let logoAffiche = false;
  if (logo) {
    try {
      doc.image(logo, xGauche, yLogo, { fit: [largeurLogoBox, hauteurBoiteLogo] });
      logoAffiche = true;
    } catch {
      // Fichier corrompu/format non supporté par pdfkit — le document doit quand même se générer.
    }
  }
  if (!logoAffiche) {
    doc.font('Times-Bold').fontSize(15).fillColor(couleur).text(d.filialeNom, xGauche, yLogo + 10, { width: largeurTotale });
    doc.fillColor('#000');
  }

  const yTitre = yLogo + hauteurBoiteLogo + 20;
  doc.font('Times-Bold').fontSize(26).fillColor('#000').text(TITRES.cert_trav, xGauche, yTitre, {
    width: largeurTotale,
    align: 'center',
  });

  doc.y = yTitre + 44;
  doc.font('Times-Roman').fontSize(14).fillColor('#000');

  // Alignement "left" (pas "justify") sur ce paragraphe précisément parce qu'il mélange gras et
  // texte normal via plusieurs appels .text({continued:true}) — pdfkit espace alors incorrectement
  // certains mots à la jonction entre segments quand "justify" est actif (testé, confirmé : espaces
  // doubles visibles autour de "certifie que"). Les autres paragraphes (un seul appel, une seule
  // police) restent en justify, qui fonctionne correctement dans ce cas.
  doc
    .text('Je soussigné, ', xGauche, doc.y, { width: largeurTotale, align: 'left', lineGap: 5, continued: true })
    .font('Times-Bold')
    .text(`${donnees.nomDirigeant || '________________'}, `, { continued: true })
    .text(`${donnees.fonctionDirigeant || '________________'} `, { continued: true })
    .font('Times-Roman')
    .text('de ', { continued: true })
    .font('Times-Bold')
    .text(`${donnees.entreprise} `, { continued: true })
    .font('Times-Roman')
    .text(suiteCertTrav(donnees));

  doc.moveDown(1.2);
  doc.text(
    'En foi de quoi, le présent certificat de travail lui est délivré pour servir et valoir ce que de droit.',
    xGauche,
    doc.y,
    { width: largeurTotale, align: 'justify', lineGap: 5 }
  );

  doc.moveDown(2.5);
  doc.font('Times-Italic').fontSize(13).text(`Fait à Ouagadougou, le ${formaterDateFr(donnees.dateEmission)}`, xGauche, doc.y, {
    width: largeurTotale,
    align: 'right',
  });

  // Pas de ligne "Le {fonction}" avant la signature (absente de la maquette, demande explicite) :
  // directement l'espace de signature puis le nom.
  doc.y += 30 * MM;
  doc.font('Times-Bold').fontSize(13).text(donnees.nomDirigeant || '________________', xGauche, doc.y, {
    width: largeurTotale,
    align: 'right',
    underline: true,
  });

  const piedLignes = [
    d.filialeAdresse,
    d.filialeRccm ? `RCCM ${d.filialeRccm}` : null,
    d.filialeIfu ? `IFU N°${d.filialeIfu}` : null,
    d.filialeTelephone ? `Tél : ${d.filialeTelephone}` : null,
  ].filter(Boolean);
  if (piedLignes.length > 0) {
    const yPied = hauteurPage - margeCadreExt - ecartCadre - 24;
    doc.font('Times-Italic').fontSize(8).fillColor('#444').text(piedLignes.join(' – '), xGauche, yPied, {
      width: largeurTotale,
      align: 'center',
    });
  }
}

export async function genererAttestationPdf(id: string): Promise<Buffer> {
  const d = await chargerDonneesPdf(id);

  // Filet de sécurité pour un document déjà enregistré avant l'ajout de cette validation (cf.
  // genererAttestation côté service, qui bloque désormais à la création) — refuser de produire un
  // PDF avec des blancs plutôt que de laisser passer un document officiel incomplet.
  const manquants = champsManquants(d.type, d.donnees);
  if (manquants.length > 0) {
    throw new ErreurApplicative(422, `Champs obligatoires manquants : ${manquants.join(', ')}.`);
  }

  const logo = await obtenirLogoFiliale(d.filialeLogoUrl);
  const couleur = d.filialeCouleurAccent || COULEUR_PAR_DEFAUT;

  // Marge basse réduite (8, comme paie.pdf.ts) : pdfkit déclenche un saut de page automatique dès
  // qu'un texte est positionné au-delà de page.height − marge basse, quelle que soit la position
  // explicite donnée à .text() — testé, confirmé (texte perdu sur une page 2 vide) avec une marge
  // basse de 40 et un pied de page placé à ~12mm du bord réel. Marge basse de 8 repousse cette
  // limite à page.height − 8, largement sous la zone où le pied de page est dessiné.
  // Certificat de travail : format PAYSAGE (demande explicite, calqué sur la maquette fournie — un
  // vrai document A4 à l'italienne, pas une page portrait). Les deux autres types restent en
  // portrait, inchangés.
  const doc =
    d.type === 'cert_trav'
      ? new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: 40, bottom: 8, left: 40, right: 40 } })
      : new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 8, left: 40, right: 40 } });
  const morceaux: Buffer[] = [];
  doc.on('data', (c) => morceaux.push(c));
  const fin = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(morceaux))));

  const xGauche = 40;
  const largeurPage = doc.page.width;
  const hauteurPage = doc.page.height;
  // Calculée depuis la largeur réelle de la page (515 pour un A4 portrait, ~762 en paysage) plutôt
  // qu'une constante fixe — reste correcte quelle que soit l'orientation.
  const largeurTotale = largeurPage - 2 * xGauche;

  // 1mm en points PDF (72 pt/pouce, 25.4mm/pouce) — pour exprimer les marges demandées
  // (15mm en haut, 10-15mm en bas) dans les mêmes unités que le reste du document.
  const MM = 72 / 25.4;

  // Certificat de travail : rendu entièrement à part, calqué sur la maquette fournie (cadre
  // pleine page, pas de N°, gras partiel, etc.) — voir dessinerCertTrav() ci-dessus.
  if (d.type === 'cert_trav') {
    dessinerCertTrav(doc, d, logo, couleur, { xGauche, largeurTotale, largeurPage, hauteurPage, MM });
    doc.end();
    return fin;
  }

  // Pied de page — coordonnées légales de la filiale, en position FIXE par rapport au bas de la
  // page (marge basse ~12mm, demande explicite), indépendante du contenu au-dessus : plus de
  // chevauchement ni d'espacement variable selon la longueur du texte. Même technique que
  // paie.pdf.ts (position calculée à rebours depuis le bas de page), y compris la limite connue de
  // ce procédé : un seul appel explicite en fin de génération, jamais abonné à l'évènement
  // 'pageAdded' — abonner dessinerPiedDePage() à 'pageAdded' provoque une boucle infinie (le pied
  // de page dessiné près de la marge basse déclenche lui-même un nouveau saut de page, qui
  // redéclenche 'pageAdded', etc. — testé, confirmé par un crash "Maximum call stack size
  // exceeded"). Un document avec un contenu assez long pour déborder sur une 2e page n'aura donc
  // pas de pied de page sur cette page-là — cas limite jugé acceptable pour une attestation, dont
  // le texte tient toujours largement sur une seule page A4.
  const piedLignes = [
    d.filialeAdresse,
    d.filialeRccm ? `RCCM ${d.filialeRccm}` : null,
    d.filialeIfu ? `IFU N°${d.filialeIfu}` : null,
    d.filialeTelephone ? `Tél : ${d.filialeTelephone}` : null,
  ].filter(Boolean);

  function dessinerPiedDePage() {
    const margeBasse = 12 * MM;
    const yPiedDivider = hauteurPage - margeBasse - 18;
    doc.moveTo(xGauche, yPiedDivider).lineTo(xGauche + largeurTotale, yPiedDivider).strokeColor(couleur).lineWidth(1.5).stroke();

    if (piedLignes.length > 0) {
      doc.font('Times-Roman').fontSize(8).fillColor('#666');
      doc.text(piedLignes.join(' – '), xGauche, yPiedDivider + 10, { width: largeurTotale, align: 'center' });
    }
  }

  // Bandeau décoratif en haut de page (couleur d'accent de la filiale) — évite que l'en-tête ne
  // soit qu'un logo isolé, même logique que le bandeau gris du bulletin de paie (paie.pdf.ts).
  doc.rect(0, 0, largeurPage, 8).fillColor(couleur).fill();
  doc.fillColor('#000');

  // En-tête société — logo seul en haut à gauche s'il a été déposé (Paramètres > Référentiels),
  // calqué sur le vrai document scanné ROMBAT GOLD (le nom de la société est déjà intégré au
  // logo, donc jamais répété en texte à côté) ; repli sur le nom de la filiale en texte seul
  // uniquement si aucun logo n'existe encore pour cette filiale.
  // Marge haute ~15mm (demande explicite). Hauteur de la boîte du logo réduite (150x55 au lieu de
  // 150x150) : `fit` ne déforme ni ne recadre jamais l'image, il la réduit pour tenir dans la
  // boîte en gardant ses proportions — l'ancienne boîte carrée de 150pt de haut réservait donc un
  // grand vide sous un logo large mais peu haut (tous les logos déposés ici sont de ce type), d'où
  // l'espace vide signalé avant la ligne de séparation.
  const yLogo = 15 * MM;
  const hauteurBoiteLogo = 55;
  let logoAffiche = false;
  if (logo) {
    try {
      doc.image(logo, xGauche, yLogo, { fit: [150, hauteurBoiteLogo] });
      logoAffiche = true;
    } catch {
      // Fichier corrompu/format non supporté par pdfkit — le document doit quand même se générer.
    }
  }
  if (!logoAffiche) {
    doc.font('Times-Bold').fontSize(15).fillColor(couleur).text(d.filialeNom, xGauche, yLogo + 10, { width: largeurTotale });
    doc.fillColor('#000');
  }

  // Séparateur juste sous le logo (petit espace fixe de 10pt), plus l'espace vide signalé.
  const ySepatareur = yLogo + hauteurBoiteLogo + 10;
  doc.moveTo(xGauche, ySepatareur).lineTo(xGauche + largeurTotale, ySepatareur).strokeColor('#ddd').lineWidth(1).stroke();

  // Titre encadré (police avec empattements, gros corps, centré horizontalement dans le cadre —
  // demande explicite) — calqué sur les modèles Word réels de l'entreprise (bordure épaisse dans
  // la couleur d'accent de la filiale).
  const yBoiteTitre = ySepatareur + 16;
  const hauteurBoiteTitre = 62;
  doc.rect(xGauche, yBoiteTitre, largeurTotale, hauteurBoiteTitre).lineWidth(3).strokeColor(couleur).stroke();
  doc.font('Times-Bold').fontSize(30).fillColor('#000').text(TITRES[d.type], xGauche + 18, yBoiteTitre + 17, {
    width: largeurTotale - 36,
    align: 'center',
  });

  doc.font('Times-Roman').fontSize(10).fillColor('#666').text(`N° ${d.numeroComplet}`, xGauche, yBoiteTitre + hauteurBoiteTitre + 8, {
    width: largeurTotale,
    align: 'right',
  });

  // +52 au lieu de +34 : un interligne supplémentaire entre le N° et le premier paragraphe
  // (demande explicite — l'espacement précédent était jugé trop serré).
  doc.y = yBoiteTitre + hauteurBoiteTitre + 52;
  doc.font('Times-Roman').fontSize(14).fillColor('#000');

  const paragraphes =
    d.type === 'att_trav'
      ? paragraphesAttTrav(d.donnees as DonneesAttestationTravail)
      : paragraphesAttStage(d.donnees as DonneesAttestationStage);

  for (const p of paragraphes) {
    // lineGap : interligne plus aéré à l'intérieur du paragraphe (demande explicite — le texte
    // paraissait trop serré) ; moveDown juste après reste l'espacement ENTRE paragraphes.
    doc.text(p, xGauche, doc.y, { width: largeurTotale, align: 'justify', lineGap: 5 });
    doc.moveDown(1.2);
  }

  doc.moveDown(2);
  doc.font('Times-Roman').fontSize(13).text(`Fait à Ouagadougou, le ${formaterDateFr(d.donnees.dateEmission)}`, xGauche, doc.y, {
    width: largeurTotale,
    align: 'right',
  });
  doc.moveDown(0.5);
  doc.text(`Le ${d.donnees.fonctionSignataire || d.donnees.fonctionDirigeant || '________________'}`, xGauche, doc.y, {
    width: largeurTotale,
    align: 'right',
  });
  // Espace de ~30mm pour la signature et le cachet entre la fonction et le nom (demande
  // explicite) — valeur en points, pas moveDown() dont l'unité (un "saut de ligne") dépend de la
  // taille de police courante et n'aurait pas donné une mesure physique fiable.
  doc.y += 30 * MM;
  doc.font('Times-Bold').text(d.donnees.nomDirigeant || '________________', xGauche, doc.y, {
    width: largeurTotale,
    align: 'right',
    underline: true,
  });

  // Un seul appel, sur la page courante (cf. commentaire de dessinerPiedDePage plus haut).
  dessinerPiedDePage();

  doc.end();
  return fin;
}
