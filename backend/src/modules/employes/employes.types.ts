export type StatutEmploye = 'en_cours_creation' | 'actif' | 'suspendu' | 'sorti';
// Référence categories_professionnelles.code (référentiel géré depuis Paramètres > Référentiels,
// plus un ENUM figé) — simple chaîne libre côté types, validée par la FK en base.

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
  categorieProfessionnelle: string | null;
}

export interface CreationEmploye {
  matricule: string;
  nom: string;
  prenoms: string;
  dateNaissance: string;
  sexe: 'M' | 'F';
  nationalite: string;
  telephone: string;
  numCnib: string;
  numCnss: string;
  rib?: string;
  banque?: string;
  modePaiement?: string;
  personnesACharge?: number;
  filialeId: string;
  departementId?: string;
  serviceId?: string;
  fonctionId?: string;
  chantierId?: string;
  dateEmbauche: string;
  categorieProfessionnelle?: string;
}
