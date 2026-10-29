// Intervalle de vérification d'une nouvelle version pendant que l'application reste ouverte : le
// navigateur ne la vérifie de lui-même qu'au chargement complet d'une page, ce qui n'arrive
// presque jamais dans une application React ouverte toute la journée.
const INTERVALLE_VERIFICATION_MS = 30 * 60 * 1000;

// Après un déploiement, le service worker (registerType autoUpdate, vite.config.ts) prend le
// contrôle de la page, mais celle-ci garde l'ancien code tant qu'elle n'est pas rechargée. On
// recharge donc au moment le moins gênant — onglet en arrière-plan ou prochain changement de page
// dans l'application — pour ne jamais faire perdre une saisie en cours.
export function activerMiseAJourAutomatique() {
  if (!('serviceWorker' in navigator)) return;

  // Première visite : le service worker prend le contrôle sans qu'il y ait de nouvelle version —
  // ce premier changement ne doit pas déclencher de rechargement.
  let dejaControlee = navigator.serviceWorker.controller !== null;
  let nouvelleVersion = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!dejaControlee) {
      dejaControlee = true;
      return;
    }
    nouvelleVersion = true;
    if (document.visibilityState === 'hidden') window.location.reload();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && nouvelleVersion) window.location.reload();
  });

  // react-router change de page via history.pushState : on recharge juste après, sur la nouvelle
  // adresse, puisque la page quittée n'a plus de saisie à préserver.
  const pushStateOriginal = history.pushState.bind(history);
  history.pushState = (...args: Parameters<History['pushState']>) => {
    pushStateOriginal(...args);
    if (nouvelleVersion) window.location.reload();
  };

  navigator.serviceWorker.ready.then((enregistrement) => {
    const verifier = () => enregistrement.update().catch(() => undefined);
    setInterval(verifier, INTERVALLE_VERIFICATION_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') verifier();
    });
  });
}
