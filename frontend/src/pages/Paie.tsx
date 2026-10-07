import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ErreurApi, api } from '../api/client';
import { Badge, CouleurBadge } from '../components/Badge';
import { EtatVide } from '../components/EtatVide';
import { IconePaie } from '../components/icones';
import { MiseEnPage } from '../components/MiseEnPage';
import { SelecteurEmploye } from '../components/SelecteurEmploye';
import { useAuth } from '../context/AuthContext';
import { Filiale } from '../types/postes';
import { BulletinPaie, ResultatCalculMasse, StatutBulletin } from '../types/paie';

function formaterFCFA(montant: number) {
  return `${montant.toLocaleString('fr-FR')} F CFA`;
}

const CHAMP =
  'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';
const LABEL = 'mb-1 block text-xs font-medium text-slate-600';
const BOUTON =
  'rounded-md bg-primary-700 px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-800 hover:shadow-md disabled:pointer-events-none disabled:opacity-60';
const ROLES_GESTION = ['super_admin', 'drh_holding', 'rh_filiale'];

const LIBELLES_STATUT: Record<StatutBulletin, string> = {
  brouillon: 'Brouillon',
  calcule: 'Calculé',
  valide: 'Validé',
  valide_drh: 'Validé DRH',
  cloture: 'Clôturé',
};

const COULEURS_STATUT: Record<StatutBulletin, CouleurBadge> = {
  brouillon: 'slate',
  calcule: 'primary',
  valide: 'accent',
  valide_drh: 'accent',
  cloture: 'succes',
};

