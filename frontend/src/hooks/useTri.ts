import { useMemo, useState } from 'react';

type Sens = 'asc' | 'desc';

export function useTri<T>(items: T[], cleParDefaut: keyof T | null = null) {
  const [cle, setCle] = useState<keyof T | null>(cleParDefaut);
  const [sens, setSens] = useState<Sens>('asc');

  function trierPar(nouvelleCle: keyof T) {
    if (cle === nouvelleCle) {
      setSens((s) => (s === 'asc' ? 'desc' : 'asc'));
    } else {
      setCle(nouvelleCle);
      setSens('asc');
    }
  }

  const trie = useMemo(() => {
    if (!cle) return items;

    return [...items].sort((a, b) => {
      const va = a[cle];
      const vb = b[cle];
      const comparaison = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sens === 'asc' ? comparaison : -comparaison;
    });
  }, [items, cle, sens]);

  return { trie, cle, sens, trierPar };
}
