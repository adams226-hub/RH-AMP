import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ErreurApi, api } from '../api/client';
import { AccesRestreint } from '../components/AccesRestreint';
import { Badge, CouleurBadge } from '../components/Badge';
import { ChampRecherche } from '../components/ChampRecherche';
import { EnTeteTriable } from '../components/EnTeteTriable';
import { EtatVide } from '../components/EtatVide';
import { FiltreSelect } from '../components/FiltreSelect';
import { IconeContrats } from '../components/icones';
import { MiseEnPage } from '../components/MiseEnPage';
import { Modale } from '../components/Modale';
import { Pagination } from '../components/Pagination';
import { SelecteurEmploye } from '../components/SelecteurEmploye';
import { useAuth } from '../context/AuthContext';
import { useTri } from '../hooks/useTri';
import { Contrat, ContratAvecEmploye, StatutContrat, TypeContrat } from '../types/contrats';
import { Filiale } from '../types/postes';
import { formaterDateFr } from '../utils/date';

const CHAMP =
  'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';
const LABEL = 'mb-1 block text-xs font-medium text-slate-600';
const BOUTON =
  'rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-800 hover:shadow-md disabled:pointer-events-none disabled:opacity-60';
const PAR_PAGE = 10;
const ROLES_GESTION = ['super_admin', 'drh_holding', 'rh_filiale'];

const LIBELLES_STATUT: Record<StatutContrat, string> = {
  brouillon: 'Brouillon',
  signe: 'Signé',
  actif: 'Actif',
  renouvele: 'Renouvelé',
  expire: 'Expiré',
  rompu: 'Rompu',
  termine: 'Terminé',
};

const COULEURS_STATUT: Record<StatutContrat, CouleurBadge> = {
  brouillon: 'slate',
  signe: 'primary',
  actif: 'succes',
  renouvele: 'accent',
  expire: 'alerte',
  rompu: 'erreur',
  termine: 'slate',
};

