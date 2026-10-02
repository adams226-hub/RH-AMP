export interface EntreeAudit {
  id: string;
  utilisateurId: string | null;
  utilisateurEmail: string | null;
  action: string;
  module: string;
  entiteId: string | null;
  valeurAvant: unknown;
  valeurApres: unknown;
  adresseIp: string | null;
  createdAt: string;
}

export interface FiltresAudit {
  utilisateurId?: string;
  module?: string;
  action?: string;
  /** Recherche texte libre — sur l'email de l'utilisateur ou l'identifiant de l'entité concernée. */
  recherche?: string;
  /** Bornes de période sur created_at (dates au format AAAA-MM-JJ), inclusives. */
  dateDebut?: string;
  dateFin?: string;
  page: number;
  parPage: number;
}

export interface ResultatAudit {
  entrees: EntreeAudit[];
  total: number;
}
