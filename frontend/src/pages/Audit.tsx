import { useEffect, useState } from 'react';
import { ErreurApi, api } from '../api/client';
import { AccesRestreint } from '../components/AccesRestreint';
import { Badge, CouleurBadge } from '../components/Badge';
import { EtatVide } from '../components/EtatVide';
import { IconeAudit } from '../components/icones';
import { FiltreSelect } from '../components/FiltreSelect';
import { MiseEnPage } from '../components/MiseEnPage';
import { Modale } from '../components/Modale';
import { Pagination } from '../components/Pagination';
import { useAuth } from '../context/AuthContext';
import { EntreeAudit } from '../types/audit';

const PAR_PAGE = 25;

const MODULES = ['employes', 'contrats', 'conges', 'pointage', 'paie', 'archivage', 'postes', 'auth', 'audit'];
const ACTIONS = ['creation', 'modification', 'suppression', 'connexion', 'connexion_echouee'];

const COULEURS_ACTION: Record<string, CouleurBadge> = {
  creation: 'succes',
  modification: 'primary',
  suppression: 'erreur',
  connexion: 'accent',
  connexion_echouee: 'alerte',
};

const LIBELLES_ACTION: Record<string, string> = {
  creation: 'Création',
  modification: 'Modification',
  suppression: 'Suppression',
  connexion: 'Connexion',
  connexion_echouee: 'Connexion échouée',
};

function formaterHorodatage(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

export function Audit() {
  const { jeton, role } = useAuth();

  const [entrees, setEntrees] = useState<EntreeAudit[]>([]);
  const [total, setTotal] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [page, setPage] = useState(1);
  const [filtreModule, setFiltreModule] = useState('');
  const [filtreAction, setFiltreAction] = useState('');
  const [entreeSelectionnee, setEntreeSelectionnee] = useState<EntreeAudit | null>(null);

  useEffect(() => {
    if (!jeton || role !== 'super_admin') return;
    setChargement(true);
    api
      .listerJournalAudit(jeton, { page, parPage: PAR_PAGE, module: filtreModule || undefined, action: filtreAction || undefined })
      .then((r) => {
        setEntrees(r.entrees);
        setTotal(r.total);
      })
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : 'Erreur de chargement'))
      .finally(() => setChargement(false));
  }, [jeton, role, page, filtreModule, filtreAction]);

  useEffect(() => setPage(1), [filtreModule, filtreAction]);

  if (role !== null && role !== 'super_admin') {
    return <AccesRestreint />;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAR_PAGE));

  return (
    <MiseEnPage>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Journal d'audit</h2>
      <p className="mb-6 text-sm text-slate-500">{total} action(s) enregistrée(s)</p>

      {erreur && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FiltreSelect
          valeur={filtreModule}
          onChange={setFiltreModule}
          toutLibelle="Tous les modules"
          options={MODULES.map((m) => ({ valeur: m, libelle: m }))}
        />
        <FiltreSelect
          valeur={filtreAction}
          onChange={setFiltreAction}
          toutLibelle="Toutes les actions"
          options={ACTIONS.map((a) => ({ valeur: a, libelle: LIBELLES_ACTION[a] }))}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {chargement ? (
          <div className="space-y-3 p-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : entrees.length > 0 ? (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Quand</th>
                  <th className="px-4 py-3">Qui</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Adresse IP</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entrees.map((e) => (
                  <tr key={e.id} className="transition-colors duration-200 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{formaterHorodatage(e.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-700">{e.utilisateurEmail ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{e.module}</td>
                    <td className="px-4 py-3">
                      <Badge couleur={COULEURS_ACTION[e.action] ?? 'slate'}>{LIBELLES_ACTION[e.action] ?? e.action}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.adresseIp ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {(e.valeurApres !== null || e.valeurAvant !== null) && (
                        <button
                          onClick={() => setEntreeSelectionnee(e)}
                          className="font-medium text-primary-700 transition-colors duration-200 hover:underline"
                        >
                          Détail
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} totalItems={total} parPage={PAR_PAGE} />
          </>
        ) : (
          <EtatVide icone={<IconeAudit />} titre="Aucune action enregistrée" message="Le journal se remplit au fil des actions effectuées dans le SIRH." />
        )}
      </div>

      {entreeSelectionnee && (
        <Modale titre="Détail de l'action" onFermer={() => setEntreeSelectionnee(null)}>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Entité</p>
              <p className="font-mono text-xs text-slate-700">{entreeSelectionnee.entiteId ?? '—'}</p>
            </div>
            {entreeSelectionnee.valeurAvant !== null && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Avant</p>
                <pre className="max-h-40 overflow-auto rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                  {JSON.stringify(entreeSelectionnee.valeurAvant, null, 2)}
                </pre>
              </div>
            )}
            {entreeSelectionnee.valeurApres !== null && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Après</p>
                <pre className="max-h-40 overflow-auto rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                  {JSON.stringify(entreeSelectionnee.valeurApres, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Modale>
      )}
    </MiseEnPage>
  );
}
