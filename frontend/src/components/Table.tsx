import { ReactNode } from 'react';
import { Card } from './Card';

interface Props {
  chargement: boolean;
  vide: boolean;
  etatVide: ReactNode;
  children: ReactNode;
  pied?: ReactNode;
}

// Wrapper générique pour les pages à tableau : même carte, même squelette de chargement, même
// état vide partout — le <table> (en-têtes/lignes) reste propre à chaque page, construit avec les
// composants déjà partagés (EnTeteTriable, Badge...). `overflow-x-auto` assure un défilement
// horizontal propre sur petit écran sans casser le reste de la mise en page.
export function Table({ chargement, vide, etatVide, children, pied }: Props) {
  return (
    <Card className="overflow-hidden">
      {chargement ? (
        <div className="space-y-3 p-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ) : vide ? (
        etatVide
      ) : (
        <>
          <div className="overflow-x-auto">{children}</div>
          {pied}
        </>
      )}
    </Card>
  );
}
