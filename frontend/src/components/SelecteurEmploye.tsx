import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Employe } from '../types/employe';

interface Props {
  valeur: string;
  onChange: (employeId: string) => void;
}

function libelle(e: Employe): string {
  return `${e.nom} ${e.prenoms} (${e.matricule})`;
}

// Saisie progressive plutôt qu'une liste déroulante complète : avec des milliers d'employés,
// charger tout le monde d'un coup et faire défiler une liste géante n'est pas praticable —
// on ne demande au serveur que les correspondances du texte tapé.
export function SelecteurEmploye({ valeur, onChange }: Props) {
  const { jeton } = useAuth();
  const [texte, setTexte] = useState('');
  const [resultats, setResultats] = useState<Employe[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [chargement, setChargement] = useState(false);
  const conteneurRef = useRef<HTMLDivElement>(null);

  // Affiche le libellé de l'employé déjà sélectionné (ex. fiche rechargée) sans que l'utilisateur
  // n'ait retapé sa recherche.
  useEffect(() => {
    if (!jeton || !valeur) {
      setTexte('');
      return;
    }
    api.obtenirEmploye(jeton, valeur).then((e) => setTexte(libelle(e)));
  }, [jeton, valeur]);

  useEffect(() => {
    if (!jeton || !ouvert || texte.trim().length < 2) {
      setResultats([]);
      return;
    }
    setChargement(true);
    const identifiant = setTimeout(() => {
      api
        .rechercherEmployes(jeton, texte.trim())
        .then(setResultats)
        .finally(() => setChargement(false));
    }, 250);
    return () => clearTimeout(identifiant);
  }, [jeton, texte, ouvert]);

  useEffect(() => {
    function surClicExterieur(e: MouseEvent) {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) {
        setOuvert(false);
      }
    }
    document.addEventListener('mousedown', surClicExterieur);
    return () => document.removeEventListener('mousedown', surClicExterieur);
  }, []);

  function choisir(e: Employe) {
    onChange(e.id);
    setTexte(libelle(e));
    setOuvert(false);
  }

  return (
    <div ref={conteneurRef} className="relative">
      <input
        value={texte}
        onChange={(e) => {
          setTexte(e.target.value);
          setOuvert(true);
          if (valeur) onChange('');
        }}
        onFocus={() => setOuvert(true)}
        placeholder="Rechercher un employé, matricule…"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
      />
      {valeur && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            setTexte('');
          }}
          aria-label="Effacer"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          ×
        </button>
      )}

      {ouvert && texte.trim().length >= 2 && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {chargement ? (
            <div className="px-3 py-2 text-sm text-slate-400">Recherche...</div>
          ) : resultats.length > 0 ? (
            resultats.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => choisir(e)}
                className="block w-full px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-primary-50"
              >
                {e.nom} {e.prenoms}
                <span className="ml-1 font-mono text-xs text-slate-400">{e.matricule}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-slate-400">Aucun résultat</div>
          )}
        </div>
      )}
    </div>
  );
}
