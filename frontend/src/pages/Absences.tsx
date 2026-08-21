import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ErreurApi, api } from '../api/client';
import { Badge, CouleurBadge } from '../components/Badge';
import { ChampRecherche } from '../components/ChampRecherche';
import { EnTeteTriable } from '../components/EnTeteTriable';
import { EtatVide } from '../components/EtatVide';
import { FiltreSelect } from '../components/FiltreSelect';
import { IconeAbsences } from '../components/icones';
import { MiseEnPage } from '../components/MiseEnPage';
import { Modale } from '../components/Modale';
import { Pagination } from '../components/Pagination';
import { SelecteurEmploye } from '../components/SelecteurEmploye';
import { useAuth } from '../context/AuthContext';
import { useTri } from '../hooks/useTri';
import { StatutDemandeConge } from '../types/conges';
import {
  ClassificationAbsence,
  DemandeAbsence,
  DemandeAbsenceAvecEmploye,
  EvenementBareme,
  SoldePermissionExceptionnelle,
  TypeDemandeAbsence,
} from '../types/absences';
import { formaterDateFr } from '../utils/date';

const CHAMP =
  'rounded-md border border-slate-300 px-2.5 py-1.5 text-sm transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';
const BOUTON =
  'rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-800 hover:shadow-md disabled:pointer-events-none disabled:opacity-60';
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

const LIBELLES_TYPE: Record<TypeDemandeAbsence, string> = {
  permission_exceptionnelle: 'Permission exceptionnelle',
  absence_hors_bareme: 'Absence hors barème',
};

const LIBELLES_CLASSIFICATION: Record<ClassificationAbsence, string> = {
  non_deductible: 'Non déductible',
  deductible_conge: 'Déductible des congés',
  sans_solde: 'Sans solde',
};

async function ouvrirFichePdf(jeton: string, id: string, surErreur: (message: string) => void) {
  try {
    const blob = await api.obtenirFicheAbsencePdf(jeton, id);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    surErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la génération de la fiche');
  }
}

function TuileSolde({ libelle, valeur }: { libelle: string; valeur: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{libelle}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 [font-variant-numeric:tabular-nums]">{valeur} j</p>
    </div>
  );
}

