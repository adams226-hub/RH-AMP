import { useEffect, useState } from 'react';
import { CLE_DERNIERE_SYNCHRO, api } from './api/client';

// Nom du cache des lectures API — doit rester identique à cacheName dans vite.config.ts.
const CACHE_API = 'rh-amp-api';

// Efface du téléphone les données gardées pour la consultation hors connexion (fiches employés,
// demandes...). Appelé à la connexion et à la déconnexion : un appareil prêté ou partagé ne doit
// jamais montrer les données du compte précédent.
export function effacerDonneesHorsConnexion() {
  try {
    localStorage.removeItem(CLE_DERNIERE_SYNCHRO);
  } catch {
    // stockage indisponible : rien à effacer
  }
  if ('caches' in window) caches.delete(CACHE_API).catch(() => undefined);
}

let jetonPrecharge: string | null = null;

// Avec du réseau, charge une fois par session les listes dont la saisie hors connexion a besoin
// (employés pour le sélecteur, chantiers pour le pointage) : elles passent ainsi dans le cache du
// service worker même si l'utilisateur n'a pas ouvert ces pages avant la coupure.
export function prechargerHorsConnexion(jeton: string) {
  if (!navigator.onLine || jetonPrecharge === jeton) return;
  jetonPrecharge = jeton;
  api.listerEmployes(jeton).catch(() => undefined);
  api.listerChantiers(jeton).catch(() => undefined);
}

export function useEnLigne(): boolean {
  const [enLigne, setEnLigne] = useState(() => navigator.onLine);

  useEffect(() => {
    const passerEnLigne = () => setEnLigne(true);
    const passerHorsLigne = () => setEnLigne(false);
    window.addEventListener('online', passerEnLigne);
    window.addEventListener('offline', passerHorsLigne);
    return () => {
      window.removeEventListener('online', passerEnLigne);
      window.removeEventListener('offline', passerHorsLigne);
    };
  }, []);

  return enLigne;
}

export function lireDerniereSynchro(): Date | null {
  try {
    const valeur = localStorage.getItem(CLE_DERNIERE_SYNCHRO);
    return valeur ? new Date(valeur) : null;
  } catch {
    return null;
  }
}
