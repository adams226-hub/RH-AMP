import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { envoyerFile, retirerOperation, useFileEnvoi } from '../fileEnvoi';
import { prechargerHorsConnexion, useEnLigne } from '../horsConnexion';

const URL_API = import.meta.env.VITE_API_URL;
const INTERVALLE_REESSAI_MS = 30_000;

function heure(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

// Envoie automatiquement les saisies gardées hors connexion dès que le réseau revient (événement
// « online », retour sur l'application — indispensable sur iPhone, qui ne fait rien en arrière-plan —
// et nouvel essai toutes les 30 s tant qu'il en reste), et montre leur état à l'utilisateur.
export function FileEnvoiHorsConnexion() {
  const { jeton, email } = useAuth();
  const enLigne = useEnLigne();
  const operations = useFileEnvoi().filter((o) => o.proprietaire === email);
  const enAttente = operations.filter((o) => !o.refus);
  const refusees = operations.filter((o) => o.refus);

  const [ouvert, setOuvert] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sessionExpiree, setSessionExpiree] = useState(false);
  const nbPrecedent = useRef(enAttente.length);

  const envoyer = useCallback(async () => {
    if (!jeton || !navigator.onLine) return;
    const resultat = await envoyerFile(URL_API, jeton, email);
    setSessionExpiree(resultat.sessionExpiree);
    if (resultat.envoyees > 0) {
      setMessage(
        `${resultat.envoyees} saisie${resultat.envoyees > 1 ? 's envoyées' : ' envoyée'} au serveur. Actualisez la page pour les voir.`
      );
    }
  }, [jeton, email]);

  // Confirmation visible quand une saisie vient d'être gardée sur l'appareil.
  useEffect(() => {
    if (enAttente.length > nbPrecedent.current) {
      setMessage("Saisie enregistrée sur l'appareil. Elle sera envoyée automatiquement au retour du réseau.");
    }
    nbPrecedent.current = enAttente.length;
  }, [enAttente.length]);

  useEffect(() => {
    if (enLigne && enAttente.length > 0) envoyer();
  }, [enLigne, enAttente.length, envoyer]);

  useEffect(() => {
    if (jeton && enLigne) prechargerHorsConnexion(jeton);
  }, [jeton, enLigne]);

  useEffect(() => {
    if (enAttente.length === 0) return;
    const minuterie = window.setInterval(envoyer, INTERVALLE_REESSAI_MS);
    const auRetour = () => document.visibilityState === 'visible' && envoyer();
    document.addEventListener('visibilitychange', auRetour);
    return () => {
      window.clearInterval(minuterie);
      document.removeEventListener('visibilitychange', auRetour);
    };
  }, [enAttente.length, envoyer]);

  useEffect(() => {
    if (!message) return;
    const minuterie = window.setTimeout(() => setMessage(null), 8000);
    return () => window.clearTimeout(minuterie);
  }, [message]);

  if (operations.length === 0 && !message) return null;

  return (
    <div className="border-b border-slate-200 bg-white text-sm">
      {message && (
        <div className="flex items-center gap-3 bg-succes-100 px-4 py-2 text-succes-700">
          <span className="flex-1">✓ {message}</span>
          {message.includes('Actualisez') && (
            <button onClick={() => window.location.reload()} className="font-medium underline">
              Actualiser
            </button>
          )}
        </div>
      )}

      {operations.length > 0 && (
        <div className="px-4 py-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {enAttente.length > 0 && (
              <span className="font-medium text-slate-800">
                📤 {enAttente.length} saisie{enAttente.length > 1 ? 's' : ''} en attente d'envoi
              </span>
            )}
            {refusees.length > 0 && (
              <span className="font-medium text-erreur-700">
                ⚠️ {refusees.length} saisie{refusees.length > 1 ? 's refusées' : ' refusée'} par le serveur
              </span>
            )}
            <button onClick={() => setOuvert((v) => !v)} className="font-medium text-primary-700 hover:underline">
              {ouvert ? 'Masquer' : 'Voir le détail'}
            </button>
          </div>

          {sessionExpiree && (
            <p className="mt-1 text-erreur-700">
              Votre session a expiré : déconnectez-vous puis reconnectez-vous pour envoyer ces saisies (elles ne seront pas perdues).
            </p>
          )}
          {!enLigne && enAttente.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              Envoi automatique dès le retour du réseau. Sur iPhone, ouvrez l'application quand vous avez du réseau.
            </p>
          )}

          {ouvert && (
            <ul className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200">
              {operations.map((o) => (
                <li key={o.id} className="flex items-start gap-3 px-3 py-2">
                  <div className="flex-1">
                    <p className="text-slate-800">{o.libelle}</p>
                    <p className="text-xs text-slate-500">Saisie le {heure(o.creeLe)}</p>
                    {o.refus && <p className="mt-0.5 text-xs text-erreur-700">Refusée : {o.refus}</p>}
                  </div>
                  <button
                    onClick={() => {
                      const confirmation = o.refus
                        ? 'Retirer cette saisie refusée ?'
                        : "Supprimer cette saisie ? Elle ne sera jamais envoyée au serveur.";
                      if (window.confirm(confirmation)) retirerOperation(o.id);
                    }}
                    className="shrink-0 text-xs font-medium text-slate-500 hover:text-erreur-700 hover:underline"
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
