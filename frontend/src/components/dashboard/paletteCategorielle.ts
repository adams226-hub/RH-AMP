// Palette catégorielle à ordre fixe — huit teintes validées (séparation CVD ≥ 8 ΔE
// entre paires adjacentes). Utilisée pour toute série par identité (société, motif...),
// jamais pour une magnitude seule (cf. skill dataviz : catégoriel = identité, jamais rang).
export const PALETTE_CATEGORIELLE = [
  '#2a78d6', // bleu — cohérent avec le bleu primaire de l'app
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // jaune
  '#e87ba4', // magenta
  '#008300', // vert
  '#4a3aa7', // violet
  '#e34948', // rouge
];

export function couleurPour(index: number): string {
  return PALETTE_CATEGORIELLE[index % PALETTE_CATEGORIELLE.length];
}