export function Contrats() {
  const { jeton, role } = useAuth();
  const peutGerer = role !== null && ROLES_GESTION.includes(role);

  const [contrats, setContrats] = useState<ContratAvecEmploye[]>([]);
  const [expirations, setExpirations] = useState<Contrat[]>([]);
  const [filiales, setFiliales] = useState<Filiale[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [filtreType, setFiltreType] = useState('');
  const [filtreFiliale, setFiltreFiliale] = useState('');
  const [page, setPage] = useState(1);

  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [employeId, setEmployeId] = useState('');
  const [type, setType] = useState<TypeContrat>('cdi');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [salaireBase, setSalaireBase] = useState('');
  const [remunerationOuverte, setRemunerationOuverte] = useState(false);
  const [sursalaire, setSursalaire] = useState('0');
  const [indemniteLogement, setIndemniteLogement] = useState('0');
  const [indemniteTransport, setIndemniteTransport] = useState('0');
  const [indemniteFonction, setIndemniteFonction] = useState('0');
  const [indemniteSujetion, setIndemniteSujetion] = useState('0');
  const [indemniteAstreinte, setIndemniteAstreinte] = useState('0');

  const [contratActif, setContratActif] = useState<ContratAvecEmploye | null>(null);
  const [actionModale, setActionModale] = useState<'renouveler' | 'rompre' | 'modifier' | null>(null);

  function rafraichir() {
    if (!jeton) return;
    setChargement(true);
    api
      .listerTousContrats(jeton)
      .then(setContrats)
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : 'Erreur de chargement'))
      .finally(() => setChargement(false));
  }

  useEffect(rafraichir, [jeton]);

  const [activationEnCours, setActivationEnCours] = useState<string | null>(null);

  async function activer(id: string) {
    if (!jeton) return;
    setActivationEnCours(id);
    try {
      await api.activerContrat(jeton, id);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'activation");
    } finally {
      setActivationEnCours(null);
    }
  }

  useEffect(() => {
    if (!jeton) return;
    api.listerFiliales(jeton).then(setFiliales);
    api.listerContratsExpirations(jeton, 90).then(setExpirations);
  }, [jeton]);

  const nomFiliale = (id: string) => filiales.find((f) => f.id === id)?.nom ?? '—';

  const filtres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return contrats.filter((c) => {
      if (filtreStatut && c.statut !== filtreStatut) return false;
      if (filtreType && c.type !== filtreType) return false;
      if (filtreFiliale && c.filialeId !== filtreFiliale) return false;
      if (terme) {
        const cible = `${c.employeMatricule} ${c.employeNom} ${c.employePrenoms}`.toLowerCase();
        if (!cible.includes(terme)) return false;
      }
      return true;
    });
  }, [contrats, recherche, filtreStatut, filtreType, filtreFiliale]);

  const { trie, cle, sens, trierPar } = useTri<ContratAvecEmploye>(filtres, 'dateDebut');
  const totalPages = Math.max(1, Math.ceil(trie.length / PAR_PAGE));
  const pageBornee = Math.min(page, totalPages);
  const pageAffichee = trie.slice((pageBornee - 1) * PAR_PAGE, pageBornee * PAR_PAGE);

  useEffect(() => setPage(1), [recherche, filtreStatut, filtreType, filtreFiliale]);

  async function creer(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !employeId || !dateDebut || !salaireBase) return;

    setEnvoiEnCours(true);
    try {
      await api.creerContrat(jeton, {
        employeId,
        type,
        dateDebut,
        dateFin: dateFin || undefined,
        salaireBase: Number(salaireBase),
        sursalaire: Number(sursalaire),
        indemniteLogement: Number(indemniteLogement),
        indemniteTransport: Number(indemniteTransport),
        indemniteFonction: Number(indemniteFonction),
        indemniteSujetion: Number(indemniteSujetion),
        indemniteAstreinte: Number(indemniteAstreinte),
      });
      setEmployeId('');
      setDateDebut('');
      setDateFin('');
      setSalaireBase('');
      setSursalaire('0');
      setIndemniteLogement('0');
      setIndemniteTransport('0');
      setIndemniteFonction('0');
      setIndemniteSujetion('0');
      setIndemniteAstreinte('0');
      setRemunerationOuverte(false);
      setFormulaireOuvert(false);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la création');
    } finally {
      setEnvoiEnCours(false);
    }
  }

  // Les contrats exposent le salaire de base — accès réservé aux rôles de gestion tant
  // qu'une vue "mes contrats" dédiée à l'employé n'existe pas. Placé après tous les hooks
  // ci-dessus pour ne pas violer les Rules of Hooks.
  if (role !== null && !peutGerer) {
    return <AccesRestreint />;
  }

  return (
    <MiseEnPage>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Contrats</h2>
          <p className="text-sm text-slate-500">{contrats.length} contrat(s) dans votre périmètre</p>
        </div>
        {peutGerer && (
          <button onClick={() => setFormulaireOuvert((v) => !v)} className={BOUTON}>
            {formulaireOuvert ? 'Fermer' : '+ Nouveau contrat'}
          </button>
        )}
      </div>

      {expirations.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-alerte-600/20 bg-alerte-100 px-4 py-3">
          <span className="mt-0.5 text-alerte-700">⚠</span>
          <div className="text-sm text-alerte-700">
            <strong>{expirations.length} contrat(s)</strong> arrivent à échéance dans les 90 prochains jours — pensez à
            anticiper le renouvellement ou la fin de mission.
          </div>
        </div>
      )}

      {erreur && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      {formulaireOuvert && peutGerer && (
        <form onSubmit={creer} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Nouveau contrat</h3>
          <div className="mb-3">
            <SelecteurEmploye valeur={employeId} onChange={setEmployeId} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className={LABEL}>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as TypeContrat)} className={CHAMP}>
                <option value="cdi">CDI — Contrat à Durée Indéterminée</option>
                <option value="cdd">CDD — Contrat à Durée Déterminée</option>
                <option value="cdc">CDC — Contrat à durée de chantier</option>
                <option value="stage">Stage</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Date de début</label>
              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required className={CHAMP} />
            </div>
            {type !== 'cdi' && (
              <div>
                <label className={LABEL}>Date de fin</label>
                <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={CHAMP} />
              </div>
            )}
            <div>
              <label className={LABEL}>Salaire de base</label>
              <input
                type="number"
                value={salaireBase}
                onChange={(e) => setSalaireBase(e.target.value)}
                required
                className={CHAMP}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setRemunerationOuverte((v) => !v)}
            className="mt-3 text-xs font-medium text-primary-700 hover:underline"
          >
            {remunerationOuverte ? '− Masquer' : '+ Sursalaire et indemnités'} (optionnel, alimente le bulletin de paie)
          </button>

          {remunerationOuverte && (
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <label className={LABEL}>Sursalaire</label>
                <input type="number" value={sursalaire} onChange={(e) => setSursalaire(e.target.value)} className={CHAMP} />
              </div>
              <div>
                <label className={LABEL}>Indemnité de logement</label>
                <input
                  type="number"
                  value={indemniteLogement}
                  onChange={(e) => setIndemniteLogement(e.target.value)}
                  className={CHAMP}
                />
              </div>
              <div>
                <label className={LABEL}>Indemnité de transport</label>
                <input
                  type="number"
                  value={indemniteTransport}
                  onChange={(e) => setIndemniteTransport(e.target.value)}
                  className={CHAMP}
                />
              </div>
              <div>
                <label className={LABEL}>Indemnité de fonction</label>
                <input
                  type="number"
                  value={indemniteFonction}
                  onChange={(e) => setIndemniteFonction(e.target.value)}
                  className={CHAMP}
                />
              </div>
              <div>
                <label className={LABEL}>Indemnité de sujétion</label>
                <input
                  type="number"
                  value={indemniteSujetion}
                  onChange={(e) => setIndemniteSujetion(e.target.value)}
                  className={CHAMP}
                />
              </div>
              <div>
                <label className={LABEL}>Indemnité d'astreinte</label>
                <input
                  type="number"
                  value={indemniteAstreinte}
                  onChange={(e) => setIndemniteAstreinte(e.target.value)}
                  className={CHAMP}
                />
              </div>
            </div>
          )}

          <button disabled={envoiEnCours} className={`${BOUTON} mt-3`}>
            {envoiEnCours ? 'Création...' : 'Créer le contrat'}
          </button>
        </form>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Rechercher un employé, matricule…" />
        </div>
        <FiltreSelect
          valeur={filtreStatut}
          onChange={setFiltreStatut}
          toutLibelle="Tous les statuts"
          options={Object.entries(LIBELLES_STATUT).map(([valeur, libelle]) => ({ valeur, libelle }))}
        />
        <FiltreSelect
          valeur={filtreType}
          onChange={setFiltreType}
          toutLibelle="Tous les types"
          options={[
            { valeur: 'cdi', libelle: 'CDI' },
            { valeur: 'cdd', libelle: 'CDD' },
            { valeur: 'cdc', libelle: 'CDC' },
            { valeur: 'stage', libelle: 'Stage' },
          ]}
        />
        <FiltreSelect
          valeur={filtreFiliale}
          onChange={setFiltreFiliale}
          toutLibelle="Toutes les filiales"
          options={filiales.map((f) => ({ valeur: f.id, libelle: f.nom }))}
        />
        <span className="ml-auto text-xs text-slate-500">
          {trie.length} résultat{trie.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {chargement ? (
          <div className="space-y-3 p-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : trie.length > 0 ? (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <EnTeteTriable label="Employé" cleColonne="employeNom" cleActive={cle} sens={sens} onTrier={trierPar} />
                  <th className="px-4 py-3">Filiale</th>
                  <EnTeteTriable label="Type" cleColonne="type" cleActive={cle} sens={sens} onTrier={trierPar} />
                  <EnTeteTriable label="Début" cleColonne="dateDebut" cleActive={cle} sens={sens} onTrier={trierPar} />
                  <th className="px-4 py-3">Fin</th>
                  <th className="px-4 py-3">Salaire de base</th>
                  <EnTeteTriable label="Statut" cleColonne="statut" cleActive={cle} sens={sens} onTrier={trierPar} />
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageAffichee.map((c) => (
                  <tr key={c.id} className="transition-colors duration-200 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {c.employeNom} {c.employePrenoms}
                      <div className="font-mono text-xs font-normal text-slate-400">{c.employeMatricule}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{nomFiliale(c.filialeId)}</td>
                    <td className="px-4 py-3 uppercase">{c.type}</td>
                    <td className="px-4 py-3">{formaterDateFr(c.dateDebut)}</td>
                    <td className="px-4 py-3">{c.dateFin ? formaterDateFr(c.dateFin) : '—'}</td>
                    <td className="px-4 py-3">{c.salaireBase.toLocaleString('fr-FR')} F CFA</td>
                    <td className="px-4 py-3">
                      <Badge couleur={COULEURS_STATUT[c.statut]}>{LIBELLES_STATUT[c.statut]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {peutGerer && (c.statut === 'brouillon' || c.statut === 'signe') && (
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => {
                              setContratActif(c);
                              setActionModale('modifier');
                            }}
                            className="font-medium text-primary-700 transition-colors duration-200 hover:underline"
                          >
                            Modifier
                          </button>
                          <button
                            disabled={activationEnCours === c.id}
                            onClick={() => activer(c.id)}
                            className="font-medium text-succes-700 transition-colors duration-200 hover:underline disabled:opacity-50"
                          >
                            {activationEnCours === c.id ? 'Activation...' : 'Activer'}
                          </button>
                        </div>
                      )}
                      {peutGerer && c.statut === 'actif' && (
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => {
                              setContratActif(c);
                              setActionModale('renouveler');
                            }}
                            className="font-medium text-primary-700 transition-colors duration-200 hover:underline"
                          >
                            Renouveler
                          </button>
                          <button
                            onClick={() => {
                              setContratActif(c);
                              setActionModale('rompre');
                            }}
                            className="font-medium text-erreur-600 transition-colors duration-200 hover:underline"
                          >
                            Rompre
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={pageBornee} totalPages={totalPages} onChange={setPage} totalItems={trie.length} parPage={PAR_PAGE} />
          </>
        ) : (
          <EtatVide
            icone={<IconeContrats />}
            titre={contrats.length === 0 ? 'Aucun contrat' : 'Aucun résultat'}
            message={
              contrats.length === 0
                ? 'Les contrats créés apparaîtront ici.'
                : 'Aucun contrat ne correspond à votre recherche ou vos filtres.'
            }
          />
        )}
      </div>

      {contratActif && actionModale === 'modifier' && (
        <FormulaireModification
          contrat={contratActif}
          onFermer={() => setActionModale(null)}
          onSucces={() => {
            setActionModale(null);
            rafraichir();
          }}
        />
      )}

      {contratActif && actionModale === 'renouveler' && (
        <FormulaireRenouvellement
          contrat={contratActif}
          onFermer={() => setActionModale(null)}
          onSucces={() => {
            setActionModale(null);
            rafraichir();
          }}
        />
      )}

      {contratActif && actionModale === 'rompre' && (
        <FormulaireRupture
          contrat={contratActif}
          onFermer={() => setActionModale(null)}
          onSucces={() => {
            setActionModale(null);
            rafraichir();
          }}
        />
      )}
    </MiseEnPage>
  );
}

function FormulaireModification({
  contrat,
  onFermer,
  onSucces,
}: {
  contrat: ContratAvecEmploye;
  onFermer: () => void;
  onSucces: () => void;
}) {
  const { jeton } = useAuth();
  const [type, setType] = useState<TypeContrat>(contrat.type);
  const [dateDebut, setDateDebut] = useState(contrat.dateDebut);
  const [dateFin, setDateFin] = useState(contrat.dateFin ?? '');
  const [salaireBase, setSalaireBase] = useState(String(contrat.salaireBase));
  const [sursalaire, setSursalaire] = useState(String(contrat.sursalaire));
  const [indemniteLogement, setIndemniteLogement] = useState(String(contrat.indemniteLogement));
  const [indemniteTransport, setIndemniteTransport] = useState(String(contrat.indemniteTransport));
  const [indemniteFonction, setIndemniteFonction] = useState(String(contrat.indemniteFonction));
  const [indemniteSujetion, setIndemniteSujetion] = useState(String(contrat.indemniteSujetion));
  const [indemniteAstreinte, setIndemniteAstreinte] = useState(String(contrat.indemniteAstreinte));
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton) return;
    setEnCours(true);
    try {
      await api.modifierContrat(jeton, contrat.id, {
        type,
        dateDebut,
        dateFin: type === 'cdi' ? undefined : dateFin || undefined,
        salaireBase: Number(salaireBase),
        sursalaire: Number(sursalaire),
        indemniteLogement: Number(indemniteLogement),
        indemniteTransport: Number(indemniteTransport),
        indemniteFonction: Number(indemniteFonction),
        indemniteSujetion: Number(indemniteSujetion),
        indemniteAstreinte: Number(indemniteAstreinte),
      });
      onSucces();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la modification');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modale titre={`Modifier — ${contrat.employeNom} ${contrat.employePrenoms}`} onFermer={onFermer}>
      <form onSubmit={soumettre} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as TypeContrat)} className={CHAMP}>
              <option value="cdi">CDI — Contrat à Durée Indéterminée</option>
              <option value="cdd">CDD — Contrat à Durée Déterminée</option>
              <option value="cdc">CDC — Contrat à durée de chantier</option>
              <option value="stage">Stage</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Date de début</label>
            <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required className={CHAMP} />
          </div>
          {type !== 'cdi' && (
            <div>
              <label className={LABEL}>Date de fin</label>
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} required className={CHAMP} />
            </div>
          )}
          <div>
            <label className={LABEL}>Salaire de base</label>
            <input
              type="number"
              value={salaireBase}
              onChange={(e) => setSalaireBase(e.target.value)}
              required
              className={CHAMP}
            />
          </div>
          <div>
            <label className={LABEL}>Sursalaire</label>
            <input type="number" value={sursalaire} onChange={(e) => setSursalaire(e.target.value)} className={CHAMP} />
          </div>
          <div>
            <label className={LABEL}>Indemnité de logement</label>
            <input
              type="number"
              value={indemniteLogement}
              onChange={(e) => setIndemniteLogement(e.target.value)}
              className={CHAMP}
            />
          </div>
          <div>
            <label className={LABEL}>Indemnité de transport</label>
            <input
              type="number"
              value={indemniteTransport}
              onChange={(e) => setIndemniteTransport(e.target.value)}
              className={CHAMP}
            />
          </div>
          <div>
            <label className={LABEL}>Indemnité de fonction</label>
            <input
              type="number"
              value={indemniteFonction}
              onChange={(e) => setIndemniteFonction(e.target.value)}
              className={CHAMP}
            />
          </div>
          <div>
            <label className={LABEL}>Indemnité de sujétion</label>
            <input
              type="number"
              value={indemniteSujetion}
              onChange={(e) => setIndemniteSujetion(e.target.value)}
              className={CHAMP}
            />
          </div>
          <div>
            <label className={LABEL}>Indemnité d'astreinte</label>
            <input
              type="number"
              value={indemniteAstreinte}
              onChange={(e) => setIndemniteAstreinte(e.target.value)}
              className={CHAMP}
            />
          </div>
        </div>
        {erreur && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}
        <button disabled={enCours} className={BOUTON}>
          {enCours ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </button>
      </form>
    </Modale>
  );
}

