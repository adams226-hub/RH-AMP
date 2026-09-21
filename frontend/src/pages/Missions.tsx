import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ErreurApi, api } from '../api/client';
import { Badge, CouleurBadge } from '../components/Badge';
import { ChampRecherche } from '../components/ChampRecherche';
import { EnTeteTriable } from '../components/EnTeteTriable';
import { EtatVide } from '../components/EtatVide';
import { FiltreSelect } from '../components/FiltreSelect';
import { IconeMissions } from '../components/icones';
import { MiseEnPage } from '../components/MiseEnPage';
import { Modale } from '../components/Modale';
import { Pagination } from '../components/Pagination';
import { SelecteurEmploye } from '../components/SelecteurEmploye';
import { useAuth } from '../context/AuthContext';
import { useTri } from '../hooks/useTri';
import { MissionAvecEmploye, StatutMission } from '../types/missions';
import { formaterDateFr } from '../utils/date';

const CHAMP =
  'rounded-md border border-slate-300 px-2.5 py-1.5 text-sm transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';
const BOUTON =
  'rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-800 hover:shadow-md disabled:pointer-events-none disabled:opacity-60';
const PAR_PAGE = 10;
const ROLES_GESTION = ['super_admin', 'drh_holding', 'rh_filiale'];

const LIBELLES_STATUT: Record<StatutMission, string> = {
  a_venir: 'À venir',
  en_cours: 'En cours',
  en_retard: 'En retard',
  terminee: 'Terminée',
};

const COULEURS_STATUT: Record<StatutMission, CouleurBadge> = {
  a_venir: 'slate',
  en_cours: 'primary',
  en_retard: 'erreur',
  terminee: 'succes',
};

