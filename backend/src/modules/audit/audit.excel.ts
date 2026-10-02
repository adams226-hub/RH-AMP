import ExcelJS from 'exceljs';
import { FiltresAudit } from './audit.types';
import { listerJournalComplet } from './audit.service';

const LIBELLES_ACTION: Record<string, string> = {
  creation: 'Création',
  modification: 'Modification',
  suppression: 'Suppression',
  connexion: 'Connexion',
  connexion_echouee: 'Connexion échouée',
};

export async function genererExportExcelAudit(
  filtres: Pick<FiltresAudit, 'utilisateurId' | 'module' | 'action' | 'recherche' | 'dateDebut' | 'dateFin'>
): Promise<ExcelJS.Buffer> {
  const entrees = await listerJournalComplet(filtres);

  const classeur = new ExcelJS.Workbook();
  const feuille = classeur.addWorksheet('journal-audit');

  feuille.columns = [
    { header: 'Quand', key: 'quand', width: 20 },
    { header: 'Qui', key: 'qui', width: 28 },
    { header: 'Module', key: 'module', width: 20 },
    { header: 'Action', key: 'action', width: 16 },
    { header: 'Entité', key: 'entite', width: 36 },
    { header: 'Adresse IP', key: 'ip', width: 16 },
  ];
  feuille.getRow(1).font = { bold: true };
  feuille.views = [{ state: 'frozen', ySplit: 1 }];

  for (const e of entrees) {
    feuille.addRow({
      quand: new Date(e.createdAt).toLocaleString('fr-FR'),
      qui: e.utilisateurEmail ?? '',
      module: e.module,
      action: LIBELLES_ACTION[e.action] ?? e.action,
      entite: e.entiteId ?? '',
      ip: e.adresseIp ?? '',
    });
  }

  return classeur.xlsx.writeBuffer();
}