function FormulaireRenouvellement({
  contrat,
  onFermer,
  onSucces,
}: {
  contrat: ContratAvecEmploye;
  onFermer: () => void;
  onSucces: () => void;
}) {
  const { jeton } = useAuth();
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [salaireBase, setSalaireBase] = useState(String(contrat.salaireBase));
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton) return;
    setEnCours(true);
    try {
      await api.renouvelerContrat(jeton, contrat.id, { dateDebut, dateFin: dateFin || undefined, salaireBase: Number(salaireBase) });
      onSucces();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors du renouvellement');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modale titre={`Renouveler — ${contrat.employeNom} ${contrat.employePrenoms}`} onFermer={onFermer}>
      <form onSubmit={soumettre} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Nouvelle date de début</label>
          <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required className={CHAMP + ' w-full'} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Nouvelle date de fin (si CDD/CDC/Stage)</label>
          <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={CHAMP + ' w-full'} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Salaire de base</label>
          <input
            type="number"
            value={salaireBase}
            onChange={(e) => setSalaireBase(e.target.value)}
            required
            className={CHAMP + ' w-full'}
          />
        </div>
        {erreur && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}
        <button disabled={enCours} className={BOUTON}>
          {enCours ? 'Envoi...' : 'Confirmer le renouvellement'}
        </button>
      </form>
    </Modale>
  );
}

