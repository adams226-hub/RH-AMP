import { useEffect, useState } from 'react';
import { ErreurApi, api } from '../api/client';
import { Badge, CouleurBadge } from '../components/Badge';
import { FiltreSelect } from '../components/FiltreSelect';
import { IconeCyclePaie } from '../components/icones';
import { MiseEnPage } from '../components/MiseEnPage';
import { useAuth } from '../context/AuthContext';
import { Filiale } from '../types/postes';
import { Chantier } from '../types/pointage';
import { CyclePaie as CycleMensuel, ResumeCyclePaie, StatutCyclePaie } from '../types/cyclesPaie';
import { OPTIONS_MODE_PAIEMENT } from '../types/employe';

function formaterDateFr(date: string | null): string {
  return date ? new Date(date).toLocaleDateString('fr-FR') : '-';
}

function formaterFCFA(montant: number) {
  return `${montant.toLocaleString('fr-FR')} F CFA`;
}

const CHAMP =
  'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';
const LABEL = 'mb-1 block text-xs font-medium text-slate-600';
const BOUTON =
  'rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-800 hover:shadow-md disabled:pointer-events-none disabled:opacity-60';
const BOUTON_SECONDAIRE =
  'rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-60';

const LIBELLES_STATUT: Record<StatutCyclePaie, string> = {
  ouvert: 'Ouvert',
  calcule: 'Calculé',
  verifie: 'Vérifié',
  exporte: 'Exporté',
  cloture: 'Clôturé',
};

const COULEURS_STATUT: Record<StatutCyclePaie, CouleurBadge> = {
  ouvert: 'slate',
  calcule: 'primary',
  verifie: 'accent',
  exporte: 'succes',
  cloture: 'erreur',
};

const ROLES_GESTION = ['super_admin', 'drh_holding', 'rh_filiale'];
const ROLES_ADMIN_DAF = ['super_admin', 'drh_holding'];

