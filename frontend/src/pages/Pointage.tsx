import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ErreurApi, api } from '../api/client';
import { Badge, CouleurBadge } from '../components/Badge';
import { EtatVide } from '../components/EtatVide';
import { IconePointage } from '../components/icones';
import { MiseEnPage } from '../components/MiseEnPage';
import { Modale } from '../components/Modale';
import { SelecteurEmploye } from '../components/SelecteurEmploye';
import { useAuth } from '../context/AuthContext';
import {
  AnomalieAbsence,
  Chantier,
  CodeAbsencePointage,
  EmployeAvecPointage,
  PointageMensuelAvecDetails,
  StatutPointageMensuel,
} from '../types/pointage';
import { formaterDateFr } from '../utils/date';
import { construireSemaines, quantiemeDuMois } from '../utils/pointageGrille';

const CHAMP =
  'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';
const LABEL = 'mb-1 block text-xs font-medium text-slate-600';
const BOUTON =
  'rounded-md bg-primary-700 px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-800 hover:shadow-md disabled:pointer-events-none disabled:opacity-60';
const ROLES_SAISIE = ['super_admin', 'drh_holding', 'rh_filiale', 'responsable_rh_chantier'];
const ROLES_VALIDATION = ['super_admin', 'drh_holding', 'rh_filiale'];

const LIBELLES_STATUT: Record<StatutPointageMensuel, string> = {
  brouillon: 'Brouillon',
  soumis: 'Soumis',
  valide: 'Validé',
  rejete: 'Rejeté',
};

const COULEURS_STATUT: Record<StatutPointageMensuel, CouleurBadge> = {
  brouillon: 'slate',
  soumis: 'primary',
  valide: 'succes',
  rejete: 'erreur',
};

function moisCourantISO() {
  return new Date().toISOString().slice(0, 7) + '-01';
}

// Premier/dernier jour du mois en cours, au format YYYY-MM-DD — sert de période par défaut
// (demande explicite) : remplir le mois complet avant de soumettre, plutôt que des petits bouts
// de dates qui, une fois soumis, bloquent toute saisie complémentaire pour le reste du mois
// (la fiche passe "soumis" dès la première soumission, cf. enregistrerFiche côté backend).
function premierEtDernierJourMoisCourant(): [string, string] {
  const maintenant = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const premier = new Date(Date.UTC(maintenant.getFullYear(), maintenant.getMonth(), 1));
  const dernier = new Date(Date.UTC(maintenant.getFullYear(), maintenant.getMonth() + 1, 0));
  return [fmt(premier), fmt(dernier)];
}

// Code court uniquement dans le <select> de la grille — une cellule fait ~60-80px de large,
// le libellé complet y déborde et se coupe (rendu cassé signalé par l'utilisateur). Le sens de
// chaque code est donné par la légende sous la grille (LEGENDE_CODE_ABSENCE) plutôt que répété
// dans chaque case.
const CODES_ABSENCE_COURTS: Record<CodeAbsencePointage, string> = {
  absence_injustifiee: 'ABI',
  repos_medical: 'RM',
  permission_non_payee: 'PNP',
  permission_payee: 'PP',
  conge_annuel: 'CA',
  ferie: 'F',
};

const LEGENDE_CODE_ABSENCE: Record<CodeAbsencePointage, string> = {
  absence_injustifiee: 'ABI = Absence injustifiée',
  repos_medical: 'RM = Repos médical',
  permission_non_payee: 'PNP = Permission non payée',
  permission_payee: 'PP = Permission payée',
  conge_annuel: 'CA = Congé annuel',
  ferie: 'F = Jour férié (non travaillé)',
};

interface SaisieJour {
  heures: string;
  codeAbsence: CodeAbsencePointage | '';
}

const JOUR_VIDE: SaisieJour = { heures: '', codeAbsence: '' };

