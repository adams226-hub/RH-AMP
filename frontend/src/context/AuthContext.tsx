import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';

export type CodeRole = 'super_admin' | 'drh_holding' | 'rh_filiale' | 'chef_service' | 'employe' | 'responsable_rh_chantier';

interface PayloadJwt {
  sub: string;
  role: CodeRole;
  employeId: string | null;
}

interface ContexteAuth {
  jeton: string | null;
  role: CodeRole | null;
  employeId: string | null;
  connecte: (jeton: string) => void;
  deconnecter: () => void;
}

const ContexteAuthentification = createContext<ContexteAuth | undefined>(undefined);

const CLE_STOCKAGE = 'sirh_jeton';

function decoderPayload(jeton: string): PayloadJwt | null {
  try {
    const segment = jeton.split('.')[1];
    return JSON.parse(atob(segment));
  } catch {
    return null;
  }
}

export function FournisseurAuth({ children }: { children: ReactNode }) {
  const [jeton, setJeton] = useState<string | null>(() => localStorage.getItem(CLE_STOCKAGE));

  useEffect(() => {
    if (jeton) {
      localStorage.setItem(CLE_STOCKAGE, jeton);
    } else {
      localStorage.removeItem(CLE_STOCKAGE);
    }
  }, [jeton]);

  const payload = useMemo(() => (jeton ? decoderPayload(jeton) : null), [jeton]);

  return (
    <ContexteAuthentification.Provider
      value={{
        jeton,
        role: payload?.role ?? null,
        employeId: payload?.employeId ?? null,
        connecte: setJeton,
        deconnecter: () => setJeton(null),
      }}
    >
      {children}
    </ContexteAuthentification.Provider>
  );
}

export function useAuth() {
  const contexte = useContext(ContexteAuthentification);
  if (!contexte) {
    throw new Error('useAuth doit être utilisé sous FournisseurAuth');
  }
  return contexte;
}
