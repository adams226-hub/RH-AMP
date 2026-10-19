import { lireDerniereSynchro, useEnLigne } from '../horsConnexion';

function formaterDate(date: Date): string {
  const jour = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  const heure = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${jour} à ${heure}`;
}

// Affiché uniquement sans réseau : les pages montrent alors les dernières données reçues (cache du
// service worker) ; les saisies autorisées hors connexion partent dans la file d'envoi, les autres
// actions sont refusées avec un message (cf. api/client.ts).
export function BandeauHorsConnexion() {
  const enLigne = useEnLigne();
  if (enLigne) return null;

  const derniereSynchro = lireDerniereSynchro();

  return (
    <div role="status" className="bg-alerte-100 px-4 py-2 text-center text-sm font-medium text-alerte-700">
      Hors connexion
      {derniereSynchro ? ` — données du ${formaterDate(derniereSynchro)}` : ''}. Pointage, employés, congés,
      absences et missions : vos saisies sont gardées sur l'appareil et envoyées au retour du réseau.
    </div>
  );
}
