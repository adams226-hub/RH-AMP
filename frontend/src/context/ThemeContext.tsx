import { ReactNode, createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'clair' | 'sombre';

interface ContexteTheme {
  theme: Theme;
  basculerTheme: () => void;
}

const ContexteThemeApp = createContext<ContexteTheme | undefined>(undefined);

const CLE_STOCKAGE = 'sirh_theme';

function themeInitial(): Theme {
  const stocke = localStorage.getItem(CLE_STOCKAGE);
  if (stocke === 'clair' || stocke === 'sombre') return stocke;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair';
}

export function FournisseurTheme({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(themeInitial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'sombre');
    localStorage.setItem(CLE_STOCKAGE, theme);
  }, [theme]);

  return (
    <ContexteThemeApp.Provider
      value={{
        theme,
        basculerTheme: () => setTheme((t) => (t === 'clair' ? 'sombre' : 'clair')),
      }}
    >
      {children}
    </ContexteThemeApp.Provider>
  );
}

export function useTheme() {
  const contexte = useContext(ContexteThemeApp);
  if (!contexte) {
    throw new Error('useTheme doit être utilisé sous FournisseurTheme');
  }
  return contexte;
}
