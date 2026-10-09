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
  email: string | null;
  nom: string | null;
  prenoms: string | null;
  connecte: (jeton: string, email: string, nom: string | null, prenoms: string | null) => void;
  deconnecter: () => void;
}

const ContexteAuthentification = createContext<ContexteAuth | undefined>(undefined);

const CLE_STOCKAGE = 'sirh_jeton';
// Le JWT ne porte que l'id utilisateur et le rôle (pas d'email/nom) — mémorisés à part au login
// pour l'affichage dans la barre supérieure, sans appel backend supplémentaire. Comme pour l'email,
// un changement de nom après coup ne se reflète qu'à la prochaine connexion (limitation acceptée,
// cohérente avec le fonctionnement déjà en place).
const CLE_STOCKAGE_EMAIL = 'sirh_email';
const CLE_STOCKAGE_NOM = 'sirh_nom';
const CLE_STOCKAGE_PRENOMS = 'sirh_prenoms';

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
  const [email, setEmail] = useState<string | null>(() => localStorage.getItem(CLE_STOCKAGE_EMAIL));
  const [nom, setNom] = useState<string | null>(() => localStorage.getItem(CLE_STOCKAGE_NOM));
  const [prenoms, setPrenoms] = useState<string | null>(() => localStorage.getItem(CLE_STOCKAGE_PRENOMS));

  useEffect(() => {
    if (jeton) {
      localStorage.setItem(CLE_STOCKAGE, jeton);
    } else {
      localStorage.removeItem(CLE_STOCKAGE);
    }
  }, [jeton]);

  useEffect(() => {
    if (email) {
      localStorage.setItem(CLE_STOCKAGE_EMAIL, email);
    } else {
      localStorage.removeItem(CLE_STOCKAGE_EMAIL);
    }
  }, [email]);

  useEffect(() => {
    if (nom) {
      localStorage.setItem(CLE_STOCKAGE_NOM, nom);
    } else {
      localStorage.removeItem(CLE_STOCKAGE_NOM);
    }
  }, [nom]);

  useEffect(() => {
    if (prenoms) {
      localStorage.setItem(CLE_STOCKAGE_PRENOMS, prenoms);
    } else {
      localStorage.removeItem(CLE_STOCKAGE_PRENOMS);
    }
  }, [prenoms]);

  const payload = useMemo(() => (jeton ? decoderPayload(jeton) : null), [jeton]);

  return (
    <ContexteAuthentification.Provider
      value={{
        jeton,
        role: payload?.role ?? null,
        employeId: payload?.employeId ?? null,
        email,
        nom,
        prenoms,
        connecte: (nouveauJeton, nouvelEmail, nouveauNom, nouveauxPrenoms) => {
          setJeton(nouveauJeton);
          setEmail(nouvelEmail);
          setNom(nouveauNom);
          setPrenoms(nouveauxPrenoms);
        },
        deconnecter: () => {
          setJeton(null);
          setEmail(null);
          setNom(null);
          setPrenoms(null);
        },
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
