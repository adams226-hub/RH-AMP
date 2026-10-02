// Lu une seule fois : une préférence système qui change en cours de session est un cas limite
// qu'on ignore volontairement (pas de écouteur d'évènement) — cf. .anim-cascade/.anim-barre dans
// index.css qui, eux, restent gérés en CSS pur et réagissent déjà nativement au média query.
export const reduireAnimations =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Durée d'animation Recharts (isAnimationActive/animationDuration) — 0 si l'utilisateur a demandé
// de réduire les animations, sinon la durée "sobre" demandée (200-400ms).
export function dureeAnimationGraphique(dureeMs = 400): number {
  return reduireAnimations ? 0 : dureeMs;
}