function TuileCompteur({ libelle, valeur, couleur }: { libelle: string; valeur: number; couleur: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{libelle}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight [font-variant-numeric:tabular-nums] ${couleur}`}>{valeur}</p>
    </div>
  );
}

export function Missions() {
  const { jeton, role } = useAuth();
  const peutGerer = role !== null && ROLES_GESTION.includes(role);

  const [missions, setMissions] = useState<MissionAvecEmploye[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enAttenteId, setEnAttenteId] = useState<string | null>(null);

  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [page, setPage] = useState(1);

  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [employeId, setEmployeId] = useState('');
  const [numeroOrdreMission, setNumeroOrdreMission] = useState('');
  const [destination, setDestination] = useState('');
  const [motif, setMotif] = useState('');
  const [dateDepart, setDateDepart] = useState('');
  const [dateRetourPrevue, setDateRetourPrevue] = useState('');
  const [montantHebergement, setMontantHebergement] = useState('0');
  const [montantRestauration, setMontantRestauration] = useState('0');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [exportEnCours, setExportEnCours] = useState(false);

  const [missionRetour, setMissionRetour] = useState<MissionAvecEmploye | null>(null);
  const [dateRetourReelle, setDateRetourReelle] = useState('');

  function rafraichir() {
    if (!jeton) return;
    setChargement(true);
    api
      .listerMissions(jeton)
      .then(setMissions)
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : 'Erreur de chargement'))
      .finally(() => setChargement(false));
  }

  useEffect(rafraichir, [jeton]);

  const compteurs = useMemo(
    () => ({
      en_cours: missions.filter((m) => m.statut === 'en_cours').length,
      en_retard: missions.filter((m) => m.statut === 'en_retard').length,
      a_venir: missions.filter((m) => m.statut === 'a_venir').length,
    }),
    [missions]
  );

  const filtres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return missions.filter((m) => {
      if (filtreStatut && m.statut !== filtreStatut) return false;
      if (terme) {
        const cible = `${m.employeMatricule} ${m.employeNom} ${m.employePrenoms} ${m.destination}`.toLowerCase();
        if (!cible.includes(terme)) return false;
      }
      return true;
    });
  }, [missions, recherche, filtreStatut]);

  const { trie, cle, sens, trierPar } = useTri<MissionAvecEmploye>(filtres, 'dateDepart');
  const totalPages = Math.max(1, Math.ceil(trie.length / PAR_PAGE));
  const pageBornee = Math.min(page, totalPages);
  const pageAffichee = trie.slice((pageBornee - 1) * PAR_PAGE, pageBornee * PAR_PAGE);

  useEffect(() => setPage(1), [recherche, filtreStatut]);

  async function creer(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !employeId || !numeroOrdreMission || !destination || !motif || !dateDepart || !dateRetourPrevue) return;
    setEnvoiEnCours(true);
    setErreur(null);
    try {
      await api.creerMission(jeton, {
        employeId,
        numeroOrdreMission,
        destination,
        motif,
        dateDepart,
        dateRetourPrevue,
        montantHebergement: Number(montantHebergement),
        montantRestauration: Number(montantRestauration),
      });
      setEmployeId('');
      setNumeroOrdreMission('');
      setDestination('');
      setMotif('');
      setDateDepart('');
      setDateRetourPrevue('');
      setMontantHebergement('0');
      setMontantRestauration('0');
      setFormulaireOuvert(false);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la création');
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function telechargerExcel() {
    if (!jeton) return;
    setExportEnCours(true);
    setErreur(null);
    try {
      const blob = await api.exporterMissionsExcel(jeton);
      const url = URL.createObjectURL(blob);
      const lien = document.createElement('a');
      lien.href = url;
      lien.download = 'missions.xlsx';
      lien.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'export Excel");
    } finally {
      setExportEnCours(false);
    }
  }

  async function confirmerRetour(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !missionRetour || !dateRetourReelle) return;
    setEnAttenteId(missionRetour.id);
    try {
      await api.enregistrerRetourMission(jeton, missionRetour.id, dateRetourReelle);
      setMissionRetour(null);
      setDateRetourReelle('');
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'enregistrement du retour");
    } finally {
      setEnAttenteId(null);
    }
  }

  return (
    <MiseEnPage>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Missions</h2>
          <p className="text-sm text-slate-500">Suivi des départs et retours — statut déduit automatiquement des dates</p>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={exportEnCours} onClick={telechargerExcel} className={BOUTON}>
            {exportEnCours ? 'Génération...' : 'Télécharger en Excel'}
          </button>
          {peutGerer && (
            <button onClick={() => setFormulaireOuvert((v) => !v)} className={BOUTON}>
              {formulaireOuvert ? 'Fermer' : '+ Nouvelle mission'}
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <TuileCompteur libelle="En mission actuellement" valeur={compteurs.en_cours} couleur="text-primary-700" />
        <TuileCompteur libelle="En retard de retour" valeur={compteurs.en_retard} couleur="text-erreur-600" />
        <TuileCompteur libelle="À venir" valeur={compteurs.a_venir} couleur="text-slate-700" />
      </div>

      {erreur && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      {formulaireOuvert && peutGerer && (
        <form onSubmit={creer} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Nouvelle mission</h3>
          <div className="mb-3">
            <SelecteurEmploye valeur={employeId} onChange={setEmployeId} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <input
              value={numeroOrdreMission}
              onChange={(e) => setNumeroOrdreMission(e.target.value)}
              placeholder="N° d'ordre de mission"
              required
              className={CHAMP}
            />
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Destination"
              required
              className={CHAMP}
            />
            <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Motif" required className={CHAMP} />
            <input type="date" value={dateDepart} onChange={(e) => setDateDepart(e.target.value)} required className={CHAMP} />
            <input
              type="date"
              value={dateRetourPrevue}
              onChange={(e) => setDateRetourPrevue(e.target.value)}
              required
              className={CHAMP}
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Hébergement (F CFA)</label>
              <input
                type="number"
                min="0"
                value={montantHebergement}
                onChange={(e) => setMontantHebergement(e.target.value)}
                className={`w-full ${CHAMP}`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Restauration (F CFA)</label>
              <input
                type="number"
                min="0"
                value={montantRestauration}
                onChange={(e) => setMontantRestauration(e.target.value)}
                className={`w-full ${CHAMP}`}
              />
            </div>
          </div>
          <button disabled={envoiEnCours} className={`${BOUTON} mt-3`}>
            {envoiEnCours ? 'Envoi...' : 'Enregistrer le départ'}
          </button>
        </form>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Rechercher un employé, destination…" />
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
                  <th className="px-4 py-3">Destination / Motif</th>
                  <EnTeteTriable label="Départ" cleColonne="dateDepart" cleActive={cle} sens={sens} onTrier={trierPar} />
                  <th className="px-4 py-3">Retour prévu</th>
                  <th className="px-4 py-3">Frais</th>
                  <EnTeteTriable label="Statut" cleColonne="statut" cleActive={cle} sens={sens} onTrier={trierPar} />
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageAffichee.map((m) => (
                  <tr key={m.id} className="transition-colors duration-200 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {m.employeNom} {m.employePrenoms}
                      <div className="font-mono text-xs font-normal text-slate-400">{m.employeMatricule}</div>
                    </td>
                    <td className="px-4 py-3">
                      {m.destination}
                      <div className="text-xs text-slate-400">{m.motif}</div>
                      {m.numeroOrdreMission && (
                        <div className="font-mono text-xs text-slate-400">N° {m.numeroOrdreMission}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">{formaterDateFr(m.dateDepart)}</td>
                    <td className="px-4 py-3">
                      {formaterDateFr(m.dateRetourPrevue)}
                      {m.dateRetourReelle && (
                        <div className="text-xs text-succes-700">Retour réel : {formaterDateFr(m.dateRetourReelle)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>Hébergt : {m.montantHebergement.toLocaleString('fr-FR')} F</div>
                      <div className="text-xs text-slate-400">Restauration : {m.montantRestauration.toLocaleString('fr-FR')} F</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge couleur={COULEURS_STATUT[m.statut]}>{LIBELLES_STATUT[m.statut]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {peutGerer && (m.statut === 'en_cours' || m.statut === 'en_retard') && (
                        <button
                          disabled={enAttenteId === m.id}
                          onClick={() => {
                            setMissionRetour(m);
                            setDateRetourReelle(new Date().toISOString().slice(0, 10));
                          }}
                          className="font-medium text-primary-700 transition-colors duration-200 hover:underline disabled:opacity-50"
                        >
                          Enregistrer le retour
                        </button>
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
            icone={<IconeMissions />}
            titre={missions.length === 0 ? 'Aucune mission' : 'Aucun résultat'}
            message={
              missions.length === 0
                ? 'Les départs en mission apparaîtront ici.'
                : 'Aucune mission ne correspond à votre recherche ou vos filtres.'
            }
          />
        )}
      </div>

      {missionRetour && (
        <Modale
          titre={`Enregistrer le retour — ${missionRetour.employeNom} ${missionRetour.employePrenoms}`}
          onFermer={() => setMissionRetour(null)}
        >
          <form onSubmit={confirmerRetour} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Date de retour réelle</label>
              <input
                type="date"
                value={dateRetourReelle}
                onChange={(e) => setDateRetourReelle(e.target.value)}
                required
                className={`w-full ${CHAMP}`}
              />
            </div>
            <button disabled={enAttenteId === missionRetour.id} className={BOUTON}>
              {enAttenteId === missionRetour.id ? 'Envoi...' : 'Confirmer le retour'}
            </button>
          </form>
        </Modale>
      )}
    </MiseEnPage>
  );
}
