import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ErreurApi, api } from '../api/client';
import { Badge, CouleurBadge } from '../components/Badge';
import { ChampRecherche } from '../components/ChampRecherche';
import { EnTeteTriable } from '../components/EnTeteTriable';
import { EtatVide } from '../components/EtatVide';
import { FiltreSelect } from '../components/FiltreSelect';
import { IconeConges } from '../components/icones';
import { MiseEnPage } from '../components/MiseEnPage';
import { Pagination } from '../components/Pagination';
import { SelecteurEmploye } from '../components/SelecteurEmploye';
import { useAuth } from '../context/AuthContext';
import { useTri } from '../hooks/useTri';
import { DemandeConge, DemandeCongeAvecEmploye, SoldeConge, StatutDemandeConge } from '../types/conges';
import {
  DemandeCongeSpecial,
  DemandeCongeSpecialAvecEmploye,
  StatutCongeSpecial,
  TypeCongeSpecial,
} from '../types/congesSpeciaux';
import { Modale } from '../components/Modale';
import { formaterDateFr } from '../utils/date';

const CHAMP =
  'rounded-md border border-slate-300 px-2.5 py-1.5 text-sm transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';
const BOUTON =
  'rounded-md bg-primary-700 px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-800 hover:shadow-md disabled:pointer-events-none disabled:opacity-60';
const PAR_PAGE = 10;
const ROLES_CREATION = ['super_admin', 'drh_holding', 'rh_filiale'];

const LIBELLES_STATUT: Record<StatutDemandeConge, string> = {
  brouillon: 'Brouillon',
  soumise: 'Soumise',
  avis_favorable: 'Avis favorable',
  avis_defavorable: 'Avis défavorable',
  validee_rh: 'Validée',
  rejetee_rh: 'Rejetée',
  annulee: 'Annulée',
};

const COULEURS_STATUT: Record<StatutDemandeConge, CouleurBadge> = {
  brouillon: 'slate',
  soumise: 'primary',
  avis_favorable: 'accent',
  avis_defavorable: 'alerte',
  validee_rh: 'succes',
  rejetee_rh: 'erreur',
  annulee: 'slate',
};

const LIBELLES_TYPE_SPECIAL: Record<TypeCongeSpecial, string> = {
  maternite: 'Congé maternité',
  paternite: 'Congé paternité',
};

const LIBELLES_STATUT_SPECIAL: Record<StatutCongeSpecial, string> = {
  soumise: 'Soumise',
  validee: 'Validée',
  rejetee: 'Rejetée',
};

const COULEURS_STATUT_SPECIAL: Record<StatutCongeSpecial, CouleurBadge> = {
  soumise: 'primary',
  validee: 'succes',
  rejetee: 'erreur',
};

function TuileSolde({ libelle, valeur }: { libelle: string; valeur: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{libelle}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 [font-variant-numeric:tabular-nums]">{valeur} j</p>
    </div>
  );
}

export function Conges() {
  const { jeton, role, employeId: monEmployeId } = useAuth();

  if (role === 'employe') {
    return <VueEmploye jeton={jeton} employeId={monEmployeId} />;
  }

  return <VueGestion jeton={jeton} role={role} />;
}

// ---------- Vue Employé : uniquement ses propres congés ----------

