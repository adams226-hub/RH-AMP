import { useEffect, useRef, useState } from 'react';
import { reduireAnimations } from '../utils/reducedMotion';

// Anime un nombre entier de sa valeur précédente vers sa nouvelle valeur cible (ex. au premier
// chargement d'un KPI, ou quand un filtre change la valeur). Respecte prefers-reduced-motion en
// affichant directement la cible, sans animation.
export function useCompteurAnime(cible: number, dureeMs = 600): number {
  const [valeur, setValeur] = useState(cible);
  const depart = useRef(cible);

  useEffect(() => {
    if (reduireAnimations) {
      setValeur(cible);
      depart.current = cible;
      return;
    }

    const valeurDepart = depart.current;
    const ecart = cible - valeurDepart;
    if (ecart === 0) return;

    const debut = performance.now();
    let frame: number;

    function animer(maintenant: number) {
      const t = Math.min(1, (maintenant - debut) / dureeMs);
      // Easing "ease-out" — démarre vite, ralentit en fin de course, cohérent avec le reste des
      // transitions de l'appli (cf. transition-all ease-in-out ailleurs).
      const t2 = 1 - (1 - t) * (1 - t);
      setValeur(Math.round(valeurDepart + ecart * t2));
      if (t < 1) frame = requestAnimationFrame(animer);
      else depart.current = cible;
    }

    frame = requestAnimationFrame(animer);
    return () => cancelAnimationFrame(frame);
  }, [cible, dureeMs]);

  return valeur;
}
