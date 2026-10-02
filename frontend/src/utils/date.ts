// Le driver PostgreSQL sérialise les colonnes DATE en horodatage ISO complet
// (ex. "2025-12-31T23:00:00.000Z") — on ne garde que la partie date, sans passer
// par un objet Date, pour éviter tout décalage de fuseau horaire.
export function formaterDateFr(iso: string): string {
  const [annee, mois, jour] = iso.slice(0, 10).split('-');
  return `${jour}/${mois}/${annee}`;
}

const MOIS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

// "2026-05" -> "Mai 2026" — pour toute étiquette de mois affichée brute ailleurs (axes de
// graphiques, en-têtes), au lieu du format ISO "AAAA-MM" peu lisible pour un utilisateur RH.
export function formaterMoisFr(periodeAAAAMM: string): string {
  const [annee, mois] = periodeAAAAMM.slice(0, 7).split('-').map(Number);
  return `${MOIS_FR[mois - 1] ?? periodeAAAAMM} ${annee}`;
}