export function CyclePaie() {
  const { jeton, role } = useAuth();
  const peutGerer = role !== null && ROLES_GESTION.includes(role);
  const peutReouvrir = role !== null && ROLES_ADMIN_DAF.includes(role);

  const [filiales, setFiliales] = useState<Filiale[]>([]);
  const [filialeId, setFilialeId] = useState('');
  const [periode, setPeriode] = useState(() => new Date().toISOString().slice(0, 7));
  const [resume, setResume] = useState<ResumeCyclePaie | null>(null);
  const [chargement, setChargement] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const [cycles, setCycles] = useState<CycleMensuel[]>([]);
  const [filtreFiliale, setFiltreFiliale] = useState('');
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [filtreChantier, setFiltreChantier] = useState('');

  // Filtres appliqués au Journal de Paie téléchargé (distincts du filtre de la liste des cycles
  // ci-dessus) — restreignent les lignes du fichier, pas juste l'affichage de l'écran.
  const [exportModePaiement, setExportModePaiement] = useState('');
  const [exportChantierId, setExportChantierId] = useState('');

  useEffect(() => {
    if (!jeton) return;
    api.listerFiliales(jeton).then((liste) => {
      setFiliales(liste);
      if (!filialeId && liste.length > 0) setFilialeId(liste[0].id);
    });
    api.listerChantiers(jeton).then(setChantiers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jeton]);

  function rafraichir() {
    if (!jeton || !filialeId) return;
    setChargement(true);
    setErreur(null);
    api
      .obtenirResumeCyclePaie(jeton, filialeId, `${periode}-01`)
      .then(setResume)
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : 'Erreur de chargement'))
      .finally(() => setChargement(false));
  }

  function rafraichirListe() {
    if (!jeton) return;
    api
      .listerCyclesPaie(jeton, `${periode}-01`)
      .then(setCycles)
      .catch(() => {});
  }

  useEffect(rafraichir, [jeton, filialeId, periode]);
  useEffect(rafraichirListe, [jeton, periode]);

  async function executer(nom: string, tache: () => Promise<unknown>) {
    setAction(nom);
    setErreur(null);
    try {
      await tache();
      rafraichir();
      rafraichirListe();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : `Erreur lors de : ${nom}`);
    } finally {
      setAction(null);
    }
  }

  async function telecharger(groupePar?: 'mode_paiement') {
    if (!jeton || !filialeId) return;
    setAction(groupePar ? 'journal-groupe' : 'journal');
    setErreur(null);
    try {
      const blob = await api.telechargerJournalPaie(
        jeton,
        filialeId,
        `${periode}-01`,
        groupePar,
        exportModePaiement || undefined,
        exportChantierId || undefined
      );
      const url = URL.createObjectURL(blob);
      const lien = document.createElement('a');
      lien.href = url;
      const suffixeFiltre = [exportModePaiement, exportChantierId ? 'chantier' : ''].filter(Boolean).join('-');
      lien.download = `journal-paie-${periode}${groupePar ? '-par-mode-paiement' : ''}${suffixeFiltre ? `-${suffixeFiltre}` : ''}.xlsx`;
      lien.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      rafraichir();
      rafraichirListe();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la génération du Journal de Paie');
    } finally {
      setAction(null);
    }
  }

  return (
    <MiseEnPage>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Cycle de paie mensuel</h2>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <label className={LABEL}>Filiale</label>
          <select value={filialeId} onChange={(e) => setFilialeId(e.target.value)} className={CHAMP}>
            {filiales.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nom}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>Mois</label>
          <input type="month" value={periode} onChange={(e) => setPeriode(e.target.value)} className={CHAMP} />
        </div>
      </div>

      {erreur && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      {chargement && !resume ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      ) : resume ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IconeCyclePaie className="h-6 w-6 text-primary-700" />
              <h3 className="text-base font-semibold text-slate-900">
                Paie — {new Date(`${periode}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </h3>
            </div>
            <Badge couleur={COULEURS_STATUT[resume.statut]}>{LIBELLES_STATUT[resume.statut]}</Badge>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Avec éléments du mois</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{resume.nbEmployesAvecElements}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sans éléments saisis</p>
              <p className={`mt-1 text-xl font-bold ${resume.nbEmployesSansElements > 0 ? 'text-alerte-700' : 'text-slate-900'}`}>
                {resume.nbEmployesSansElements > 0 ? `${resume.nbEmployesSansElements} ⚠️` : 0}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Bulletins calculés</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{resume.nbBulletinsCalcules}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total net à payer</p>
              <p className="mt-1 text-xl font-bold text-succes-700 [font-variant-numeric:tabular-nums]">
                {formaterFCFA(resume.totalNetAPayer)}
              </p>
            </div>
          </div>

          {resume.nbEmployesSansElements > 0 && (
            <p className="mb-4 rounded-md bg-alerte-50 px-3 py-2 text-xs text-alerte-700">
              {resume.nbEmployesSansElements} employé(s) actif(s) de cette filiale n'ont aucun élément du mois saisi —
              ils ne seront pas calculés tant qu'ils ne sont pas renseignés (module Éléments du mois).
            </p>
          )}

          {!peutGerer ? (
            <p className="text-sm text-slate-500">Lecture seule — seuls RH filiale / DRH / super admin peuvent piloter ce cycle.</p>
          ) : (
            <>
              {(resume.statut === 'verifie' || resume.statut === 'exporte') && (
                <div className="mb-3 flex flex-wrap items-end gap-3">
                  <div>
                    <label className={LABEL}>Filtrer le téléchargement par mode de paiement</label>
                    <select value={exportModePaiement} onChange={(e) => setExportModePaiement(e.target.value)} className={CHAMP}>
                      <option value="">Tous les modes</option>
                      {OPTIONS_MODE_PAIEMENT.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL}>Filtrer par chantier</label>
                    <select value={exportChantierId} onChange={(e) => setExportChantierId(e.target.value)} className={CHAMP}>
                      <option value="">Tous les chantiers</option>
                      {chantiers
                        .filter((c) => c.filialeId === filialeId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nom}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
              {resume.statut === 'ouvert' && (
                <button
                  disabled={action !== null}
                  onClick={() => executer('calculer', () => api.lancerCalculCyclePaie(jeton!, filialeId, `${periode}-01`))}
                  className={BOUTON}
                >
                  {action === 'calculer' ? 'Calcul en cours...' : 'Calculer la paie'}
                </button>
              )}

              {resume.statut === 'calcule' && (
                <button
                  disabled={action !== null}
                  onClick={() => executer('verifier', () => api.marquerCyclePaieVerifie(jeton!, filialeId, `${periode}-01`))}
                  className={BOUTON}
                >
                  {action === 'verifier' ? '...' : 'Marquer comme vérifié'}
                </button>
              )}
              {resume.statut === 'calcule' && (
                <button
                  disabled={action !== null}
                  onClick={() => executer('recalculer', () => api.lancerCalculCyclePaie(jeton!, filialeId, `${periode}-01`))}
                  className={BOUTON_SECONDAIRE}
                >
                  Recalculer
                </button>
              )}

              {resume.statut === 'verifie' && (
                <>
                  <button disabled={action !== null} onClick={() => telecharger()} className={BOUTON}>
                    {action === 'journal' ? 'Génération...' : 'Générer le Journal de Paie (Excel)'}
                  </button>
                  <button disabled={action !== null} onClick={() => telecharger('mode_paiement')} className={BOUTON_SECONDAIRE}>
                    {action === 'journal-groupe' ? 'Génération...' : 'Générer par mode de paiement'}
                  </button>
                  <button
                    disabled={action !== null}
                    onClick={() => executer('recalculer', () => api.lancerCalculCyclePaie(jeton!, filialeId, `${periode}-01`))}
                    className={BOUTON_SECONDAIRE}
                  >
                    {action === 'recalculer' ? 'Calcul en cours...' : 'Recalculer'}
                  </button>
                </>
              )}

              {resume.statut === 'exporte' && (
                <>
                  <button disabled={action !== null} onClick={() => telecharger()} className={BOUTON_SECONDAIRE}>
                    Télécharger à nouveau
                  </button>
                  <button disabled={action !== null} onClick={() => telecharger('mode_paiement')} className={BOUTON_SECONDAIRE}>
                    Télécharger par mode de paiement
                  </button>
                  <button
                    disabled={action !== null}
                    onClick={() => executer('cloturer', () => api.cloturerCyclePaie(jeton!, filialeId, `${periode}-01`))}
                    className={BOUTON}
                  >
                    {action === 'cloturer' ? '...' : 'Clôturer le mois'}
                  </button>
                </>
              )}

              {resume.statut === 'cloture' && (
                <>
                  <p className="w-full text-xs text-slate-500">
                    Mois clôturé{resume.clotureLe ? ` le ${new Date(resume.clotureLe).toLocaleDateString('fr-FR')}` : ''} — plus
                    aucune modification de paie possible sans réouverture.
                  </p>
                  {peutReouvrir ? (
                    <button
                      disabled={action !== null}
                      onClick={() => executer('reouvrir', () => api.reouvrirCyclePaie(jeton!, filialeId, `${periode}-01`))}
                      className={BOUTON_SECONDAIRE}
                    >
                      {action === 'reouvrir' ? '...' : 'Réouvrir le mois'}
                    </button>
                  ) : (
                    <p className="text-xs text-slate-400">Réouverture réservée à la DRH / super admin.</p>
                  )}
                </>
              )}
              </div>
            </>
          )}
        </div>
      ) : null}

      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">Tous les cycles — {new Date(`${periode}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</h3>
          <div className="flex flex-wrap gap-2">
            <div className="w-56">
              <FiltreSelect
                valeur={filtreFiliale}
                onChange={setFiltreFiliale}
                toutLibelle="Toutes les filiales"
                options={filiales.map((f) => ({ valeur: f.id, libelle: f.nom }))}
              />
            </div>
            <div className="w-56">
              <FiltreSelect
                valeur={filtreChantier}
                onChange={setFiltreChantier}
                toutLibelle="Tous les chantiers"
                options={chantiers.map((c) => ({ valeur: c.id, libelle: c.nom }))}
              />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Filiale</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Calculé le</th>
                <th className="px-4 py-3">Vérifié le</th>
                <th className="px-4 py-3">Exporté le</th>
                <th className="px-4 py-3">Clôturé le</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filiales
                .filter((f) => !filtreFiliale || f.id === filtreFiliale)
                // Un cycle est par filiale, pas par chantier — choisir un chantier restreint donc
                // la liste à la filiale à laquelle ce chantier est rattaché.
                .filter((f) => !filtreChantier || chantiers.find((c) => c.id === filtreChantier)?.filialeId === f.id)
                .map((f) => {
                  const cycle = cycles.find((c) => c.filialeId === f.id);
                  const statut: StatutCyclePaie = cycle?.statut ?? 'ouvert';
                  return (
                    <tr key={f.id} className="transition-colors duration-200 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{f.nom}</td>
                      <td className="px-4 py-3">
                        <Badge couleur={COULEURS_STATUT[statut]}>{LIBELLES_STATUT[statut]}</Badge>
                      </td>
                      <td className="px-4 py-3">{formaterDateFr(cycle?.calculeLe ?? null)}</td>
                      <td className="px-4 py-3">{formaterDateFr(cycle?.verifieLe ?? null)}</td>
                      <td className="px-4 py-3">{formaterDateFr(cycle?.exporteLe ?? null)}</td>
                      <td className="px-4 py-3">{formaterDateFr(cycle?.clotureLe ?? null)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setFilialeId(f.id)}
                          className="font-medium text-primary-700 transition-colors duration-200 hover:underline"
                        >
                          Voir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              {filiales.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                    Aucune filiale.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MiseEnPage>
  );
}
