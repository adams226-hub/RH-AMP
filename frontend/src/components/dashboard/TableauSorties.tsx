import { useEffect, useMemo, useState } from 'react';
import { ChampRecherche } from '../ChampRecherche';
import { EnTeteTriable } from '../EnTeteTriable';
import { EtatVide } from '../EtatVide';
import { FiltreSelect } from '../FiltreSelect';
import { IconeEmployes } from '../icones';
import { Pagination } from '../Pagination';
import { useTri } from '../../hooks/useTri';
import { SortieDetail } from '../../types/tableauDeBord';
import { formaterDateFr } from '../../utils/date';

const PAR_PAGE = 8;

export function TableauSorties({ details }: { details: SortieDetail[] }) {
  const [recherche, setRecherche] = useState('');
  const [filtreMotif, setFiltreMotif] = useState('');
  const [page, setPage] = useState(1);

  const motifs = useMemo(() => {
    const uniques = new Set(details.map((d) => d.motifSortie?.trim() || 'Non renseigné'));
    return [...uniques].sort();
  }, [details]);

  const filtres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return details.filter((d) => {
      const motif = d.motifSortie?.trim() || 'Non renseigné';
      if (filtreMotif && motif !== filtreMotif) return false;
      if (terme) {
        const cible = `${d.matricule} ${d.nom} ${d.prenoms}`.toLowerCase();
        if (!cible.includes(terme)) return false;
      }
      return true;
    });
  }, [details, recherche, filtreMotif]);

  const { trie, cle, sens, trierPar } = useTri<SortieDetail>(filtres, 'dateSortie');
  const totalPages = Math.max(1, Math.ceil(trie.length / PAR_PAGE));
  const pageBornee = Math.min(page, totalPages);
  const pageAffichee = trie.slice((pageBornee - 1) * PAR_PAGE, pageBornee * PAR_PAGE);

  useEffect(() => setPage(1), [recherche, filtreMotif]);

  return (
    <div className="anim-cascade overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
        <h3 className="mr-auto text-sm font-semibold text-slate-800">Détail des sorties ({trie.length})</h3>
        <div className="min-w-[180px]">
          <ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Nom, matricule…" />
        </div>
        <FiltreSelect
          valeur={filtreMotif}
          onChange={setFiltreMotif}
          toutLibelle="Tous les motifs"
          options={motifs.map((m) => ({ valeur: m, libelle: m }))}
        />
      </div>

      {trie.length > 0 ? (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <EnTeteTriable label="Employé" cleColonne="nom" cleActive={cle} sens={sens} onTrier={trierPar} />
                <th className="px-4 py-3">Filiale</th>
                <EnTeteTriable label="Date de sortie" cleColonne="dateSortie" cleActive={cle} sens={sens} onTrier={trierPar} />
                <th className="px-4 py-3">Motif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageAffichee.map((d) => (
                <tr key={d.id} className="transition-colors duration-200 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {d.nom} {d.prenoms}
                    <div className="font-mono text-xs font-normal text-slate-400">{d.matricule}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{d.filiale}</td>
                  <td className="px-4 py-3">{formaterDateFr(d.dateSortie)}</td>
                  <td className="px-4 py-3 text-slate-600">{d.motifSortie ?? 'Non renseigné'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={pageBornee} totalPages={totalPages} onChange={setPage} totalItems={trie.length} parPage={PAR_PAGE} />
        </>
      ) : (
        <EtatVide
          icone={<IconeEmployes />}
          titre={details.length === 0 ? 'Aucune sortie sur la période' : 'Aucun résultat'}
          message={details.length === 0 ? "C'est plutôt bon signe." : 'Aucune sortie ne correspond à votre recherche ou votre filtre.'}
        />
      )}
    </div>
  );
}
