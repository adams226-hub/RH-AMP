import { useEffect, useState } from 'react';

// File d'envoi hors connexion : les saisies faites sans réseau (pointage, employés, congés,
// absences, missions) sont gardées sur l'appareil puis rejouées dans l'ordre, telles quelles, vers
// l'API dès que le réseau revient. Le serveur reste seul juge : une saisie qu'il refuse (doublon,
// chevauchement, cycle clôturé...) reste visible avec son message pour que l'utilisateur la retire.

export interface OperationEnAttente {
  id: string;
  chemin: string;
  methode: 'POST' | 'PUT' | 'PATCH';
  corps?: string;
  libelle: string; // affiché à l'utilisateur, ex. « Pointage — KABORE Paul (octobre 2026) »
  cle?: string; // même clé = même saisie : la plus récente remplace l'ancienne (ex. une fiche de pointage)
  proprietaire: string | null; // e-mail du compte qui a saisi : seul lui peut l'envoyer
  creeLe: string;
  refus?: string; // message du serveur si l'envoi a été refusé
}

const CLE_STOCKAGE = 'rh_amp_file_envoi';
const EVENEMENT = 'rh-amp-file-envoi';

function lire(): OperationEnAttente[] {
  try {
    return JSON.parse(localStorage.getItem(CLE_STOCKAGE) ?? '[]');
  } catch {
    return [];
  }
}

function ecrire(operations: OperationEnAttente[]) {
  localStorage.setItem(CLE_STOCKAGE, JSON.stringify(operations));
  window.dispatchEvent(new Event(EVENEMENT));
}

export function listerOperations(): OperationEnAttente[] {
  return lire();
}

export function mettreEnFile(operation: Omit<OperationEnAttente, 'id' | 'creeLe' | 'proprietaire'>) {
  const proprietaire = localStorage.getItem('sirh_email'); // clé de AuthContext (CLE_STOCKAGE_EMAIL)
  const autres = lire().filter((o) => !operation.cle || o.cle !== operation.cle);
  ecrire([
    ...autres,
    { ...operation, id: crypto.randomUUID(), creeLe: new Date().toISOString(), proprietaire },
  ]);
}

export function retirerOperation(id: string) {
  ecrire(lire().filter((o) => o.id !== id));
}

export function nbOperationsEnAttenteDe(email: string | null): number {
  return lire().filter((o) => o.proprietaire === email && !o.refus).length;
}

export function operationAvecCle(cle: string): OperationEnAttente | undefined {
  return lire().find((o) => o.cle === cle && !o.refus);
}

let envoiEnCours = false;

// Rejoue la file dans l'ordre. S'arrête à la première coupure réseau (on réessaiera plus tard) ou
// si la session a expiré (401 : il faut se reconnecter).
export async function envoyerFile(
  urlApi: string,
  jeton: string,
  email: string | null
): Promise<{ envoyees: number; sessionExpiree: boolean }> {
  if (envoiEnCours || !navigator.onLine) return { envoyees: 0, sessionExpiree: false };
  envoiEnCours = true;
  let envoyees = 0;
  let sessionExpiree = false;
  try {
    for (const operation of lire()) {
      if (operation.refus || operation.proprietaire !== email) continue;

      let reponse: Response;
      try {
        reponse = await fetch(`${urlApi}${operation.chemin}`, {
          method: operation.methode,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
          body: operation.corps,
        });
      } catch {
        break; // réseau encore instable : on garde tout pour la prochaine tentative
      }

      if (reponse.status === 401) {
        sessionExpiree = true;
        break;
      }

      if (reponse.ok) {
        retirerOperation(operation.id);
        envoyees += 1;
      } else {
        const corps = await reponse.json().catch(() => ({ erreur: reponse.statusText }));
        ecrire(lire().map((o) => (o.id === operation.id ? { ...o, refus: corps.erreur ?? 'Refusé par le serveur' } : o)));
      }
    }
  } finally {
    envoiEnCours = false;
  }
  return { envoyees, sessionExpiree };
}

export function useFileEnvoi(): OperationEnAttente[] {
  const [operations, setOperations] = useState(lire);

  useEffect(() => {
    const maj = () => setOperations(lire());
    window.addEventListener(EVENEMENT, maj);
    window.addEventListener('storage', maj); // autre onglet
    return () => {
      window.removeEventListener(EVENEMENT, maj);
      window.removeEventListener('storage', maj);
    };
  }, []);

  return operations;
}
