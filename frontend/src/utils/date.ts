// Le driver PostgreSQL sérialise les colonnes DATE en horodatage ISO complet
// (ex. "2025-12-31T23:00:00.000Z") — on ne garde que la partie date, sans passer
// par un objet Date, pour éviter tout décalage de fuseau horaire.
export function formaterDateFr(iso: string): string {
  const [annee, mois, jour] = iso.slice(0, 10).split('-');
  return `${jour}/${mois}/${annee}`;
}
