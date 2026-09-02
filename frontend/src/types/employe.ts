export type StatutEmploye = 'en_cours_creation' | 'actif' | 'suspendu' | 'sorti';

export interface Employe {
  id: string;
  matricule: string;
  nom: string;
  prenoms: string;
  dateNaissance: string;
  sexe: 'M' | 'F';
  nationalite: string;
  telephone: string;
  numCnib: string;
  numCnss: string;
  rib: string | null;
  banque: string | null;
  modePaiement: string | null;
  personnesACharge: number;
  filialeId: string;
  departementId: string | null;
  serviceId: string | null;
  fonctionId: string | null;
  superieurId: string | null;
  chantierId: string | null;
  dateEmbauche: string;
  statut: StatutEmploye;
  // Référence categories_professionnelles.code (référentiel géré depuis Paramètres).
  categorieProfessionnelle: string | null;
  // Décision RH indépendante du chantier/contrat — pilote le blocage de paie tant que le
  // pointage du mois n'est pas validé.
  soumisPointage: boolean;
}