export function Pointage() {
  const { jeton, role } = useAuth();
  const peutSaisir = role !== null && ROLES_SAISIE.includes(role);
  const peutValider = role !== null && ROLES_VALIDATION.includes(role);

  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  // --- Saisie / soumission ---
  const [employeId, setEmployeId] = useState('');
  const [chantierId, setChantierId] = useState('');
  const [periodeDebut, setPeriodeDebut] = useState(() => premierEtDernierJourMoisCourant()[0]);
  const [periodeFin, setPeriodeFin] = useState(() => premierEtDernierJourMoisCourant()[1]);
  const [jours, setJours] = useState<Record<string, SaisieJour>>({});
  const [ficheCourante, setFicheCourante] = useState<PointageMensuelAvecDetails | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [soumissionEnCours, setSoumissionEnCours] = useState(false);

  // --- Effectif du chantier (saisie « chantier d'abord ») ---
  const [roster, setRoster] = useState<EmployeAvecPointage[]>([]);
  const [chargementRoster, setChargementRoster] = useState(false);
  const [rechercheAutre, setRechercheAutre] = useState(false);

  // --- File d'attente RH siège ---
  const [fileAttente, setFileAttente] = useState<PointageMensuelAvecDetails[]>([]);
  const [chargementFile, setChargementFile] = useState(false);
  const [ficheEnAttente, setFicheEnAttente] = useState<PointageMensuelAvecDetails | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalieAbsence[]>([]);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  const [ficheARejeter, setFicheARejeter] = useState<PointageMensuelAvecDetails | null>(null);
  const [commentaireRejet, setCommentaireRejet] = useState('');
  const [ficheEnCours, setFicheEnCoursId] = useState<string | null>(null);

  // --- Export Excel ---
  const [exportChantierId, setExportChantierId] = useState('');
  const [exportStatut, setExportStatut] = useState('');
  const [exportMois, setExportMois] = useState(() => new Date().toISOString().slice(0, 7));
  const [exportEnCours, setExportEnCours] = useState(false);

  useEffect(() => {
    if (!jeton) return;
    api.listerChantiers(jeton).then(setChantiers);
  }, [jeton]);

  function rafraichirFileAttente() {
    if (!jeton || !peutValider) return;
    setChargementFile(true);
    api
      .listerFichesPointage(jeton, 'soumis')
      .then(setFileAttente)
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : 'Erreur de chargement'))
      .finally(() => setChargementFile(false));
  }

  useEffect(rafraichirFileAttente, [jeton, peutValider]);

  function chargerFicheExistante() {
    if (!jeton || !employeId || !periodeFin) return;
    const moisPaie = periodeFin.slice(0, 7) + '-01';
    api.obtenirFichePointageEmploye(jeton, employeId, moisPaie).then((fiche) => {
      if (!fiche) {
        setFicheCourante(null);
        setJours({});
        return;
      }
      setFicheCourante(fiche as unknown as PointageMensuelAvecDetails);
      setChantierId(fiche.chantierId);
      setPeriodeDebut(fiche.periodeDebut.slice(0, 10));
      const grille: Record<string, SaisieJour> = {};
      for (const j of fiche.jours) {
        grille[j.date.slice(0, 10)] = { heures: j.heures !== null ? String(j.heures) : '', codeAbsence: j.codeAbsence ?? '' };
      }
      setJours(grille);
    });
  }

  useEffect(chargerFicheExistante, [jeton, employeId, periodeFin]);

  function rafraichirRoster() {
    if (!jeton || !chantierId || !periodeFin) {
      setRoster([]);
      return;
    }
    const moisPaie = periodeFin.slice(0, 7) + '-01';
    setChargementRoster(true);
    api
      .listerEmployesChantier(jeton, chantierId, moisPaie)
      .then(setRoster)
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : "Erreur lors du chargement de l'effectif"))
      .finally(() => setChargementRoster(false));
  }

  useEffect(rafraichirRoster, [jeton, chantierId, periodeFin]);

  function choisirEmployeRoster(id: string) {
    setEmployeId(id);
  }

  const semaines = useMemo(
    () => (periodeDebut && periodeFin ? construireSemaines(periodeDebut, periodeFin) : []),
    [periodeDebut, periodeFin]
  );

  // Progression de remplissage de la période affichée — demande explicite : pouvoir voir que la
  // période est entièrement couverte avant de soumettre, plutôt que de soumettre un bout (ex. 7
  // au 9) et se retrouver bloqué pour compléter le reste du mois ensuite.
  const joursPeriode = useMemo(() => semaines.flat().filter((d): d is string => d !== null), [semaines]);
  const joursRemplis = joursPeriode.filter((d) => jours[d]?.heures || jours[d]?.codeAbsence).length;

  function definirHeures(date: string, valeur: string) {
    setJours((j) => ({ ...j, [date]: { heures: valeur, codeAbsence: valeur ? '' : (j[date]?.codeAbsence ?? '') } }));
  }

  function definirCodeAbsence(date: string, valeur: CodeAbsencePointage | '') {
    setJours((j) => ({ ...j, [date]: { heures: valeur ? '' : (j[date]?.heures ?? ''), codeAbsence: valeur } }));
  }

  async function enregistrer(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !employeId || !chantierId || !periodeDebut || !periodeFin) return;

    setEnvoiEnCours(true);
    setErreur(null);
    try {
      const joursSaisis = Object.entries(jours)
        .filter(([, j]) => j.heures !== '' || j.codeAbsence !== '')
        .map(([date, j]) => ({
          date,
          heures: j.heures !== '' ? Number(j.heures) : undefined,
          codeAbsence: j.codeAbsence !== '' ? j.codeAbsence : undefined,
        }));
      await api.enregistrerFichePointage(jeton, {
        employeId,
        chantierId,
        periodeDebut,
        periodeFin,
        jours: joursSaisis,
      });
      chargerFicheExistante();
      rafraichirRoster();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'enregistrement");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function soumettre() {
    if (!jeton || !ficheCourante) return;
    if (
      joursRemplis < joursPeriode.length &&
      !window.confirm(
        `Seulement ${joursRemplis} jour(s) sur ${joursPeriode.length} sont remplis sur cette période. Une fois soumise, la fiche ne pourra plus être complétée pour le reste du mois sans passer par un rejet RH. Soumettre quand même ?`
      )
    ) {
      return;
    }
    setSoumissionEnCours(true);
    try {
      await api.soumettreFichePointage(jeton, ficheCourante.id);
      chargerFicheExistante();
      rafraichirRoster();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la soumission');
    } finally {
      setSoumissionEnCours(false);
    }
  }

  async function ouvrirFiche(fiche: PointageMensuelAvecDetails) {
    setFicheEnAttente(fiche);
    setAnomalies([]);
    if (!jeton) return;
    const liste = await api.obtenirAnomaliesPointage(jeton, fiche.id);
    setAnomalies(liste);
  }

  async function valider(fiche: PointageMensuelAvecDetails) {
    if (!jeton) return;
    setActionEnCours(fiche.id);
    try {
      await api.validerFichePointage(jeton, fiche.id);
      setFicheEnAttente(null);
      rafraichirFileAttente();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la validation');
    } finally {
      setActionEnCours(null);
    }
  }

  async function confirmerRejet(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !ficheARejeter || !commentaireRejet) return;
    setActionEnCours(ficheARejeter.id);
    try {
      await api.rejeterFichePointage(jeton, ficheARejeter.id, commentaireRejet);
      setFicheARejeter(null);
      setCommentaireRejet('');
      setFicheEnAttente(null);
      rafraichirFileAttente();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors du rejet');
    } finally {
      setActionEnCours(null);
    }
  }

  async function telechargerPdf(id: string) {
    if (!jeton) return;
    setFicheEnCoursId(id);
    try {
      const blob = await api.obtenirFichePointagePdf(jeton, id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la génération de la fiche');
    } finally {
      setFicheEnCoursId(null);
    }
  }

  async function telechargerExcel() {
    if (!jeton) return;
    setExportEnCours(true);
    setErreur(null);
    try {
      const blob = await api.exporterPointageExcel(jeton, `${exportMois}-01`, exportStatut || undefined, exportChantierId || undefined);
      const url = URL.createObjectURL(blob);
      const lien = document.createElement('a');
      lien.href = url;
      lien.download = `pointage-${exportMois}.xlsx`;
      lien.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'export Excel");
    } finally {
      setExportEnCours(false);
    }
  }

  return (
    <MiseEnPage>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Pointage</h2>
      <p className="mb-6 text-sm text-slate-500">Saisie par chantier, validation par le RH siège avant prise en compte en paie</p>

      {erreur && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      {peutValider && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">
            File d'attente — {fileAttente.length} fiche(s) soumise(s)
          </h3>
          {chargementFile ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          ) : fileAttente.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Employé</th>
                  <th className="px-2 py-2">Chantier</th>
                  <th className="px-2 py-2">Période</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fileAttente.map((f) => (
                  <tr key={f.id} className="transition-colors duration-200 hover:bg-slate-50">
                    <td className="px-2 py-2 font-medium text-slate-900">
                      {f.employeNom} {f.employePrenoms}
                    </td>
                    <td className="px-2 py-2 text-slate-600">{f.chantierNom}</td>
                    <td className="px-2 py-2">
                      {formaterDateFr(f.periodeDebut)} → {formaterDateFr(f.periodeFin)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button onClick={() => ouvrirFiche(f)} className="font-medium text-primary-700 hover:underline">
                        Examiner
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EtatVide icone={<IconePointage />} titre="Rien à valider" message="Aucune fiche en attente actuellement." />
          )}
        </div>
      )}

      {peutSaisir && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Export Pointage</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className={LABEL}>Mois</label>
              <input type="month" value={exportMois} onChange={(e) => setExportMois(e.target.value)} className={CHAMP} />
            </div>
            <div>
              <label className={LABEL}>Chantier</label>
              <select value={exportChantierId} onChange={(e) => setExportChantierId(e.target.value)} className={CHAMP}>
                <option value="">Tous</option>
                {chantiers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Statut</label>
              <select value={exportStatut} onChange={(e) => setExportStatut(e.target.value)} className={CHAMP}>
                <option value="">Tous</option>
                {(Object.keys(LIBELLES_STATUT) as StatutPointageMensuel[]).map((s) => (
                  <option key={s} value={s}>
                    {LIBELLES_STATUT[s]}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" disabled={exportEnCours} onClick={telechargerExcel} className={BOUTON}>
              {exportEnCours ? 'Génération...' : 'Télécharger en Excel'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Fichier .xlsx — détail hebdomadaire (onglet « decorticage ») et fiche horaire par employé, pour les fiches
            correspondant aux filtres ci-dessus.
          </p>
        </div>
      )}

      {peutSaisir && (
        <form onSubmit={enregistrer} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Fiche de pointage mensuelle</h3>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className={LABEL}>Chantier</label>
              <select
                value={chantierId}
                onChange={(e) => {
                  setChantierId(e.target.value);
                  setEmployeId('');
                }}
                required
                className={CHAMP}
              >
                <option value="">— Choisir —</option>
                {chantiers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Période du</label>
              <input type="date" value={periodeDebut} onChange={(e) => setPeriodeDebut(e.target.value)} required className={CHAMP} />
            </div>
            <div>
              <label className={LABEL}>au</label>
              <input
                type="date"
                value={periodeFin}
                min={periodeDebut || undefined}
                onChange={(e) => setPeriodeFin(e.target.value)}
                required
                className={CHAMP}
              />
            </div>
            <div>
              <label className={LABEL}>Statut de la fiche</label>
              <div className="pt-1.5">
                {!employeId ? (
                  <span className="text-xs text-slate-400">— </span>
                ) : ficheCourante ? (
                  <Badge couleur={COULEURS_STATUT[ficheCourante.statut]}>{LIBELLES_STATUT[ficheCourante.statut]}</Badge>
                ) : (
                  <span className="text-xs text-slate-400">Nouvelle fiche</span>
                )}
              </div>
            </div>
          </div>

          {chantierId && periodeFin && (
            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between">
                <label className={LABEL}>Effectif du chantier{roster.length > 0 ? ` — ${roster.length} employé(s)` : ''}</label>
                <button
                  type="button"
                  onClick={() => setRechercheAutre((v) => !v)}
                  className="mb-1 text-xs font-medium text-primary-700 hover:underline"
                >
                  {rechercheAutre ? 'Masquer la recherche' : 'Employé hors effectif ?'}
                </button>
              </div>

              {rechercheAutre && (
                <div className="mb-3">
                  <SelecteurEmploye valeur={employeId} onChange={setEmployeId} />
                </div>
              )}

              {chargementRoster ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-9 animate-pulse rounded bg-slate-100" />
                  ))}
                </div>
              ) : roster.length > 0 ? (
                <div className="overflow-hidden rounded-md border border-slate-200">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-100">
                      {roster.map((r) => (
                        <tr
                          key={r.employeId}
                          onClick={() => choisirEmployeRoster(r.employeId)}
                          className={`cursor-pointer transition-colors duration-200 hover:bg-slate-50 ${
                            employeId === r.employeId ? 'bg-primary-50' : ''
                          }`}
                        >
                          <td className="px-3 py-2 font-medium text-slate-900">
                            {r.nom} {r.prenoms}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{r.matricule}</td>
                          <td className="px-3 py-2 text-right">
                            {r.statut ? (
                              <Badge couleur={COULEURS_STATUT[r.statut]}>{LIBELLES_STATUT[r.statut]}</Badge>
                            ) : (
                              <span className="text-xs text-slate-400">Non commencé</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EtatVide
                  icone={<IconePointage />}
                  titre="Aucun employé"
                  message="Aucun employé actif n'est affecté à ce chantier — utilisez « Employé hors effectif » ci-dessus si besoin."
                />
              )}
            </div>
          )}

          {ficheCourante?.statut === 'rejete' && ficheCourante.commentaireRejet && (
            <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              Rejetée : {ficheCourante.commentaireRejet}
            </div>
          )}

          {employeId && semaines.length > 0 && (
            <div className="mb-3">
              <label className={LABEL}>Grille journalière — heures travaillées ou code d'absence</label>
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full min-w-[760px] text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-left text-slate-500">
                      {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((libelle) => (
                        <th key={libelle} className="px-1.5 py-1.5 font-medium">
                          {libelle}
                        </th>
                      ))}
                      <th className="px-1.5 py-1.5 text-center font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {semaines.map((semaine, i) => {
                      const totalSemaine = semaine.reduce(
                        (s, date) => s + (date && jours[date]?.heures ? Number(jours[date].heures) : 0),
                        0
                      );
                      return (
                        <tr key={i}>
                          {semaine.map((date, j) => (
                            <td key={j} className="px-1.5 py-1 align-top">
                              {date && (
                                <div className="space-y-0.5">
                                  <div className="text-[10px] text-slate-400">{quantiemeDuMois(date)}</div>
                                  <input
                                    type="number"
                                    min="0"
                                    max="24"
                                    step="0.5"
                                    placeholder="h"
                                    value={jours[date]?.heures ?? ''}
                                    onChange={(e) => definirHeures(date, e.target.value)}
                                    className="w-14 rounded border border-slate-300 px-1 py-0.5 text-xs focus:border-primary-500 focus:outline-none"
                                  />
                                  <select
                                    value={jours[date]?.codeAbsence ?? ''}
                                    onChange={(e) => definirCodeAbsence(date, e.target.value as CodeAbsencePointage | '')}
                                    className="w-full rounded border border-slate-300 px-1 py-0.5 text-[10px] focus:border-primary-500 focus:outline-none"
                                  >
                                    <option value="">—</option>
                                    {(Object.keys(CODES_ABSENCE_COURTS) as CodeAbsencePointage[]).map((code) => (
                                      <option key={code} value={code} title={LEGENDE_CODE_ABSENCE[code]}>
                                        {CODES_ABSENCE_COURTS[code]}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </td>
                          ))}
                          <td className="px-1.5 py-1 text-center font-medium text-slate-700">{totalSemaine || ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                {(Object.keys(LEGENDE_CODE_ABSENCE) as CodeAbsencePointage[])
                  .map((code) => LEGENDE_CODE_ABSENCE[code])
                  .join(' · ')}
              </p>
            </div>
          )}

          {ficheCourante && (
            <div className="mb-1 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-4">
              <p>
                HS 15% : <span className="font-medium text-slate-800">{ficheCourante.heuresHs15} h</span>
              </p>
              <p>
                HS 35% : <span className="font-medium text-slate-800">{ficheCourante.heuresHs35} h</span>
              </p>
              <p>
                HS 60% : <span className="font-medium text-slate-800">{ficheCourante.heuresHs60} h</span>
              </p>
              <p>
                Jours panier : <span className="font-medium text-slate-800">{ficheCourante.joursPanier}</span>
              </p>
              <p>
                Absence injustifiée : <span className="font-medium text-slate-800">{ficheCourante.nbJoursAbsenceInjustifiee} j</span>
              </p>
              <p>
                Repos médical : <span className="font-medium text-slate-800">{ficheCourante.nbJoursReposMedical} j</span>
              </p>
              <p>
                Permission non payée : <span className="font-medium text-slate-800">{ficheCourante.nbJoursPermissionNonPayee} j</span>
              </p>
              <p>
                Permission payée : <span className="font-medium text-slate-800">{ficheCourante.nbJoursPermissionPayee} j</span>
              </p>
              <p>
                Congé annuel : <span className="font-medium text-slate-800">{ficheCourante.nbJoursCongeAnnuel} j</span>
              </p>
            </div>
          )}
          {employeId && (
            <>
              <p className="mb-1 text-[11px] text-slate-400">
                Heures sup., panier et absences sont calculés automatiquement depuis la grille, après enregistrement.
              </p>
              {joursPeriode.length > 0 && (
                <p className="mb-3 text-xs font-medium text-slate-600">
                  {joursRemplis} / {joursPeriode.length} jour(s) remplis sur la période affichée
                  {joursRemplis < joursPeriode.length
                    ? ' — complétez avant de soumettre pour ne pas rester bloqué sur le reste du mois.'
                    : ' — période complète.'}
                </p>
              )}

              <div className="flex gap-3">
                <button disabled={envoiEnCours} className={BOUTON}>
                  {envoiEnCours ? 'Enregistrement...' : 'Enregistrer le brouillon'}
                </button>
                {ficheCourante && (ficheCourante.statut === 'brouillon' || ficheCourante.statut === 'rejete') && (
                  <button
                    type="button"
                    disabled={soumissionEnCours}
                    onClick={soumettre}
                    className="rounded-md border border-primary-600 px-4 py-2 text-sm font-medium text-primary-700 transition-colors duration-200 hover:bg-primary-50 disabled:opacity-50"
                  >
                    {soumissionEnCours ? 'Envoi...' : 'Soumettre au RH siège'}
                  </button>
                )}
                {ficheCourante && (
                  <button
                    type="button"
                    disabled={ficheEnCours === ficheCourante.id}
                    onClick={() => telechargerPdf(ficheCourante.id)}
                    className="ml-auto font-medium text-primary-700 hover:underline"
                  >
                    Fiche PDF
                  </button>
                )}
              </div>
            </>
          )}
        </form>
      )}

      {!peutSaisir && !peutValider && (
        <EtatVide icone={<IconePointage />} titre="Aucun accès" message="Votre rôle ne donne pas accès au module Pointage." />
      )}

      {ficheEnAttente && (
        <Modale
          titre={`${ficheEnAttente.employeNom} ${ficheEnAttente.employePrenoms} — ${ficheEnAttente.chantierNom}`}
          onFermer={() => setFicheEnAttente(null)}
        >
          <div className="space-y-2 text-sm">
            <p>
              Période : {formaterDateFr(ficheEnAttente.periodeDebut)} → {formaterDateFr(ficheEnAttente.periodeFin)}
            </p>
            <p>HS 15/35/60% : {ficheEnAttente.heuresHs15} / {ficheEnAttente.heuresHs35} / {ficheEnAttente.heuresHs60} h</p>
            <p>Jours panier : {ficheEnAttente.joursPanier}</p>
            <p>
              Absences : injustifiée {ficheEnAttente.nbJoursAbsenceInjustifiee} · repos médical {ficheEnAttente.nbJoursReposMedical} ·
              permission non payée {ficheEnAttente.nbJoursPermissionNonPayee} · permission payée {ficheEnAttente.nbJoursPermissionPayee} ·
              congé annuel {ficheEnAttente.nbJoursCongeAnnuel}
            </p>

            {anomalies.length > 0 && (
              <div className="rounded-md bg-alerte-100 px-3 py-2 text-alerte-700">
                <p className="mb-1 font-medium">⚠ {anomalies.length} anomalie(s) détectée(s) :</p>
                <ul className="list-inside list-disc space-y-0.5">
                  {anomalies.map((a, i) => (
                    <li key={i}>
                      {formaterDateFr(a.date)} — {a.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                disabled={actionEnCours === ficheEnAttente.id}
                onClick={() => valider(ficheEnAttente)}
                className="font-medium text-succes-700 hover:underline disabled:opacity-50"
              >
                Valider
              </button>
              <button
                onClick={() => {
                  setFicheARejeter(ficheEnAttente);
                  setFicheEnAttente(null);
                }}
                className="font-medium text-erreur-600 hover:underline"
              >
                Rejeter
              </button>
              <button onClick={() => telechargerPdf(ficheEnAttente.id)} className="ml-auto font-medium text-primary-700 hover:underline">
                Fiche PDF
              </button>
            </div>
          </div>
        </Modale>
      )}

      {ficheARejeter && (
        <Modale titre={`Rejeter — ${ficheARejeter.employeNom} ${ficheARejeter.employePrenoms}`} onFermer={() => setFicheARejeter(null)}>
          <form onSubmit={confirmerRejet} className="space-y-3">
            <div>
              <label className={LABEL}>Motif du rejet</label>
              <textarea value={commentaireRejet} onChange={(e) => setCommentaireRejet(e.target.value)} required rows={3} className={CHAMP} />
            </div>
            <button
              disabled={actionEnCours === ficheARejeter.id}
              className="rounded-md bg-erreur-600 px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-erreur-700 hover:shadow-md disabled:opacity-60"
            >
              {actionEnCours === ficheARejeter.id ? 'Envoi...' : 'Confirmer le rejet'}
            </button>
          </form>
        </Modale>
      )}
    </MiseEnPage>
  );
}
