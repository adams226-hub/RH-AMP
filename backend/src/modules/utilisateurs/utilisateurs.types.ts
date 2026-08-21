import { CodeRole } from '../auth/auth.types';

export type StatutUtilisateur = 'actif' | 'suspendu' | 'supprime';

export interface Utilisateur {
  id: string;
  email: string;
  role: CodeRole;
  statut: StatutUtilisateur;
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
  employeId?: string;
  filialeIds?: string[];
  chantierIds?: string[];
}
