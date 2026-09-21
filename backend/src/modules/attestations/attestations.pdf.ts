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
import { numeroComplet } from './attestations.service';

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
    `SELECT a.type, a.numero, a.annee, a.donnees, f.nom AS filiale_nom, f.adresse AS filiale_adresse,
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

function paragraphesCertTrav(d: DonneesCertificatTravail): string[] {
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

  return [
    `Je soussigné, ${d.nomDirigeant || '________________'}, ${d.fonctionDirigeant || '________________'} de ${d.entreprise} certifie que ${c.titre} ${d.nomPrenomsEmploye}${naissance}, matricule ${d.matricule} a été ${c.employe} dans notre entreprise durant la période du ${formaterDateFr(d.dateEmbauche)} au ${formaterDateFr(d.dateSortie)} ${qualite}.`,
    `En foi de quoi, le présent certificat de travail lui est délivré pour servir et valoir ce que de droit.`,
  ];
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

export async function genererAttestationPdf(id: string): Promise<Buffer> {
  const d = await chargerDonneesPdf(id);
  const logo = await obtenirLogoFiliale(d.filialeLogoUrl);
  const couleur = d.filialeCouleurAccent || COULEUR_PAR_DEFAUT;

  // margin: 40 (pas 55) — même valeur que paie.pdf.ts, dont le pied de page en position fixe
  // (y=770/782) est éprouvé avec cette marge. Un pied de page trop proche de page.height moins la
  // marge déclenche un saut de page automatique de pdfkit (texte perdu sur une page 2 vide) —
  // observé avec margin:55 avant cette correction, d'où le retour à la marge du bulletin.
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const morceaux: Buffer[] = [];
  doc.on('data', (c) => morceaux.push(c));
  const fin = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(morceaux))));

  const xGauche = 40;
  const largeurTotale = 515;
  const largeurPage = doc.page.width;

  // Bandeau décoratif en haut de page (couleur d'accent de la filiale) — évite que l'en-tête ne
  // soit qu'un logo isolé, même logique que le bandeau gris du bulletin de paie (paie.pdf.ts).
  doc.rect(0, 0, largeurPage, 8).fillColor(couleur).fill();
  doc.fillColor('#000');

  // En-tête société — logo seul en haut à gauche s'il a été déposé (Paramètres > Référentiels),
  // calqué sur le vrai document scanné ROMBAT GOLD (le nom de la société est déjà intégré au
  // logo, donc jamais répété en texte à côté) ; repli sur le nom de la filiale en texte seul
  // uniquement si aucun logo n'existe encore pour cette filiale.
  // Logo agrandi (150x150, remonté en haut de page) — le reste de l'en-tête (séparateur, titre)
  // est décalé plus bas d'autant, même principe que paie.pdf.ts pour un logo agrandi.
  let logoAffiche = false;
  if (logo) {
    try {
      doc.image(logo, xGauche, 15, { fit: [150, 150] });
      logoAffiche = true;
    } catch {
      // Fichier corrompu/format non supporté par pdfkit — le document doit quand même se générer.
    }
  }
  if (!logoAffiche) {
    doc.font('Helvetica-Bold').fontSize(15).fillColor(couleur).text(d.filialeNom, xGauche, 26, { width: largeurTotale });
    doc.fillColor('#000');
  }

  const ySepatareur = logoAffiche ? 175 : 92;
  doc.moveTo(xGauche, ySepatareur).lineTo(xGauche + largeurTotale, ySepatareur).strokeColor('#ddd').lineWidth(1).stroke();

  // Titre encadré (police avec empattements, gros corps) — calqué sur les modèles Word réels de
  // l'entreprise (bordure épaisse dans la couleur d'accent de la filiale, texte casé à gauche).
  const yBoiteTitre = ySepatareur + 16;
  const hauteurBoiteTitre = 62;
  doc.rect(xGauche, yBoiteTitre, largeurTotale, hauteurBoiteTitre).lineWidth(3).strokeColor(couleur).stroke();
  doc.font('Times-Bold').fontSize(30).fillColor('#000').text(TITRES[d.type], xGauche + 18, yBoiteTitre + 17, {
    width: largeurTotale - 36,
  });

  doc.font('Times-Roman').fontSize(10).fillColor('#666').text(`N° ${d.numeroComplet}`, xGauche, yBoiteTitre + hauteurBoiteTitre + 8, {
    width: largeurTotale,
    align: 'right',
  });

  doc.y = yBoiteTitre + hauteurBoiteTitre + 34;
  doc.font('Times-Roman').fontSize(14).fillColor('#000');

  const paragraphes =
    d.type === 'att_trav'
      ? paragraphesAttTrav(d.donnees as DonneesAttestationTravail)
      : d.type === 'cert_trav'
        ? paragraphesCertTrav(d.donnees as DonneesCertificatTravail)
        : paragraphesAttStage(d.donnees as DonneesAttestationStage);

  for (const p of paragraphes) {
    doc.text(p, xGauche, doc.y, { width: largeurTotale, align: 'justify' });
    doc.moveDown(1.2);
  }

  doc.moveDown(2);
  doc.font('Times-Roman').fontSize(13).text(`Ouagadougou, le ${formaterDateFr(d.donnees.dateEmission)}`, xGauche, doc.y, {
    width: largeurTotale,
    align: 'right',
  });
  doc.moveDown(0.5);
  doc.text(`Le ${d.donnees.fonctionSignataire || d.donnees.fonctionDirigeant || '________________'}`, xGauche, doc.y, {
    width: largeurTotale,
    align: 'right',
  });
  doc.moveDown(1.5);
  doc.font('Times-Bold').text(d.donnees.nomDirigeant || '________________', xGauche, doc.y, {
    width: largeurTotale,
    align: 'right',
    underline: true,
  });

  // Pied de page en position dynamique (dépend de la hauteur réellement occupée au-dessus,
  // elle-même variable selon le logo/la taille de police) plutôt qu'en position fixe — évite un
  // chevauchement ou un saut de page automatique de pdfkit si le contenu s'allonge.
  doc.moveDown(3);
  const yPiedDivider = doc.y;
  doc.moveTo(xGauche, yPiedDivider).lineTo(xGauche + largeurTotale, yPiedDivider).strokeColor(couleur).lineWidth(1.5).stroke();

  const piedLignes = [
    d.filialeAdresse,
    d.filialeRccm ? `RCCM ${d.filialeRccm}` : null,
    d.filialeIfu ? `IFU N°${d.filialeIfu}` : null,
    d.filialeTelephone ? `Tél : ${d.filialeTelephone}` : null,
  ].filter(Boolean);

  doc.font('Helvetica').fontSize(8).fillColor('#666');
  if (piedLignes.length > 0) {
    doc.text(piedLignes.join(' – '), xGauche, yPiedDivider + 10, { width: largeurTotale, align: 'center' });
  }

  doc.end();
  return fin;
}