function FormulaireDemande({
  employeSelecteur,
  bareme,
  onSoumettre,
  envoiEnCours,
}: {
  employeSelecteur?: React.ReactNode;
  bareme: EvenementBareme[];
  envoiEnCours: boolean;
  onSoumettre: (donnees: {
    type: TypeDemandeAbsence;
    motifBareme?: string;
    motif: string;
    dateDebut: string;
    dateFin: string;
    justificatifFourni: boolean;
  }) => void;
}) {
  const [type, setType] = useState<TypeDemandeAbsence>('permission_exceptionnelle');
  const [motifBareme, setMotifBareme] = useState('');
  const [motif, setMotif] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [justificatifFourni, setJustificatifFourni] = useState(false);

  const evenement = bareme.find((e) => e.cle === motifBareme);

  function soumettre(evenementForm: FormEvent) {
    evenementForm.preventDefault();
    if (!dateDebut || !dateFin || !motif) return;
    if (type === 'permission_exceptionnelle' && !motifBareme) return;

    onSoumettre({
      type,
      motifBareme: type === 'permission_exceptionnelle' ? motifBareme : undefined,
      motif,
      dateDebut,
      dateFin,
      justificatifFourni,
    });

    setMotifBareme('');
    setMotif('');
    setDateDebut('');
    setDateFin('');
    setJustificatifFourni(false);
  }

  return (
    <form onSubmit={soumettre} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Nouvelle demande</h3>

      {employeSelecteur && <div className="mb-3">{employeSelecteur}</div>}

      <div className="mb-3 flex gap-2">
        {(Object.keys(LIBELLES_TYPE) as TypeDemandeAbsence[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setType(t);
              setMotifBareme('');
            }}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
              type === t ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {LIBELLES_TYPE[t]}
          </button>
        ))}
      </div>

      {type === 'permission_exceptionnelle' && (
        <div className="mb-3">
          <select value={motifBareme} onChange={(e) => setMotifBareme(e.target.value)} required className={`w-full ${CHAMP}`}>
            <option value="">Sélectionner l'événement…</option>
            {bareme.map((e) => (
              <option key={e.cle} value={e.cle}>
                {e.libelle} ({e.jours} j)
              </option>
            ))}
          </select>
          {evenement && (
            <p className="mt-1 text-xs text-slate-500">
              Barème : {evenement.jours} jour(s) non déductible(s). Au-delà, l'excédent est soumis à classification RH.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required className={CHAMP} />
        <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} required className={CHAMP} />
        <input
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder={type === 'permission_exceptionnelle' ? 'Précision (ex. nom du conjoint)' : 'Motif'}
          required
          className={CHAMP}
        />
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={justificatifFourni} onChange={(e) => setJustificatifFourni(e.target.checked)} />
        Justificatif fourni (pièce d'état-civil ou attestation administrative)
      </label>

      <button disabled={envoiEnCours} className={`${BOUTON} mt-3`}>
        {envoiEnCours ? 'Envoi...' : 'Soumettre la demande'}
      </button>
    </form>
  );
}

function LigneDemande({ d, jeton, surErreur }: { d: DemandeAbsence; jeton: string; surErreur: (m: string) => void }) {
  return (
    <>
      <td className="px-4 py-3">
        <span className="font-medium text-slate-900">{LIBELLES_TYPE[d.type]}</span>
        <div className="text-xs text-slate-400">{d.motif}</div>
      </td>
      <td className="px-4 py-3">{formaterDateFr(d.dateDebut)}</td>
      <td className="px-4 py-3">{formaterDateFr(d.dateFin)}</td>
      <td className="px-4 py-3">
        {d.nbJours} j
        {d.nbJoursHorsBareme > 0 && (
          <div className="text-xs text-alerte-700">dont {d.nbJoursHorsBareme} j hors barème</div>
        )}
      </td>
      <td className="px-4 py-3">
        <Badge couleur={COULEURS_STATUT[d.statut]}>{LIBELLES_STATUT[d.statut]}</Badge>
        {d.classification && (
          <div className="mt-1 text-xs text-slate-500">{LIBELLES_CLASSIFICATION[d.classification]}</div>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => ouvrirFichePdf(jeton, d.id, surErreur)}
          className="font-medium text-primary-700 transition-colors duration-200 hover:underline"
        >
          Fiche PDF
        </button>
      </td>
    </>
  );
}

export function Absences() {
  const { jeton, role, employeId: monEmployeId } = useAuth();

  if (role === 'employe') {
    return <VueEmploye jeton={jeton} employeId={monEmployeId} />;
  }

  return <VueGestion jeton={jeton} role={role} />;
}

// ---------- Vue Employé ----------

function VueEmploye({ jeton, employeId }: { jeton: string | null; employeId: string | null }) {
  const [solde, setSolde] = useState<SoldePermissionExceptionnelle | null>(null);
  const [demandes, setDemandes] = useState<DemandeAbsence[]>([]);
  const [bareme, setBareme] = useState<EvenementBareme[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  function rafraichir() {
    if (!jeton || !employeId) return;
    const annee = new Date().getFullYear();
    Promise.all([
      api.obtenirSoldePermission(jeton, employeId, annee),
      api.listerDemandesAbsences(jeton, employeId),
    ])
      .then(([s, d]) => {
        setSolde(s);
        setDemandes(d);
      })
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : 'Erreur de chargement'));
  }

  useEffect(rafraichir, [jeton, employeId]);
  useEffect(() => {
    if (jeton) api.obtenirBaremePermissions(jeton).then(setBareme);
  }, [jeton]);

  async function creer(donnees: {
    type: TypeDemandeAbsence;
    motifBareme?: string;
    motif: string;
    dateDebut: string;
    dateFin: string;
    justificatifFourni: boolean;
  }) {
    if (!jeton || !employeId) return;
    setEnvoiEnCours(true);
    setErreur(null);
    try {
      await api.creerDemandeAbsence(jeton, { employeId, ...donnees });
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
          icone={<IconeAbsences />}
          titre="Compte non rattaché à un dossier employé"
          message="Contactez votre RH pour rattacher votre compte à un dossier employé."
        />
      </MiseEnPage>
    );
  }

  return (
    <MiseEnPage>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Mes permissions et absences</h2>

      {erreur && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      {solde && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <TuileSolde libelle="Pool permissions dispo" valeur={solde.soldeDisponible} />
          <TuileSolde libelle="Quota annuel" valeur={solde.quota} />
          <TuileSolde libelle="Consommé" valeur={solde.joursConsommes} />
        </div>
      )}

      <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {demandes.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Début</th>
                <th className="px-4 py-3">Fin</th>
                <th className="px-4 py-3">Jours</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {demandes.map((d) => (
                <tr key={d.id} className="transition-colors duration-200 hover:bg-slate-50">
                  <LigneDemande d={d} jeton={jeton ?? ''} surErreur={setErreur} />
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EtatVide icone={<IconeAbsences />} titre="Aucune demande" message="Vos permissions et absences apparaîtront ici." />
        )}
      </div>

      <FormulaireDemande bareme={bareme} envoiEnCours={envoiEnCours} onSoumettre={creer} />
    </MiseEnPage>
  );
}

// ---------- Vue Gestion ----------

function VueGestion({ jeton, role }: { jeton: string | null; role: string | null }) {
  const peutDonnerAvis = role === 'chef_service' || role === 'super_admin';
  const peutDecider = role === 'rh_filiale' || role === 'drh_holding' || role === 'super_admin';
  const peutCreer = role !== null && ROLES_CREATION.includes(role);

  const [demandes, setDemandes] = useState<DemandeAbsenceAvecEmploye[]>([]);
  const [bareme, setBareme] = useState<EvenementBareme[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enAttenteId, setEnAttenteId] = useState<string | null>(null);

  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [seulementATraiter, setSeulementATraiter] = useState(false);
  const [page, setPage] = useState(1);

  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [employeId, setEmployeId] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [demandeAClassifier, setDemandeAClassifier] = useState<DemandeAbsenceAvecEmploye | null>(null);

  function rafraichir() {
    if (!jeton) return;
    setChargement(true);
    api
      .listerToutesDemandesAbsences(jeton)
      .then(setDemandes)
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : 'Erreur de chargement'))
      .finally(() => setChargement(false));
  }

  useEffect(rafraichir, [jeton]);
  useEffect(() => {
    if (jeton) api.obtenirBaremePermissions(jeton).then(setBareme);
  }, [jeton]);

  const estATraiter = (d: DemandeAbsenceAvecEmploye) =>
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

  const { trie, cle, sens, trierPar } = useTri<DemandeAbsenceAvecEmploye>(filtres, 'dateDebut');
  const totalPages = Math.max(1, Math.ceil(trie.length / PAR_PAGE));
  const pageBornee = Math.min(page, totalPages);
  const pageAffichee = trie.slice((pageBornee - 1) * PAR_PAGE, pageBornee * PAR_PAGE);

  useEffect(() => setPage(1), [recherche, filtreStatut, seulementATraiter]);

  const nbATraiter = useMemo(() => demandes.filter(estATraiter).length, [demandes, peutDonnerAvis, peutDecider]);

  async function donnerAvis(id: string, avis: 'favorable' | 'defavorable') {
    if (!jeton) return;
    setEnAttenteId(id);
    try {
      await api.donnerAvisAbsence(jeton, id, avis);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'avis");
    } finally {
      setEnAttenteId(null);
    }
  }

  async function decider(id: string, decision: 'validee' | 'rejetee', classification?: ClassificationAbsence) {
    if (!jeton) return;
    setEnAttenteId(id);
    try {
      await api.deciderAbsence(jeton, id, decision, classification);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la décision');
    } finally {
      setEnAttenteId(null);
    }
  }

  function demanderValidation(d: DemandeAbsenceAvecEmploye) {
    if (d.nbJoursHorsBareme > 0) {
      setDemandeAClassifier(d);
      return;
    }
    decider(d.id, 'validee');
  }

  async function creer(donnees: {
    type: TypeDemandeAbsence;
    motifBareme?: string;
    motif: string;
    dateDebut: string;
    dateFin: string;
    justificatifFourni: boolean;
  }) {
    if (!jeton || !employeId) return;
    setEnvoiEnCours(true);
    try {
      await api.creerDemandeAbsence(jeton, { employeId, ...donnees });
      setEmployeId('');
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
          <h2 className="text-lg font-semibold text-slate-900">Absences</h2>
          <p className="text-sm text-slate-500">
            {demandes.length} demande(s) dans votre périmètre — permissions exceptionnelles et absences hors barème
          </p>
        </div>
        {peutCreer && (
          <button onClick={() => setFormulaireOuvert((v) => !v)} className={BOUTON}>
            {formulaireOuvert ? 'Fermer' : '+ Nouvelle demande'}
          </button>
        )}
      </div>

      {(peutDonnerAvis || peutDecider) && nbATraiter > 0 && (
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

      {erreur && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      {formulaireOuvert && peutCreer && (
        <div className="mb-6">
          <FormulaireDemande
            employeSelecteur={<SelecteurEmploye valeur={employeId} onChange={setEmployeId} />}
            bareme={bareme}
            envoiEnCours={envoiEnCours}
            onSoumettre={creer}
          />
        </div>
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Employé</th>
                  <th className="px-4 py-3">Type</th>
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
                    <td className="px-4 py-3">{LIBELLES_TYPE[d.type]}</td>
                    <td className="px-4 py-3">{formaterDateFr(d.dateDebut)}</td>
                    <td className="px-4 py-3">{formaterDateFr(d.dateFin)}</td>
                    <td className="px-4 py-3">
                      {d.nbJours} j
                      {d.nbJoursHorsBareme > 0 && (
                        <div className="text-xs text-alerte-700">dont {d.nbJoursHorsBareme} j hors barème</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge couleur={COULEURS_STATUT[d.statut]}>{LIBELLES_STATUT[d.statut]}</Badge>
                      {d.classification && (
                        <div className="mt-1 text-xs text-slate-500">{LIBELLES_CLASSIFICATION[d.classification]}</div>
                      )}
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
                              onClick={() => demanderValidation(d)}
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
                        {jeton && (
                          <button
                            onClick={() => ouvrirFichePdf(jeton, d.id, setErreur)}
                            className="font-medium text-primary-700 transition-colors duration-200 hover:underline"
                          >
                            Fiche PDF
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={pageBornee} totalPages={totalPages} onChange={setPage} totalItems={trie.length} parPage={PAR_PAGE} />
          </>
        ) : (
          <EtatVide
            icone={<IconeAbsences />}
            titre={demandes.length === 0 ? 'Aucune demande' : 'Aucun résultat'}
            message={
              demandes.length === 0
                ? 'Les permissions exceptionnelles et absences hors barème apparaîtront ici.'
                : 'Aucune demande ne correspond à votre recherche ou vos filtres.'
            }
          />
        )}
      </div>

      {demandeAClassifier && (
        <Modale
          titre={`Classification — ${demandeAClassifier.employeNom} ${demandeAClassifier.employePrenoms}`}
          onFermer={() => setDemandeAClassifier(null)}
        >
          <p className="mb-4 text-sm text-slate-600">
            {demandeAClassifier.nbJoursBareme > 0 && (
              <>
                {demandeAClassifier.nbJoursBareme} jour(s) couvert(s) par le barème restent non déductibles.
                <br />
              </>
            )}
            Choisissez le traitement des <strong>{demandeAClassifier.nbJoursHorsBareme} jour(s) hors barème</strong> :
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                decider(demandeAClassifier.id, 'validee', 'deductible_conge');
                setDemandeAClassifier(null);
              }}
              className="rounded-md border border-slate-300 px-4 py-2 text-left text-sm font-medium text-slate-800 transition-colors duration-200 hover:bg-slate-50"
            >
              Déductible des congés — retire les jours du solde de congé administratif
            </button>
            <button
              onClick={() => {
                decider(demandeAClassifier.id, 'validee', 'sans_solde');
                setDemandeAClassifier(null);
              }}
              className="rounded-md border border-slate-300 px-4 py-2 text-left text-sm font-medium text-slate-800 transition-colors duration-200 hover:bg-slate-50"
            >
              Sans solde — aucun débit du solde de congé
            </button>
          </div>
        </Modale>
      )}
    </MiseEnPage>
  );
}