function FormulaireRupture({
  contrat,
  onFermer,
  onSucces,
}: {
  contrat: ContratAvecEmploye;
  onFermer: () => void;
  onSucces: () => void;
}) {
  const { jeton } = useAuth();
  const [dateRupture, setDateRupture] = useState('');
  const [motifRupture, setMotifRupture] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton) return;
    setEnCours(true);
    try {
      await api.romprecontrat(jeton, contrat.id, { dateRupture, motifRupture });
      onSucces();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la rupture');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modale titre={`Rompre — ${contrat.employeNom} ${contrat.employePrenoms}`} onFermer={onFermer}>
      <form onSubmit={soumettre} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Date de rupture</label>
          <input type="date" value={dateRupture} onChange={(e) => setDateRupture(e.target.value)} required className={CHAMP + ' w-full'} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Motif</label>
          <input value={motifRupture} onChange={(e) => setMotifRupture(e.target.value)} required className={CHAMP + ' w-full'} />
        </div>
        {erreur && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}
        <button disabled={enCours} className="rounded-md bg-erreur-600 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-erreur-700 hover:shadow-md disabled:pointer-events-none disabled:opacity-60">
          {enCours ? 'Envoi...' : 'Confirmer la rupture'}
        </button>
      </form>
    </Modale>
  );
}
