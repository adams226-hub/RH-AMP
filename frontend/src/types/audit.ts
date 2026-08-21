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

export interface ResultatAudit {
  entrees: EntreeAudit[];
  total: number;
}
