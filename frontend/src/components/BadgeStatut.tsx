import { StatutEmploye } from '../types/employe';
import { Badge, CouleurBadge } from './Badge';

const COULEURS: Record<StatutEmploye, CouleurBadge> = {
  actif: 'succes',
  en_cours_creation: 'primary',
  suspendu: 'alerte',
  sorti: 'slate',
};

const LIBELLES: Record<StatutEmploye, string> = {
  actif: 'Actif',
  en_cours_creation: 'En cours de création',
  suspendu: 'Suspendu',
  sorti: 'Sorti',
};

export function BadgeStatut({ statut }: { statut: StatutEmploye }) {
  return <Badge couleur={COULEURS[statut]}>{LIBELLES[statut]}</Badge>;
}
