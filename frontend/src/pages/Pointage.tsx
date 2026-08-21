import { FormEvent, useEffect, useState } from 'react';
import { ErreurApi, api } from '../api/client';
import { Badge, CouleurBadge } from '../components/Badge';
import { EtatVide } from '../components/EtatVide';
import { IconePointage } from '../components/icones';
import { MiseEnPage } from '../components/MiseEnPage';
import { Modale } from '../components/Modale';
import { SelecteurEmploye } from '../components/SelecteurEmploye';
import { useAuth } from '../context/AuthContext';
import { AnomalieAbsence, Chantier, PointageMensuelAvecDetails, StatutPointageMensuel } from '../types/pointage';
import { formaterDateFr } from '../utils/date';

const CHAMP =
  'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';
const LABEL = 'mb-1 block text-xs font-medium text-slate-600';
const BOUTON =
  'rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-800 hover:shadow-md disabled:pointer-events-none disabled:opacity-60';
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

export function Pointage() {
  const { jeton, role } = useAuth();
  const peutSaisir = role !== null && ROLES_SAISIE.includes(role);
  const peutValider = role !== null && ROLES_VALIDATION.includes(role);

  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  // --- Saisie / soumission ---
  const [employeId, setEmployeId] = useState('');
  const [chantierId, setChantierId] = useState('');
  const [periodeDebut, setPeriodeDebut] = useState('');
  const [periodeFin, setPeriodeFin] = useState('');
  const [heuresHs15, setHeuresHs15] = useState('0');
  const [heuresHs35, setHeuresHs35] = useState('0');
  const [heuresHs60, setHeuresHs60] = useState('0');
  const [joursPanier, setJoursPanier] = useState('0');
  const [nbAbsenceInjustifiee, setNbAbsenceInjustifiee] = useState('0');
  const [nbReposMedical, setNbReposMedical] = useState('0');
  const [nbPermissionNonPayee, setNbPermissionNonPayee] = useState('0');
  const [nbPermissionPayee, setNbPermissionPayee] = useState('0');
  const [nbCongeAnnuel, setNbCongeAnnuel] = useState('0');
  const [ficheCourante, setFicheCourante] = useState<PointageMensuelAvecDetails | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [soumissionEnCours, setSoumissionEnCours] = useState(false);

  // --- File d'attente RH siège ---
  const [fileAttente, setFileAttente] = useState<PointageMensuelAvecDetails[]>([]);
  const [chargementFile, setChargementFile] = useState(false);
  const [ficheEnAttente, setFicheEnAttente] = useState<PointageMensuelAvecDetails | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalieAbsence[]>([]);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  const [ficheARejeter, setFicheARejeter] = useState<PointageMensuelAvecDetails | null>(null);
  const [commentaireRejet, setCommentaireRejet] = useState('');
  const [ficheEnCours, setFicheEnCoursId] = useState<string | null>(null);

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
        return;
      }
      setFicheCourante(fiche as unknown as PointageMensuelAvecDetails);
      setChantierId(fiche.chantierId);
      setPeriodeDebut(fiche.periodeDebut);
      setHeuresHs15(String(fiche.heuresHs15));
      setHeuresHs35(String(fiche.heuresHs35));
      setHeuresHs60(String(fiche.heuresHs60));
      setJoursPanier(String(fiche.joursPanier));
      setNbAbsenceInjustifiee(String(fiche.nbJoursAbsenceInjustifiee));
      setNbReposMedical(String(fiche.nbJoursReposMedical));
      setNbPermissionNonPayee(String(fiche.nbJoursPermissionNonPayee));
      setNbPermissionPayee(String(fiche.nbJoursPermissionPayee));
      setNbCongeAnnuel(String(fiche.nbJoursCongeAnnuel));
    });
  }

  useEffect(chargerFicheExistante, [jeton, employeId, periodeFin]);

  async function enregistrer(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !employeId || !chantierId || !periodeDebut || !periodeFin) return;

    setEnvoiEnCours(true);
    setErreur(null);
    try {
      await api.enregistrerFichePointage(jeton, {
        employeId,
        chantierId,
        periodeDebut,
        periodeFin,
        heuresHs15: Number(heuresHs15),
        heuresHs35: Number(heuresHs35),
        heuresHs60: Number(heuresHs60),
        joursPanier: Number(joursPanier),
        nbJoursAbsenceInjustifiee: Number(nbAbsenceInjustifiee),
        nbJoursReposMedical: Number(nbReposMedical),
        nbJoursPermissionNonPayee: Number(nbPermissionNonPayee),
        nbJoursPermissionPayee: Number(nbPermissionPayee),
        nbJoursCongeAnnuel: Number(nbCongeAnnuel),
      });
      chargerFicheExistante();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'enregistrement");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function soumettre() {
    if (!jeton || !ficheCourante) return;
    setSoumissionEnCours(true);
    try {
      await api.soumettreFichePointage(jeton, ficheCourante.id);
      chargerFicheExistante();
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
        <form onSubmit={enregistrer} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Fiche de pointage mensuelle</h3>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2">
              <label className={LABEL}>Employé</label>
              <SelecteurEmploye valeur={employeId} onChange={setEmployeId} />
            </div>
            <div>
              <label className={LABEL}>Chantier</label>
              <select value={chantierId} onChange={(e) => setChantierId(e.target.value)} required className={CHAMP}>
                <option value="">— Choisir —</option>
                {chantiers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Statut</label>
              <div className="pt-1.5">
                {ficheCourante ? (
                  <Badge couleur={COULEURS_STATUT[ficheCourante.statut]}>{LIBELLES_STATUT[ficheCourante.statut]}</Badge>
                ) : (
                  <span className="text-xs text-slate-400">Nouvelle fiche</span>
                )}
              </div>
            </div>
          </div>

          {ficheCourante?.statut === 'rejete' && ficheCourante.commentaireRejet && (
            <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              Rejetée : {ficheCourante.commentaireRejet}
            </div>
          )}

          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          </div>

          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className={LABEL}>Heures sup 15%</label>
              <input type="number" min="0" max="744" value={heuresHs15} onChange={(e) => setHeuresHs15(e.target.value)} className={CHAMP} />
            </div>
            <div>
              <label className={LABEL}>Heures sup 35%</label>
              <input type="number" min="0" max="744" value={heuresHs35} onChange={(e) => setHeuresHs35(e.target.value)} className={CHAMP} />
            </div>
            <div>
              <label className={LABEL}>Heures sup 60%</label>
              <input type="number" min="0" max="744" value={heuresHs60} onChange={(e) => setHeuresHs60(e.target.value)} className={CHAMP} />
            </div>
            <div>
              <label className={LABEL}>Jours panier</label>
              <input type="number" min="0" max="31" value={joursPanier} onChange={(e) => setJoursPanier(e.target.value)} className={CHAMP} />
            </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div>
              <label className={LABEL}>Absence injustifiée</label>
              <input type="number" min="0" max="31" value={nbAbsenceInjustifiee} onChange={(e) => setNbAbsenceInjustifiee(e.target.value)} className={CHAMP} />
            </div>
            <div>
              <label className={LABEL}>Repos médical</label>
              <input type="number" min="0" max="31" value={nbReposMedical} onChange={(e) => setNbReposMedical(e.target.value)} className={CHAMP} />
            </div>
            <div>
              <label className={LABEL}>Permission non payée</label>
              <input type="number" min="0" max="31" value={nbPermissionNonPayee} onChange={(e) => setNbPermissionNonPayee(e.target.value)} className={CHAMP} />
            </div>
            <div>
              <label className={LABEL}>Permission payée</label>
              <input type="number" min="0" max="31" value={nbPermissionPayee} onChange={(e) => setNbPermissionPayee(e.target.value)} className={CHAMP} />
            </div>
            <div>
              <label className={LABEL}>Congé annuel</label>
              <input type="number" min="0" max="31" value={nbCongeAnnuel} onChange={(e) => setNbCongeAnnuel(e.target.value)} className={CHAMP} />
            </div>
          </div>

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
              className="rounded-md bg-erreur-600 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-erreur-700 hover:shadow-md disabled:opacity-60"
            >
              {actionEnCours === ficheARejeter.id ? 'Envoi...' : 'Confirmer le rejet'}
            </button>
          </form>
        </Modale>
      )}
    </MiseEnPage>
  );
}
