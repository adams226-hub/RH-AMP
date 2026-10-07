import ExcelJS from 'exceljs';
import { listerToutesDemandes } from './absences.service';
import { ClassificationAbsence, TypeDemandeAbsence } from './absences.types';

const LIBELLES_TYPE: Record<TypeDemandeAbsence, string> = {
  permission_exceptionnelle: 'Permission exceptionnelle',
  absence_hors_bareme: 'Autre absence',
};

const LIBELLES_CLASSIFICATION: Record<ClassificationAbsence, string> = {
  non_deductible: 'Non déductible',
  deductible_conge: 'Déductible des congés',
  sans_solde: 'Sans solde',
};

function formaterDateFr(iso: string | null): string {
  if (!iso) return '';
  const [a, m, j] = iso.slice(0, 10).split('-');
  return `${j}/${m}/${a}`;
}

export async function genererExportExcelAbsences(
  filialesAutorisees: string[] | null,
  chantiersAutorisees: string[] | null
): Promise<ExcelJS.Buffer> {
  const demandes = await listerToutesDemandes(filialesAutorisees, chantiersAutorisees);

  const classeur = new ExcelJS.Workbook();
  const feuille = classeur.addWorksheet('absences');

  feuille.columns = [
    { header: 'Matricule', key: 'matricule', width: 14 },
    { header: 'Nom', key: 'nom', width: 16 },
    { header: 'Prénoms', key: 'prenoms', width: 18 },
    { header: 'Type', key: 'type', width: 22 },
    { header: 'Motif', key: 'motif', width: 24 },
    { header: 'Date de début', key: 'dateDebut', width: 14 },
    { header: 'Date de fin', key: 'dateFin', width: 14 },
    { header: 'Jours', key: 'nbJours', width: 10 },
    { header: 'Jours barème', key: 'nbJoursBareme', width: 12 },
    { header: 'Jours hors barème', key: 'nbJoursHorsBareme', width: 14 },
    { header: 'Justificatif fourni', key: 'justificatif', width: 14 },
    { header: 'Statut', key: 'statut', width: 16 },
    { header: 'Classification', key: 'classification', width: 20 },
  ];
  feuille.getRow(1).font = { bold: true };
  feuille.views = [{ state: 'frozen', ySplit: 1 }];

  for (const d of demandes) {
    feuille.addRow({
      matricule: d.employeMatricule,
      nom: d.employeNom,
      prenoms: d.employePrenoms,
      type: LIBELLES_TYPE[d.type],
      motif: d.motif,
      dateDebut: formaterDateFr(d.dateDebut),
      dateFin: formaterDateFr(d.dateFin),
      nbJours: d.nbJours,
      nbJoursBareme: d.nbJoursBareme,
      nbJoursHorsBareme: d.nbJoursHorsBareme,
      justificatif: d.justificatifFourni ? 'Oui' : 'Non',
      statut: d.statut,
      classification: d.classification ? LIBELLES_CLASSIFICATION[d.classification] : '',
    });
  }

  return classeur.xlsx.writeBuffer();
}
