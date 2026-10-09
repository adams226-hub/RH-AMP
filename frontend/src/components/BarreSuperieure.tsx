import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { CodeRole, useAuth } from '../context/AuthContext';
import { Filiale } from '../types/postes';
import { GROUPES } from '../nav';
import { IconeChevronBas, IconeDeconnexion, IconeMenu } from './icones';

// Libellés affichés sous le nom dans la barre supérieure — distincts des libellés de l'écran
// d'administration des comptes (ex. "Super Admin" y reste inchangé) : ici on vise un intitulé
// plus parlant pour l'utilisateur lui-même, pas un terme technique interne.
const LIBELLES_ROLE_AFFICHAGE: Record<CodeRole, string> = {
  super_admin: 'Administrateur',
  drh_holding: 'DRH Holding',
  rh_filiale: 'RH Filiale',
  chef_service: 'Chef de service',
  employe: 'Employé',
  responsable_rh_chantier: 'Responsable RH Chantier',
};

// Sélecteur visuel uniquement pour l'instant — ne filtre aucune page (décision produit prise avec
// l'utilisateur lors de la refonte visuelle). Le branchement réel sur chaque page viendra dans une
// tâche séparée pour ne pas mélanger refonte d'interface et logique métier.
function SelecteurFiliale() {
  const { jeton } = useAuth();
  const [filiales, setFiliales] = useState<Filiale[]>([]);
  const [filialeId, setFilialeId] = useState('');

  useEffect(() => {
    if (!jeton) return;
    api.listerFiliales(jeton).then(setFiliales);
  }, [jeton]);

  if (filiales.length === 0) return null;

  return (
    <select
      value={filialeId}
      onChange={(e) => setFilialeId(e.target.value)}
      title="Filiale (affichage uniquement pour l'instant)"
      className="w-28 max-w-[40vw] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none transition-colors duration-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 sm:w-auto sm:max-w-none sm:px-2.5"
    >
      <option value="">Toutes les filiales</option>
      {filiales.map((f) => (
        <option key={f.id} value={f.id}>
          {f.nom}
        </option>
      ))}
    </select>
  );
}

function MenuUtilisateur() {
  const { email, nom, prenoms, role, deconnecter } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  const conteneurRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function surClicExterieur(e: MouseEvent) {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) {
        setOuvert(false);
      }
    }
    document.addEventListener('mousedown', surClicExterieur);
    return () => document.removeEventListener('mousedown', surClicExterieur);
  }, []);

  const nomComplet = prenoms && nom ? `${prenoms} ${nom}` : null;
  const libelleAffiche = nomComplet ?? email ?? 'Utilisateur';
  const initiales = nomComplet
    ? `${prenoms!.charAt(0)}${nom!.charAt(0)}`.toUpperCase()
    : (email ?? '?').charAt(0).toUpperCase();
  const libelleRole = role ? LIBELLES_ROLE_AFFICHAGE[role] : null;

  return (
    <div ref={conteneurRef} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 transition-colors duration-200 hover:bg-slate-100"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
          {initiales}
        </span>
        <span className="hidden max-w-[160px] truncate sm:inline">{libelleAffiche}</span>
        <IconeChevronBas className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {ouvert && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="truncate text-sm font-medium text-slate-800">{libelleAffiche}</p>
            {libelleRole && <p className="text-xs text-slate-400">{libelleRole}</p>}
            {nomComplet && email && <p className="mt-0.5 truncate text-xs text-slate-400">{email}</p>}
          </div>
          <button
            type="button"
            onClick={deconnecter}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-600 transition-colors duration-200 hover:bg-red-50 hover:text-erreur-600"
          >
            <IconeDeconnexion className="h-4 w-4 shrink-0" />
            Déconnexion
          </button>
        </div>
      )}
    </div>
  );
}

export function BarreSuperieure({ onOuvrirMenu }: { onOuvrirMenu: () => void }) {
  const { pathname } = useLocation();
  let pageActive: { groupeTitre: string; libelle: string } | null = null;
  for (const groupe of GROUPES) {
    const lien = groupe.liens.find((l) => pathname.startsWith(l.vers));
    if (lien) {
      pageActive = { groupeTitre: groupe.titre, libelle: lien.libelle };
      break;
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 sm:gap-3 sm:px-8">
      <div className="flex min-w-0 items-center gap-1">
        {/* Bouton hamburger — ouvre le tiroir de MiseEnPage, visible uniquement sous md (la
            sidebar est statique à partir de là, plus besoin de l'ouvrir). */}
        <button
          type="button"
          onClick={onOuvrirMenu}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors duration-200 hover:bg-slate-100 md:hidden"
          aria-label="Ouvrir le menu"
        >
          <IconeMenu className="h-5 w-5" />
        </button>
        <nav aria-label="Fil d'Ariane" className="min-w-0 truncate text-sm text-slate-500">
          <span>Accueil</span>
          {pageActive && (
            <>
              {pageActive.groupeTitre !== 'Accueil' && (
                <>
                  <span className="mx-1.5 text-slate-300">›</span>
                  <span>{pageActive.groupeTitre}</span>
                </>
              )}
              <span className="mx-1.5 text-slate-300">›</span>
              <span className="font-medium text-slate-800">{pageActive.libelle}</span>
            </>
          )}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <SelecteurFiliale />
        <MenuUtilisateur />
      </div>
    </header>
  );
}
