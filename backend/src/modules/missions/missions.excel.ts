import ExcelJS from 'exceljs';
import { listerMissions, listerSejoursHebergement } from './missions.service';
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

// Export mensuel de l'onglet Hébergements — colonnes demandées (spécification maisons d'hôte),
// avec le total du mois en pied de tableau.
export async function genererExportExcelHebergements(
  filialesAutorisees: string[] | null,
  chantiersAutorisees: string[] | null,
  filtres: { mois?: string; maisonId?: string }
): Promise<ExcelJS.Buffer> {
  const sejours = await listerSejoursHebergement(filialesAutorisees, chantiersAutorisees, filtres);

  const classeur = new ExcelJS.Workbook();
  const feuille = classeur.addWorksheet('hebergements');

  feuille.columns = [
    { header: "N° d'ordre", key: 'numeroOrdre', width: 10 },
    { header: 'Nom', key: 'nom', width: 16 },
    { header: 'Prénoms', key: 'prenoms', width: 18 },
    { header: 'Catégorie', key: 'categorie', width: 16 },
    { header: 'Poste', key: 'poste', width: 20 },
    { header: 'Téléphone', key: 'telephone', width: 16 },
    { header: "N° ordre de mission", key: 'numeroOrdreMission', width: 20 },
    { header: 'Objet', key: 'objet', width: 24 },
    { header: 'Maison', key: 'maison', width: 18 },
    { header: 'Arrivée', key: 'arrivee', width: 14 },
    { header: 'Départ', key: 'depart', width: 14 },
    { header: 'Nuitées', key: 'nuitees', width: 10 },
    { header: 'Forfait (F CFA)', key: 'forfait', width: 16 },
    { header: "Centre d'imputation", key: 'centreImputation', width: 20 },
    { header: 'Prolongation (nuitées)', key: 'prolongation', width: 18 },
    { header: 'Forfait total (F CFA)', key: 'forfaitTotal', width: 18 },
  ];
  feuille.getRow(1).font = { bold: true };
  feuille.views = [{ state: 'frozen', ySplit: 1 }];

  let totalMois = 0;
  sejours.forEach((s, index) => {
    totalMois += s.forfaitTotal;
    feuille.addRow({
      numeroOrdre: index + 1,
      nom: s.employeNom,
      prenoms: s.employePrenoms,
      categorie: s.employeCategorie ?? '',
      poste: s.employeFonction ?? '',
      telephone: s.employeTelephone,
      numeroOrdreMission: s.numeroOrdreMission ?? '',
      objet: s.motifMission,
      maison: s.maisonNom,
      arrivee: formaterDateFr(s.dateArrivee),
      depart: formaterDateFr(s.dateDepart),
      nuitees: s.nuitees,
      forfait: s.nuitees * s.tarifNuitee,
      centreImputation: s.centreImputation ?? '',
      prolongation: s.nuiteesProlongation,
      forfaitTotal: s.forfaitTotal,
    });
  });

  const ligneTotal = feuille.addRow({ numeroOrdreMission: '', objet: 'TOTAL DU MOIS', forfaitTotal: totalMois });
  ligneTotal.font = { bold: true };

  return classeur.xlsx.writeBuffer();
}
