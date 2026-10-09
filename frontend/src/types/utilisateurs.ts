import { CodeRole } from '../context/AuthContext';

export type StatutUtilisateur = 'actif' | 'suspendu' | 'supprime';

export interface Utilisateur {
  id: string;
  email: string;
  role: CodeRole;
  statut: StatutUtilisateur;
  nom: string | null;
  prenoms: string | null;
  employeId: string | null;
  employeNom: string | null;
  employePrenoms: string | null;
  filialeIds: string[];
  chantierIds: string[];
  derniereConnexion: string | null;
  createdAt: string;
}

export interface CreationUtilisateur {
  email: string;
  role: CodeRole;
  nom?: string;
  prenoms?: string;
  employeId?: string;
  filialeIds?: string[];
  chantierIds?: string[];
}
