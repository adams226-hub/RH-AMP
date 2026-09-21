import ExcelJS from 'exceljs';
import { listerMissions } from './missions.service';
import { StatutMission } from './missions.types';

const LIBELLES_STATUT: Record<StatutMission, string> = {
  a_venir: 'À venir',
  en_cours: 'En cours',
  en_retard: 'En retard',
  terminee: 'Terminée',
};

function formaterDateFr(iso: string | null): string {
  if (!iso) return '';
  const [a, m, j] = iso.slice(0, 10).split('-');
  return `${j}/${m}/${a}`;
}

export async function genererExportExcelMissions(
  filialesAutorisees: string[] | null,
  chantiersAutorisees: string[] | null
): Promise<ExcelJS.Buffer> {
  const missions = await listerMissions(filialesAutorisees, chantiersAutorisees);

  const classeur = new ExcelJS.Workbook();
  const feuille = classeur.addWorksheet('missions');

  feuille.columns = [
    { header: 'Matricule', key: 'matricule', width: 14 },
    { header: 'Nom', key: 'nom', width: 16 },
    { header: 'Prénoms', key: 'prenoms', width: 18 },
    { header: "N° d'ordre de mission", key: 'numeroOrdre', width: 20 },
    { header: 'Destination', key: 'destination', width: 20 },
    { header: 'Motif', key: 'motif', width: 24 },
    { header: 'Date de départ', key: 'dateDepart', width: 14 },
    { header: 'Date de retour prévue', key: 'dateRetourPrevue', width: 18 },
    { header: 'Date de retour réelle', key: 'dateRetourReelle', width: 18 },
    { header: 'Statut', key: 'statut', width: 12 },
    { header: 'Hébergement (F CFA)', key: 'hebergement', width: 18 },
    { header: 'Restauration (F CFA)', key: 'restauration', width: 18 },
    { header: 'Total frais (F CFA)', key: 'total', width: 16 },
  ];
  feuille.getRow(1).font = { bold: true };
  feuille.views = [{ state: 'frozen', ySplit: 1 }];

  for (const m of missions) {
    feuille.addRow({
      matricule: m.employeMatricule,
      nom: m.employeNom,
      prenoms: m.employePrenoms,
      numeroOrdre: m.numeroOrdreMission ?? '',
      destination: m.destination,
      motif: m.motif,
      dateDepart: formaterDateFr(m.dateDepart),
      dateRetourPrevue: formaterDateFr(m.dateRetourPrevue),
      dateRetourReelle: formaterDateFr(m.dateRetourReelle),
      statut: LIBELLES_STATUT[m.statut],
      hebergement: m.montantHebergement,
      restauration: m.montantRestauration,
      total: m.montantHebergement + m.montantRestauration,
    });
  }

  return classeur.xlsx.writeBuffer();
}