export function Paie() {
  const { jeton, role, employeId: monEmployeId } = useAuth();
  const peutGerer = role !== null && ROLES_GESTION.includes(role);
  const estEmploye = role === 'employe';

  const [employeId, setEmployeId] = useState(estEmploye ? (monEmployeId ?? '') : '');
  const [bulletins, setBulletins] = useState<BulletinPaie[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  const [periode, setPeriode] = useState(() => new Date().toISOString().slice(0, 7));
  const [calculEnCours, setCalculEnCours] = useState(false);
  const [ficheEnCours, setFicheEnCours] = useState<string | null>(null);

  // --- Éléments du mois (saisie préalable, reprise automatiquement par le calcul) ---
  const [elementsEmployeId, setElementsEmployeId] = useState('');
  const [elementsPeriode, setElementsPeriode] = useState(() => new Date().toISOString().slice(0, 7));
  const [autresIndemnites, setAutresIndemnites] = useState('0');
  const [heuresSupForfait, setHeuresSupForfait] = useState('0');
  const [avanceAcompte, setAvanceAcompte] = useState('0');
  const [primePanier, setPrimePanier] = useState('0');
  const [primeSalissure, setPrimeSalissure] = useState('0');
  const [primeLait, setPrimeLait] = useState('0');
  const [reliquat, setReliquat] = useState('0');
  const [tropPercu, setTropPercu] = useState('0');
  const [joursAbsence, setJoursAbsence] = useState('0');
  const [elementsEnCours, setElementsEnCours] = useState(false);
  const [elementsMessage, setElementsMessage] = useState<string | null>(null);
  const [elementsErreur, setElementsErreur] = useState<string | null>(null);

  // --- Calcul en masse (RH Filiale / DRH / Super Admin) ---
  const [filiales, setFiliales] = useState<Filiale[]>([]);
  const [filialeMasseId, setFilialeMasseId] = useState('');
  const [periodeMasse, setPeriodeMasse] = useState(() => new Date().toISOString().slice(0, 7));
  const [calculMasseEnCours, setCalculMasseEnCours] = useState(false);
  const [resultatMasse, setResultatMasse] = useState<ResultatCalculMasse | null>(null);
  const [erreurMasse, setErreurMasse] = useState<string | null>(null);

  useEffect(() => {
    if (!jeton || !peutGerer) return;
    api.listerFiliales(jeton).then(setFiliales);
  }, [jeton, peutGerer]);

  function rafraichir() {
    if (!jeton || !employeId) return;
    api
      .listerBulletins(jeton, employeId)
      .then(setBulletins)
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : 'Erreur de chargement'));
  }

  useEffect(rafraichir, [jeton, employeId]);

  const totalNetVerse = useMemo(
    () => bulletins.filter((b) => b.statut === 'cloture').reduce((s, b) => s + b.netAPayer, 0),
    [bulletins]
  );

  async function calculer(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !employeId) return;

    setCalculEnCours(true);
    try {
      await api.calculerBulletin(jeton, { employeId, periode: `${periode}-01` });
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors du calcul');
    } finally {
      setCalculEnCours(false);
    }
  }

  function chargerElements() {
    if (!jeton || !elementsEmployeId) return;
    api.listerElementsVariablesEmploye(jeton, elementsEmployeId, `${elementsPeriode}-01`).then((liste) => {
      const parType = new Map(liste.map((l) => [l.type, l]));
      setAutresIndemnites(String(parType.get('prime')?.montant ?? 0));
      setHeuresSupForfait(String(parType.get('heure_sup_forfait')?.montant ?? 0));
      setAvanceAcompte(String(parType.get('avance')?.montant ?? 0));
      setPrimePanier(String(parType.get('panier')?.montant ?? 0));
      setPrimeSalissure(String(parType.get('prime_salissure')?.montant ?? 0));
      setPrimeLait(String(parType.get('prime_lait')?.montant ?? 0));
      setReliquat(String(parType.get('reliquat')?.montant ?? 0));
      setTropPercu(String(parType.get('trop_percu')?.montant ?? 0));
      setJoursAbsence(String(parType.get('absence_injustifiee')?.jours ?? 0));
    });
  }

  useEffect(chargerElements, [jeton, elementsEmployeId, elementsPeriode]);

  async function enregistrerElements(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !elementsEmployeId) return;

    setElementsEnCours(true);
    setElementsMessage(null);
    setElementsErreur(null);
    try {
      const periodeIso = `${elementsPeriode}-01`;
      await Promise.all([
        api.enregistrerElementVariable(jeton, { employeId: elementsEmployeId, periode: periodeIso, type: 'prime', montant: Number(autresIndemnites) }),
        api.enregistrerElementVariable(jeton, { employeId: elementsEmployeId, periode: periodeIso, type: 'heure_sup_forfait', montant: Number(heuresSupForfait) }),
        api.enregistrerElementVariable(jeton, { employeId: elementsEmployeId, periode: periodeIso, type: 'avance', montant: Number(avanceAcompte) }),
        api.enregistrerElementVariable(jeton, { employeId: elementsEmployeId, periode: periodeIso, type: 'panier', montant: Number(primePanier) }),
        api.enregistrerElementVariable(jeton, { employeId: elementsEmployeId, periode: periodeIso, type: 'prime_salissure', montant: Number(primeSalissure) }),
        api.enregistrerElementVariable(jeton, { employeId: elementsEmployeId, periode: periodeIso, type: 'prime_lait', montant: Number(primeLait) }),
        api.enregistrerElementVariable(jeton, { employeId: elementsEmployeId, periode: periodeIso, type: 'reliquat', montant: Number(reliquat) }),
        api.enregistrerElementVariable(jeton, { employeId: elementsEmployeId, periode: periodeIso, type: 'trop_percu', montant: Number(tropPercu) }),
        api.enregistrerElementVariable(jeton, { employeId: elementsEmployeId, periode: periodeIso, type: 'absence_injustifiee', jours: Number(joursAbsence) }),
      ]);
      setElementsMessage('Enregistré — repris automatiquement au prochain calcul (individuel ou en masse).');
    } catch (e) {
      setElementsErreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'enregistrement des éléments du mois");
    } finally {
      setElementsEnCours(false);
    }
  }

  async function telechargerFiche(id: string) {
    if (!jeton) return;
    setFicheEnCours(id);
    try {
      const blob = await api.obtenirBulletinPdf(jeton, id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la génération de la fiche');
    } finally {
      setFicheEnCours(null);
    }
  }

  async function calculerMasse(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !filialeMasseId) return;

    setCalculMasseEnCours(true);
    setErreurMasse(null);
    setResultatMasse(null);
    try {
      const resultat = await api.calculerMasseSalariale(jeton, filialeMasseId, `${periodeMasse}-01`);
      setResultatMasse(resultat);
      if (employeId) rafraichir(); // si l'employé affiché fait partie du lot, on rafraîchit son historique
    } catch (e) {
      setErreurMasse(e instanceof ErreurApi ? e.message : 'Erreur lors du calcul en masse');
    } finally {
      setCalculMasseEnCours(false);
    }
  }

  if (estEmploye && !monEmployeId) {
    return (
      <MiseEnPage>
        <EtatVide
          icone={<IconePaie />}
          titre="Compte non rattaché à un dossier employé"
          message="Contactez votre RH pour rattacher votre compte à un dossier employé."
        />
      </MiseEnPage>
    );
  }

  return (
    <MiseEnPage>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{estEmploye ? 'Mes bulletins de paie' : 'Paie'}</h2>

      {peutGerer && (
        <form onSubmit={calculerMasse} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-1 text-sm font-semibold text-slate-800">Calcul en masse</h3>
          <p className="mb-3 text-xs text-slate-500">
            Calcule le bulletin de chaque employé actif ayant un contrat actif dans la filiale choisie, pour le mois
            sélectionné. Les employés sans contrat actif sont listés à part, sans bloquer les autres.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <select value={filialeMasseId} onChange={(e) => setFilialeMasseId(e.target.value)} required className={CHAMP}>
              <option value="">— Choisir une filiale —</option>
              {filiales.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom}
                </option>
              ))}
            </select>
            <input type="month" value={periodeMasse} onChange={(e) => setPeriodeMasse(e.target.value)} required className={CHAMP} />
            <button disabled={calculMasseEnCours} className={BOUTON}>
              {calculMasseEnCours ? 'Calcul en cours...' : 'Calculer la paie de la filiale'}
            </button>
          </div>

          {erreurMasse && <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreurMasse}</div>}

          {resultatMasse && (
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
              <p className="font-medium text-succes-700">
                {resultatMasse.bulletinsCalcules.length} bulletin(s) calculé(s) pour {resultatMasse.periode.slice(0, 7)}.
              </p>
              {resultatMasse.echecs.length > 0 && (
                <div>
                  <p className="mb-1 font-medium text-alerte-700">{resultatMasse.echecs.length} employé(s) ignoré(s) :</p>
                  <ul className="list-inside list-disc space-y-1 text-slate-600">
                    {resultatMasse.echecs.map((e) => (
                      <li key={e.employeId}>
                        {e.nom} {e.prenoms} —{' '}
                        {e.motif === 'Pointage non validé — paie bloquée' ? (
                          <Badge couleur="alerte">⚠️ Pointage non validé — paie bloquée</Badge>
                        ) : (
                          e.motif
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </form>
      )}

      {peutGerer && (
        <form onSubmit={enregistrerElements} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-1 text-sm font-semibold text-slate-800">Éléments du mois</h3>
          <p className="mb-3 text-xs text-slate-500">
            À saisir avant de lancer un calcul (individuel ou en masse) — repris automatiquement, y compris par le
            calcul en masse par filiale.
          </p>
          <p className="mb-3 text-xs text-alerte-700">
            « Heures sup (forfait) » : pour un employé payé à un montant fixe (ex. cadre, manœuvre), pas au calcul
            horaire. Si renseigné (différent de 0), ce montant remplace entièrement les heures sup calculées depuis
            le pointage ce mois-ci — il ne s'y ajoute jamais.
          </p>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <div className="min-w-[220px]">
              <label className={LABEL}>Employé</label>
              <SelecteurEmploye valeur={elementsEmployeId} onChange={setElementsEmployeId} />
            </div>
            <div>
              <label className={LABEL}>Mois</label>
              <input
                type="month"
                value={elementsPeriode}
                onChange={(e) => setElementsPeriode(e.target.value)}
                required
                className={CHAMP}
              />
            </div>
          </div>
          {elementsEmployeId && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <div>
                  <label className={LABEL}>Autres indemnités</label>
                  <input
                    type="number"
                    value={autresIndemnites}
                    onChange={(e) => setAutresIndemnites(e.target.value)}
                    className={CHAMP}
                  />
                </div>
                <div>
                  <label className={LABEL}>Heures sup (forfait)</label>
                  <input
                    type="number"
                    value={heuresSupForfait}
                    onChange={(e) => setHeuresSupForfait(e.target.value)}
                    className={CHAMP}
                  />
                </div>
                <div>
                  <label className={LABEL}>Avance / acompte</label>
                  <input
                    type="number"
                    value={avanceAcompte}
                    onChange={(e) => setAvanceAcompte(e.target.value)}
                    className={CHAMP}
                  />
                </div>
                <div>
                  <label className={LABEL}>Prime de panier</label>
                  <input
                    type="number"
                    value={primePanier}
                    onChange={(e) => setPrimePanier(e.target.value)}
                    className={CHAMP}
                  />
                </div>
                <div>
                  <label className={LABEL}>Prime de salissure</label>
                  <input
                    type="number"
                    value={primeSalissure}
                    onChange={(e) => setPrimeSalissure(e.target.value)}
                    className={CHAMP}
                  />
                </div>
                <div>
                  <label className={LABEL}>Prime de lait</label>
                  <input
                    type="number"
                    value={primeLait}
                    onChange={(e) => setPrimeLait(e.target.value)}
                    className={CHAMP}
                  />
                </div>
                <div>
                  <label className={LABEL}>Reliquat</label>
                  <input type="number" value={reliquat} onChange={(e) => setReliquat(e.target.value)} className={CHAMP} />
                </div>
                <div>
                  <label className={LABEL}>Salaire trop perçu</label>
                  <input type="number" value={tropPercu} onChange={(e) => setTropPercu(e.target.value)} className={CHAMP} />
                </div>
                <div>
                  <label className={LABEL}>Jours d'absence injustifiée</label>
                  <input
                    type="number"
                    value={joursAbsence}
                    onChange={(e) => setJoursAbsence(e.target.value)}
                    className={CHAMP}
                  />
                </div>
              </div>
              <button disabled={elementsEnCours} className={`${BOUTON} mt-3`}>
                {elementsEnCours ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              {elementsMessage && <p className="mt-2 text-xs text-succes-700">{elementsMessage}</p>}
              {elementsErreur && <p className="mt-2 text-xs text-red-700">{elementsErreur}</p>}
            </>
          )}
        </form>
      )}

      {!estEmploye && (
        <div className="mb-6">
          <SelecteurEmploye valeur={employeId} onChange={setEmployeId} />
        </div>
      )}

      {erreur && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      {employeId && (
        <>
          {totalNetVerse > 0 && (
            <div className="mb-6 grid grid-cols-1 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total net versé (clôturé)</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-succes-700 [font-variant-numeric:tabular-nums]">
                  {formaterFCFA(totalNetVerse)}
                </p>
              </div>
            </div>
          )}

          <div className="mb-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            {bulletins.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Période</th>
                    <th className="px-4 py-3">Brut</th>
                    <th className="px-4 py-3">IUTS</th>
                    <th className="px-4 py-3">CNSS</th>
                    <th className="px-4 py-3">FSP</th>
                    <th className="px-4 py-3">Net à payer</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bulletins.map((b) => (
                    <tr key={b.id} className="transition-colors duration-200 hover:bg-slate-50">
                      <td className="px-4 py-3">{b.periode.slice(0, 7)}</td>
                      <td className="px-4 py-3">{formaterFCFA(b.brut)}</td>
                      <td className="px-4 py-3">{formaterFCFA(b.iuts)}</td>
                      <td className="px-4 py-3">{formaterFCFA(b.cnssSalariale)}</td>
                      <td className="px-4 py-3">{formaterFCFA(b.fsp)}</td>
                      <td className="px-4 py-3 font-semibold text-succes-700">{formaterFCFA(b.netAPayer)}</td>
                      <td className="px-4 py-3">
                        <Badge couleur={COULEURS_STATUT[b.statut]}>{LIBELLES_STATUT[b.statut]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          disabled={ficheEnCours === b.id}
                          onClick={() => telechargerFiche(b.id)}
                          className="font-medium text-primary-700 transition-colors duration-200 hover:underline disabled:opacity-50"
                        >
                          Fiche PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EtatVide
                icone={<IconePaie />}
                titre="Aucun bulletin"
                message={
                  estEmploye
                    ? "Vos bulletins apparaîtront ici une fois calculés par la RH."
                    : 'Les bulletins calculés pour cet employé apparaîtront ici.'
                }
              />
            )}
          </div>

          {peutGerer && (
            <form onSubmit={calculer} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Calculer un bulletin individuel</h3>
              <p className="mb-3 text-xs text-slate-500">
                Utilise le salaire de base et les indemnités du contrat actif, plus les éléments du mois saisis
                ci-dessous (primes, avance, panier, reliquat, absences).
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <input type="month" value={periode} onChange={(e) => setPeriode(e.target.value)} required className={CHAMP} />
                <button disabled={calculEnCours} className={BOUTON}>
                  {calculEnCours ? 'Calcul...' : 'Calculer'}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </MiseEnPage>
  );
}
