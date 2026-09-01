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

function formaterDateFr(iso: string): string {
  const [annee, mois, jour] = iso.slice(0, 10).split('-');
  return `${jour}/${mois}/${annee}`;
}

function civilite(sexe: 'M' | 'F'): { titre: string; ne: string; employe: string; il: string } {
  return sexe === 'F'
    ? { titre: 'Madame', ne: 'née', employe: 'employée', il: 'elle' }
    : { titre: 'Monsieur', ne: 'né', employe: 'employé', il: 'il' };
}

function paragraphesAttTrav(d: DonneesAttestationTravail): string[] {
  const c = civilite(d.sexe);
  const identite = [
    `${c.titre} ${d.nomPrenomsEmploye}`,
    d.dateNaissance ? `${c.ne}(e) le ${formaterDateFr(d.dateNaissance)}${d.lieuNaissance ? ` à ${d.lieuNaissance}` : ''}` : null,
    `titulaire de la pièce d'identité N° ${d.numeroPiece}`,
  ]
    .filter(Boolean)
    .join(', ');

  return [
    `Je soussigné(e), ${d.nomDirigeant || '________________'}, ${d.fonctionDirigeant || '________________'} de la société ${d.entreprise}, certifie que :`,
    `${identite}.`,
    `est ${c.employe}(e) au sein de notre société depuis le ${formaterDateFr(d.dateEmbauche)}, en qualité de ${d.poste || '________________'}, sous contrat ${d.typeContrat}.`,
    `À ce jour, ${c.il}/elle occupe toujours ce poste au sein de ${d.filiale}, ${d.lieuAffectation}.`,
    `La présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.`,
  ];
}

function paragraphesCertTrav(d: DonneesCertificatTravail): string[] {
  const c = civilite(d.sexe);
  const postes = d.postesOccupes
    .map((p) => `   - ${p.poste}, du ${formaterDateFr(p.dateDebut)} au ${p.dateFin ? formaterDateFr(p.dateFin) : "ce jour"}`)
    .join('\n');

  return [
    `Je soussigné(e), ${d.nomDirigeant || '________________'}, ${d.fonctionDirigeant || '________________'} de la société ${d.entreprise}, certifie que :`,
    `${c.titre} ${d.nomPrenomsEmploye}`,
    `a été ${c.employe}(e) au sein de notre société du ${formaterDateFr(d.dateEmbauche)} au ${formaterDateFr(d.dateSortie)}, soit une durée de ${d.dureeService}, en qualité de :`,
    postes,
    `${c.il === 'il' ? 'Il' : 'Elle'} quitte notre société${d.motifDepart ? ` ${d.motifDepart}` : ''}.`,
    `Le présent certificat est délivré pour servir et valoir ce que de droit.`,
  ];
}

function paragraphesAttStage(d: DonneesAttestationStage): string[] {
  const c = civilite(d.sexe);
  const missions = d.descriptionMissions ? `Durant cette période, ${c.il}/elle a été affecté(e) aux tâches suivantes :\n${d.descriptionMissions}` : null;

  return [
    `Je soussigné(e), ${d.nomDirigeant || '________________'}, ${d.fonctionDirigeant || '________________'} de la société ${d.entreprise}, certifie que :`,
    `${c.titre} ${d.nomPrenomsStagiaire}, étudiant(e) en ${d.filiereEtudes || '________________'} à ${d.etablissement || '________________'},`,
    `a effectué un stage au sein de notre société du ${formaterDateFr(d.dateDebutStage)} au ${formaterDateFr(d.dateFinStage)}, soit une durée de ${d.dureeStage}${d.service ? `, au sein du service ${d.service}` : ''}${d.superviseur ? `, sous la supervision de ${d.superviseur}` : ''}.`,
    missions,
    d.appreciation || null,
    `La présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit, notamment dans le cadre de son cursus académique.`,
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

  // En-tête société — nom de la filiale dans sa couleur d'accent à gauche, logo à droite s'il a
  // été déposé (Paramètres > Référentiels), sinon repli sur le texte seul.
  doc.font('Helvetica-Bold').fontSize(15).fillColor(couleur).text(d.filialeNom, xGauche, 26, { width: largeurTotale - 70 });
  doc.fillColor('#000');
  if (logo) {
    try {
      doc.image(logo, largeurPage - 40 - 55, 20, { fit: [55, 55] });
    } catch {
      // Fichier corrompu/format non supporté par pdfkit — le document doit quand même se générer.
    }
  }

  doc.moveTo(xGauche, 92).lineTo(xGauche + largeurTotale, 92).strokeColor('#ddd').lineWidth(1).stroke();

  doc.font('Helvetica-Bold').fontSize(16).fillColor('#000').text(TITRES[d.type], xGauche, 108, { width: largeurTotale, align: 'center' });
  doc.font('Helvetica').fontSize(10).text(`N° ${d.numeroComplet}`, xGauche, 130, { width: largeurTotale, align: 'center' });

  doc.y = 165;
  doc.font('Helvetica').fontSize(11);

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
  doc.font('Helvetica').fontSize(10).text(`Fait à Ouagadougou, le ${formaterDateFr(d.donnees.dateEmission)}`, xGauche, doc.y, {
    width: largeurTotale,
    align: 'right',
  });
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').text(d.donnees.fonctionSignataire || '________________', xGauche, doc.y, {
    width: largeurTotale,
    align: 'right',
  });

  // Pied de page ancré en position fixe (mêmes coordonnées éprouvées que paie.pdf.ts : y=770/782
  // avec margin:40, page A4 de 841,89 pt de haut) plutôt qu'à la suite du texte — le bas de page
  // est toujours habillé, quelle que soit la longueur du corps du document. Une position trop
  // proche de la limite bas-de-page (page.height − margin) déclenche un saut de page automatique
  // de pdfkit qui fait disparaître le texte sur une page 2 vide — d'où la marge de sécurité ici.
  doc.moveTo(xGauche, 758).lineTo(xGauche + largeurTotale, 758).strokeColor(couleur).lineWidth(1.5).stroke();

  const piedLignes = [
    d.filialeAdresse,
    d.filialeRccm ? `RCCM ${d.filialeRccm}` : null,
    d.filialeIfu ? `IFU N°${d.filialeIfu}` : null,
    d.filialeTelephone ? `Tél : ${d.filialeTelephone}` : null,
  ].filter(Boolean);

  doc.font('Helvetica').fontSize(7).fillColor('#666');
  if (piedLignes.length > 0) {
    doc.text(piedLignes.join(' – '), xGauche, 768, { width: largeurTotale, align: 'center' });
  }
  doc.fillColor('#999').text(`Document généré automatiquement — N° ${d.numeroComplet}`, xGauche, 780, {
    width: largeurTotale,
    align: 'center',
  });

  doc.end();
  return fin;
}