function VueEmploye({ jeton, employeId }: { jeton: string | null; employeId: string | null }) {
  const [onglet, setOnglet] = useState<'annuel' | 'special'>('annuel');
  const [solde, setSolde] = useState<SoldeConge | null>(null);
  const [demandes, setDemandes] = useState<DemandeConge[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [motif, setMotif] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  function rafraichir() {
    if (!jeton || !employeId) return;
    const annee = new Date().getFullYear();
    Promise.all([api.obtenirSolde(jeton, employeId, annee), api.listerDemandesConges(jeton, employeId)])
      .then(([s, d]) => {
        setSolde(s);
        setDemandes(d);
      })
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : 'Erreur de chargement'));
  }

  useEffect(rafraichir, [jeton, employeId]);

  async function creer(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !employeId || !dateDebut || !dateFin) return;
    setEnvoiEnCours(true);
    try {
      await api.creerDemandeConge(jeton, { employeId, dateDebut, dateFin, motif: motif || undefined });
      setDateDebut('');
      setDateFin('');
      setMotif('');
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la création');
    } finally {
      setEnvoiEnCours(false);
    }
  }

  if (!employeId) {
    return (
      <MiseEnPage>
        <EtatVide
          icone={<IconeConges />}
          titre="Compte non rattaché à un dossier employé"
          message="Contactez votre RH pour rattacher votre compte à un dossier employé."
        />
      </MiseEnPage>
    );
  }

  return (
    <MiseEnPage>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Mes congés</h2>

      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {(
          [
            ['annuel', 'Congé annuel'],
            ['special', 'Maternité / Paternité'],
          ] as const
        ).map(([id, libelle]) => (
          <button
            key={id}
            onClick={() => setOnglet(id)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${
              onglet === id ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {libelle}
          </button>
        ))}
      </div>

      {erreur && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      {onglet === 'annuel' && (
        <>
          {solde && (
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <TuileSolde libelle="Solde disponible" valeur={solde.soldeDisponible} />
              <TuileSolde libelle="Jours acquis" valeur={solde.joursAcquis} />
              <TuileSolde libelle="Jours consommés" valeur={solde.joursConsommes} />
              <TuileSolde libelle="Reporté N-1" valeur={solde.soldeInitial} />
            </div>
          )}

          <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {demandes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Début</th>
                      <th className="px-4 py-3">Fin</th>
                      <th className="px-4 py-3">Jours</th>
                      <th className="px-4 py-3">Motif</th>
                      <th className="px-4 py-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {demandes.map((d) => (
                      <tr key={d.id} className="transition-colors duration-200 hover:bg-slate-50">
                        <td className="px-4 py-3">{formaterDateFr(d.dateDebut)}</td>
                        <td className="px-4 py-3">{formaterDateFr(d.dateFin)}</td>
                        <td className="px-4 py-3">{d.nbJours}</td>
                        <td className="px-4 py-3 text-slate-500">{d.motif ?? '—'}</td>
                        <td className="px-4 py-3">
                          <Badge couleur={COULEURS_STATUT[d.statut]}>{LIBELLES_STATUT[d.statut]}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EtatVide icone={<IconeConges />} titre="Aucune demande" message="Vos demandes de congé apparaîtront ici." />
            )}
          </div>

          <form onSubmit={creer} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Nouvelle demande</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required className={CHAMP} />
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} required className={CHAMP} />
              <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif (optionnel)" className={CHAMP} />
            </div>
            <button disabled={envoiEnCours} className={`${BOUTON} mt-3`}>
              {envoiEnCours ? 'Envoi...' : 'Soumettre la demande'}
            </button>
          </form>
        </>
      )}

      {onglet === 'special' && <SectionCongesSpeciauxEmploye jeton={jeton} employeId={employeId} />}
    </MiseEnPage>
  );
}

// ---------- Congés spéciaux (maternité / paternité) — vue employé ----------

