import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { dureeAnimationGraphique } from '../../utils/reducedMotion';

// Mini-courbe de tendance sans axes ni grille — juste la forme, pour une tuile KPI.
export function MiniSparkline({ valeurs, couleur }: { valeurs: number[]; couleur: string }) {
  if (valeurs.length < 2) return null;
  const donnees = valeurs.map((v, i) => ({ i, v }));

  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={donnees} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={couleur}
          strokeWidth={1.75}
          dot={false}
          animationDuration={dureeAnimationGraphique(500)}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