function SectionCongesSpeciauxEmploye({ jeton, employeId }: { jeton: string | null; employeId: string }) {
  const [demandes, setDemandes] = useState<DemandeCongeSpecial[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [type, setType] = useState<TypeCongeSpecial>('maternite');
  const [dateDebut, setDateDebut] = useState('');
  const [justificatifFourni, setJustificatifFourni] = useState(false);
  const [motif, setMotif] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  function rafraichir() {
    if (!jeton || !employeId) return;
    api
      .listerDemandesCongesSpeciaux(jeton, employeId)
      .then(setDemandes)
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : 'Erreur de chargement'));
  }

  useEffect(rafraichir, [jeton, employeId]);

  async function creer(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !employeId || !dateDebut) return;
    setEnvoiEnCours(true);
    try {
      await api.creerDemandeCongeSpecial(jeton, { employeId, type, dateDebut, justificatifFourni, motif: motif || undefined });
      setDateDebut('');
      setJustificatifFourni(false);
      setMotif('');
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la création');
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <>
      {erreur && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {demandes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Début</th>
                  <th className="px-4 py-3">Fin</th>
                  <th className="px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {demandes.map((d) => (
                  <tr key={d.id} className="transition-colors duration-200 hover:bg-slate-50">
                    <td className="px-4 py-3">{LIBELLES_TYPE_SPECIAL[d.type]}</td>
                    <td className="px-4 py-3">{formaterDateFr(d.dateDebut)}</td>
                    <td className="px-4 py-3">{formaterDateFr(d.dateFin)}</td>
                    <td className="px-4 py-3">
                      <Badge couleur={COULEURS_STATUT_SPECIAL[d.statut]}>{LIBELLES_STATUT_SPECIAL[d.statut]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EtatVide
            icone={<IconeConges />}
            titre="Aucune demande"
            message="Vos demandes de congé maternité/paternité apparaîtront ici."
          />
        )}
      </div>

      <form onSubmit={creer} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Nouvelle demande</h3>
        <p className="mb-3 text-xs text-slate-400">
          Ne débite jamais le solde de congé annuel. Durée par défaut : 105 jours (≈ 3 mois 3 semaines) pour la
          maternité, 3 jours pour la paternité — ajustable par la RH à la validation.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <select value={type} onChange={(e) => setType(e.target.value as TypeCongeSpecial)} className={CHAMP}>
            <option value="maternite">Congé maternité</option>
            <option value="paternite">Congé paternité</option>
          </select>
          <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required className={CHAMP} />
          <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif (optionnel)" className={CHAMP} />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={justificatifFourni}
            onChange={(e) => setJustificatifFourni(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary-700 focus:ring-primary-100"
          />
          Justificatif fourni (certificat médical, acte de naissance…)
        </label>
        <button disabled={envoiEnCours} className={`${BOUTON} mt-3`}>
          {envoiEnCours ? 'Envoi...' : 'Soumettre la demande'}
        </button>
      </form>
    </>
  );
}

// ---------- Vue Gestion : Chef de service / RH Filiale / DRH / Super Admin ----------

function VueGestion({ jeton, role }: { jeton: string | null; role: string | null }) {
  const [onglet, setOnglet] = useState<'annuel' | 'special'>('annuel');
  const peutDonnerAvis = role === 'chef_service' || role === 'super_admin';
  const peutDecider = role === 'rh_filiale' || role === 'drh_holding' || role === 'super_admin';
  const peutCreer = role !== null && ROLES_CREATION.includes(role);

  const [demandes, setDemandes] = useState<DemandeCongeAvecEmploye[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enAttenteId, setEnAttenteId] = useState<string | null>(null);

  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [seulementATraiter, setSeulementATraiter] = useState(false);
  const [page, setPage] = useState(1);

  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [employeId, setEmployeId] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [motif, setMotif] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  function rafraichir() {
    if (!jeton) return;
    setChargement(true);
    api
      .listerToutesDemandesConges(jeton)
      .then(setDemandes)
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : 'Erreur de chargement'))
      .finally(() => setChargement(false));
  }

  useEffect(rafraichir, [jeton]);

  const estATraiter = (d: DemandeCongeAvecEmploye) =>
    (peutDonnerAvis && d.statut === 'soumise') ||
    (peutDecider && (d.statut === 'avis_favorable' || d.statut === 'avis_defavorable'));

  const filtres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return demandes.filter((d) => {
      if (seulementATraiter && !estATraiter(d)) return false;
      if (filtreStatut && d.statut !== filtreStatut) return false;
      if (terme) {
        const cible = `${d.employeMatricule} ${d.employeNom} ${d.employePrenoms}`.toLowerCase();
        if (!cible.includes(terme)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandes, recherche, filtreStatut, seulementATraiter, peutDonnerAvis, peutDecider]);

  const { trie, cle, sens, trierPar } = useTri<DemandeCongeAvecEmploye>(filtres, 'dateDebut');
  const totalPages = Math.max(1, Math.ceil(trie.length / PAR_PAGE));
  const pageBornee = Math.min(page, totalPages);
  const pageAffichee = trie.slice((pageBornee - 1) * PAR_PAGE, pageBornee * PAR_PAGE);

  useEffect(() => setPage(1), [recherche, filtreStatut, seulementATraiter]);

  const nbATraiter = useMemo(() => demandes.filter(estATraiter).length, [demandes, peutDonnerAvis, peutDecider]);

  async function donnerAvis(id: string, avis: 'favorable' | 'defavorable') {
    if (!jeton) return;
    setEnAttenteId(id);
    try {
      await api.donnerAvisConge(jeton, id, avis);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'avis");
    } finally {
      setEnAttenteId(null);
    }
  }

  async function decider(id: string, decision: 'validee' | 'rejetee') {
    if (!jeton) return;
    setEnAttenteId(id);
    try {
      await api.deciderConge(jeton, id, decision);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la décision');
    } finally {
      setEnAttenteId(null);
    }
  }

  async function creer(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !employeId || !dateDebut || !dateFin) return;
    setEnvoiEnCours(true);
    try {
      await api.creerDemandeConge(jeton, { employeId, dateDebut, dateFin, motif: motif || undefined });
      setEmployeId('');
      setDateDebut('');
      setDateFin('');
      setMotif('');
      setFormulaireOuvert(false);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la création');
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <MiseEnPage>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Congés</h2>
          <p className="text-sm text-slate-500">{demandes.length} demande(s) dans votre périmètre</p>
        </div>
        {peutCreer && onglet === 'annuel' && (
          <button onClick={() => setFormulaireOuvert((v) => !v)} className={BOUTON}>
            {formulaireOuvert ? 'Fermer' : '+ Nouvelle demande'}
          </button>
        )}
      </div>

      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {(
          [
            ['annuel', 'Congé annuel'],
            ['special', 'Maternité / Paternité'],
          ] as const
        ).map(([id, libelle]) => (
          <button
            key={id}
            onClick={() => setOnglet(id)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${
              onglet === id ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {libelle}
          </button>
        ))}
      </div>

      {onglet === 'special' && <SectionCongesSpeciauxGestion jeton={jeton} peutDecider={peutDecider} peutCreer={peutCreer} />}

      {onglet === 'annuel' && (peutDonnerAvis || peutDecider) && nbATraiter > 0 && (
        <button
          onClick={() => setSeulementATraiter((v) => !v)}
          className={`mb-6 flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors duration-200 ${
            seulementATraiter ? 'border-primary-600 bg-primary-50' : 'border-alerte-600/20 bg-alerte-100 hover:bg-alerte-100/70'
          }`}
        >
          <span className="mt-0.5 text-alerte-700">⚠</span>
          <span className="text-sm text-alerte-700">
            <strong>{nbATraiter} demande(s)</strong> en attente de votre {peutDonnerAvis && !peutDecider ? 'avis' : 'décision'} —
            cliquez pour {seulementATraiter ? 'afficher toutes les demandes' : 'filtrer sur celles-ci'}.
          </span>
        </button>
      )}

      {onglet === 'annuel' && (
        <>
      {erreur && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      {formulaireOuvert && peutCreer && (
        <form onSubmit={creer} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Nouvelle demande</h3>
          <div className="mb-3">
            <SelecteurEmploye valeur={employeId} onChange={setEmployeId} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required className={CHAMP} />
            <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} required className={CHAMP} />
            <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif (optionnel)" className={CHAMP} />
          </div>
          <button disabled={envoiEnCours} className={`${BOUTON} mt-3`}>
            {envoiEnCours ? 'Envoi...' : 'Soumettre la demande'}
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <EnTeteTriable label="Employé" cleColonne="employeNom" cleActive={cle} sens={sens} onTrier={trierPar} />
                  <EnTeteTriable label="Début" cleColonne="dateDebut" cleActive={cle} sens={sens} onTrier={trierPar} />
                  <th className="px-4 py-3">Fin</th>
                  <th className="px-4 py-3">Jours</th>
                  <EnTeteTriable label="Statut" cleColonne="statut" cleActive={cle} sens={sens} onTrier={trierPar} />
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageAffichee.map((d) => (
                  <tr key={d.id} className="transition-colors duration-200 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {d.employeNom} {d.employePrenoms}
                      <div className="font-mono text-xs font-normal text-slate-400">{d.employeMatricule}</div>
                    </td>
                    <td className="px-4 py-3">{formaterDateFr(d.dateDebut)}</td>
                    <td className="px-4 py-3">{formaterDateFr(d.dateFin)}</td>
                    <td className="px-4 py-3">{d.nbJours}</td>
                    <td className="px-4 py-3">
                      <Badge couleur={COULEURS_STATUT[d.statut]}>{LIBELLES_STATUT[d.statut]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        {peutDonnerAvis && d.statut === 'soumise' && (
                          <>
                            <button
                              disabled={enAttenteId === d.id}
                              onClick={() => donnerAvis(d.id, 'favorable')}
                              className="font-medium text-succes-700 transition-colors duration-200 hover:underline disabled:opacity-50"
                            >
                              Avis favorable
                            </button>
                            <button
                              disabled={enAttenteId === d.id}
                              onClick={() => donnerAvis(d.id, 'defavorable')}
                              className="font-medium text-erreur-600 transition-colors duration-200 hover:underline disabled:opacity-50"
                            >
                              Avis défavorable
                            </button>
                          </>
                        )}
                        {peutDecider && (d.statut === 'avis_favorable' || d.statut === 'avis_defavorable') && (
                          <>
                            <button
                              disabled={enAttenteId === d.id}
                              onClick={() => decider(d.id, 'validee')}
                              className="font-medium text-succes-700 transition-colors duration-200 hover:underline disabled:opacity-50"
                            >
                              Valider
                            </button>
                            <button
                              disabled={enAttenteId === d.id}
                              onClick={() => decider(d.id, 'rejetee')}
                              className="font-medium text-erreur-600 transition-colors duration-200 hover:underline disabled:opacity-50"
                            >
                              Rejeter
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            <Pagination page={pageBornee} totalPages={totalPages} onChange={setPage} totalItems={trie.length} parPage={PAR_PAGE} />
          </>
        ) : (
          <EtatVide
            icone={<IconeConges />}
            titre={demandes.length === 0 ? 'Aucune demande' : 'Aucun résultat'}
            message={
              demandes.length === 0
                ? 'Les demandes de congé apparaîtront ici.'
                : 'Aucune demande ne correspond à votre recherche ou vos filtres.'
            }
          />
        )}
      </div>
        </>
      )}
    </MiseEnPage>
  );
}

// ---------- Congés spéciaux (maternité / paternité) — vue gestion (RH) ----------

function SectionCongesSpeciauxGestion({
  jeton,
  peutDecider,
  peutCreer,
}: {
  jeton: string | null;
  peutDecider: boolean;
  peutCreer: boolean;
}) {
  const [demandes, setDemandes] = useState<DemandeCongeSpecialAvecEmploye[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [employeId, setEmployeId] = useState('');
  const [type, setType] = useState<TypeCongeSpecial>('maternite');
  const [dateDebut, setDateDebut] = useState('');
  const [justificatifFourni, setJustificatifFourni] = useState(false);
  const [motif, setMotif] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const [demandeATraiter, setDemandeATraiter] = useState<DemandeCongeSpecialAvecEmploye | null>(null);
  const [dateFinTraitement, setDateFinTraitement] = useState('');
  const [commentaireTraitement, setCommentaireTraitement] = useState('');
  const [traitementEnCours, setTraitementEnCours] = useState(false);

  function rafraichir() {
    if (!jeton) return;
    setChargement(true);
    api
      .listerToutesDemandesCongesSpeciaux(jeton)
      .then(setDemandes)
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : 'Erreur de chargement'))
      .finally(() => setChargement(false));
  }

  useEffect(rafraichir, [jeton]);

  async function creer(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !employeId || !dateDebut) return;
    setEnvoiEnCours(true);
    try {
      await api.creerDemandeCongeSpecial(jeton, { employeId, type, dateDebut, justificatifFourni, motif: motif || undefined });
      setEmployeId('');
      setDateDebut('');
      setJustificatifFourni(false);
      setMotif('');
      setFormulaireOuvert(false);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la création');
    } finally {
      setEnvoiEnCours(false);
    }
  }

  function ouvrirTraitement(d: DemandeCongeSpecialAvecEmploye) {
    setDemandeATraiter(d);
    setDateFinTraitement(d.dateFin);
    setCommentaireTraitement('');
  }

  async function traiter(decision: 'validee' | 'rejetee') {
    if (!jeton || !demandeATraiter) return;
    setTraitementEnCours(true);
    try {
      await api.deciderCongeSpecial(jeton, demandeATraiter.id, decision, dateFinTraitement, commentaireTraitement || undefined);
      setDemandeATraiter(null);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors du traitement');
    } finally {
      setTraitementEnCours(false);
    }
  }

  return (
    <>
      {erreur && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      {peutCreer && (
        <div className="mb-6 flex justify-end">
          <button onClick={() => setFormulaireOuvert((v) => !v)} className={BOUTON}>
            {formulaireOuvert ? 'Fermer' : '+ Nouvelle demande'}
          </button>
        </div>
      )}

      {formulaireOuvert && peutCreer && (
        <form onSubmit={creer} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Nouvelle demande</h3>
          <p className="mb-3 text-xs text-slate-400">
            Ne débite jamais le solde de congé annuel. Durée par défaut : 105 jours (≈ 3 mois 3 semaines) pour la
            maternité, 3 jours pour la paternité — ajustable à la validation.
          </p>
          <div className="mb-3">
            <SelecteurEmploye valeur={employeId} onChange={setEmployeId} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <select value={type} onChange={(e) => setType(e.target.value as TypeCongeSpecial)} className={CHAMP}>
              <option value="maternite">Congé maternité</option>
              <option value="paternite">Congé paternité</option>
            </select>
            <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required className={CHAMP} />
            <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif (optionnel)" className={CHAMP} />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={justificatifFourni}
              onChange={(e) => setJustificatifFourni(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary-700 focus:ring-primary-100"
            />
            Justificatif fourni (certificat médical, acte de naissance…)
          </label>
          <button disabled={envoiEnCours} className={`${BOUTON} mt-3`}>
            {envoiEnCours ? 'Envoi...' : 'Soumettre la demande'}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {chargement ? (
          <div className="space-y-3 p-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : demandes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Employé</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Début</th>
                  <th className="px-4 py-3">Fin</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {demandes.map((d) => (
                  <tr key={d.id} className="transition-colors duration-200 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {d.employeNom} {d.employePrenoms}
                      <div className="font-mono text-xs font-normal text-slate-400">{d.employeMatricule}</div>
                    </td>
                    <td className="px-4 py-3">{LIBELLES_TYPE_SPECIAL[d.type]}</td>
                    <td className="px-4 py-3">{formaterDateFr(d.dateDebut)}</td>
                    <td className="px-4 py-3">{formaterDateFr(d.dateFin)}</td>
                    <td className="px-4 py-3">
                      <Badge couleur={COULEURS_STATUT_SPECIAL[d.statut]}>{LIBELLES_STATUT_SPECIAL[d.statut]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {peutDecider && d.statut === 'soumise' && (
                        <button onClick={() => ouvrirTraitement(d)} className="font-medium text-primary-700 transition-colors duration-200 hover:underline">
                          Traiter
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EtatVide
            icone={<IconeConges />}
            titre="Aucune demande"
            message="Les demandes de congé maternité/paternité apparaîtront ici."
          />
        )}
      </div>

      {demandeATraiter && (
        <Modale
          titre={`Traiter — ${demandeATraiter.employeNom} ${demandeATraiter.employePrenoms}`}
          onFermer={() => setDemandeATraiter(null)}
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-600">{LIBELLES_TYPE_SPECIAL[demandeATraiter.type]} — début le {formaterDateFr(demandeATraiter.dateDebut)}</p>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Date de fin</label>
              <input
                type="date"
                value={dateFinTraitement}
                onChange={(e) => setDateFinTraitement(e.target.value)}
                className={`w-full ${CHAMP}`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Commentaire (optionnel)</label>
              <input
                value={commentaireTraitement}
                onChange={(e) => setCommentaireTraitement(e.target.value)}
                className={`w-full ${CHAMP}`}
              />
            </div>
            <div className="flex gap-3">
              <button
                disabled={traitementEnCours}
                onClick={() => traiter('validee')}
                className={`${BOUTON} disabled:pointer-events-none disabled:opacity-60`}
              >
                {traitementEnCours ? 'Envoi...' : 'Valider'}
              </button>
              <button
                disabled={traitementEnCours}
                onClick={() => traiter('rejetee')}
                className="rounded-md bg-erreur-600 px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-erreur-700 hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
              >
                Rejeter
              </button>
            </div>
          </div>
        </Modale>
      )}
    </>
  );
}
