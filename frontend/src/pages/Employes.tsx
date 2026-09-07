import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ErreurApi, api } from '../api/client';
import { Badge } from '../components/Badge';
import { BadgeStatut } from '../components/BadgeStatut';
import { ChampRecherche } from '../components/ChampRecherche';
import { EnTeteTriable } from '../components/EnTeteTriable';
import { EtatVide } from '../components/EtatVide';
import { FiltreSelect } from '../components/FiltreSelect';
import { IconeEmployes } from '../components/icones';
import { MiseEnPage } from '../components/MiseEnPage';
import { Modale } from '../components/Modale';
import { Pagination } from '../components/Pagination';
import { TuileStat } from '../components/TuileStat';
import { useAuth } from '../context/AuthContext';
import { useTri } from '../hooks/useTri';
import { Employe, ResumeRhEmploye, StatutEmploye } from '../types/employe';
import { Chantier } from '../types/pointage';
import { Filiale } from '../types/postes';
import { CategorieProfessionnelle } from '../types/categoriesProfessionnelles';
import { formaterDateFr } from '../utils/date';

const CHAMP =
  'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';
const LABEL = 'mb-1 block text-xs font-medium text-slate-600';
const PAR_PAGE = 10;

const ETAT_INITIAL = {
  matricule: '',
  nom: '',
  prenoms: '',
  dateNaissance: '',
  sexe: 'M' as 'M' | 'F',
  nationalite: 'Burkinabè',
  telephone: '',
  numCnib: '',
  numCnss: '',
  rib: '',
  banque: '',
  modePaiement: '',
  personnesACharge: '0',
  filialeId: '',
  chantierId: '',
  dateEmbauche: '',
  categorieProfessionnelle: '',
  soumisPointage: false,
};

const LIBELLES_STATUT: Record<StatutEmploye, string> = {
  actif: 'Actif',
  en_cours_creation: 'En cours de création',
  suspendu: 'Suspendu',
  sorti: 'Sorti',
};

// Seuls ces rôles peuvent créer/activer un employé — même règle que le backend (autoriserRoles).
const ROLES_GESTION = ['super_admin', 'drh_holding', 'rh_filiale'];

export function Employes() {
  const { jeton, role } = useAuth();
  const peutGerer = role !== null && ROLES_GESTION.includes(role);

  const [employes, setEmployes] = useState<Employe[]>([]);
  const [filiales, setFiliales] = useState<Filiale[]>([]);
  const [filialesVisibles, setFilialesVisibles] = useState<Filiale[]>([]);
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [chantierEnCours, setChantierEnCours] = useState(false);
  const [pointageEnCours, setPointageEnCours] = useState(false);
  const [categories, setCategories] = useState<CategorieProfessionnelle[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [nouvelleFiliale, setNouvelleFiliale] = useState('');
  const [champs, setChamps] = useState(ETAT_INITIAL);
  const [employeSelectionne, setEmployeSelectionne] = useState<Employe | null>(null);
  const [resumeRh, setResumeRh] = useState<ResumeRhEmploye | null>(null);

  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [filtreFiliale, setFiltreFiliale] = useState('');
  const [page, setPage] = useState(1);

  function rafraichir() {
    if (!jeton) return;
    api
      .listerEmployes(jeton)
      .then(setEmployes)
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : 'Erreur de chargement'))
      .finally(() => setChargement(false));
  }

  useEffect(rafraichir, [jeton]);

  // Liste complète (pas visiblesUniquement) : nécessaire pour afficher le nom de la filiale des
  // employés déjà rattachés à une filiale archivée — seul le formulaire de création filtre.
  function rafraichirFiliales() {
    if (!jeton) return;
    api.listerFiliales(jeton).then(setFiliales);
    api.listerFiliales(jeton, true).then(setFilialesVisibles);
  }

  useEffect(rafraichirFiliales, [jeton]);

  useEffect(() => {
    if (!jeton) return;
    api.listerChantiers(jeton).then(setChantiers);
  }, [jeton]);

  // Liste complète (pas visiblesUniquement) : une catégorie archivée doit encore afficher son
  // libellé sur les fiches employé qui la référencent déjà — seul le formulaire de création filtre.
  useEffect(() => {
    if (!jeton) return;
    api.listerCategoriesProfessionnelles(jeton).then(setCategories);
  }, [jeton]);

  useEffect(() => {
    if (!jeton || !employeSelectionne) {
      setResumeRh(null);
      return;
    }
    api.obtenirResumeRhEmploye(jeton, employeSelectionne.id).then(setResumeRh);
  }, [jeton, employeSelectionne?.id]);

  const categoriesVisibles = useMemo(() => categories.filter((c) => c.actif), [categories]);
  const nomChantier = (id: string | null) => chantiers.find((c) => c.id === id)?.nom ?? null;
  const libelleCategorie = (code: string | null) => categories.find((c) => c.code === code)?.libelle ?? null;

  async function definirChantierEmployeSelectionne(chantierId: string) {
    if (!jeton || !employeSelectionne) return;
    setChantierEnCours(true);
    try {
      const employe = await api.affecterChantierEmploye(jeton, employeSelectionne.id, chantierId || null);
      setEmployeSelectionne(employe);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'affectation du chantier");
    } finally {
      setChantierEnCours(false);
    }
  }

  async function definirSoumisPointageEmployeSelectionne(soumisPointage: boolean) {
    if (!jeton || !employeSelectionne) return;
    setPointageEnCours(true);
    try {
      const employe = await api.changerSoumisPointageEmploye(jeton, employeSelectionne.id, soumisPointage);
      setEmployeSelectionne(employe);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors de la mise à jour du pointage");
    } finally {
      setPointageEnCours(false);
    }
  }

  const nomFiliale = (id: string) => filiales.find((f) => f.id === id)?.nom ?? '—';

  const filtres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return employes.filter((e) => {
      if (filtreStatut && e.statut !== filtreStatut) return false;
      if (filtreFiliale && e.filialeId !== filtreFiliale) return false;
      if (terme) {
        const cible = `${e.matricule} ${e.nom} ${e.prenoms}`.toLowerCase();
        if (!cible.includes(terme)) return false;
      }
      return true;
    });
  }, [employes, recherche, filtreStatut, filtreFiliale]);

  const { trie, cle, sens, trierPar } = useTri<Employe>(filtres, 'nom');

  const totalPages = Math.max(1, Math.ceil(trie.length / PAR_PAGE));
  const pageBornee = Math.min(page, totalPages);
  const pageAffichee = trie.slice((pageBornee - 1) * PAR_PAGE, pageBornee * PAR_PAGE);

  useEffect(() => setPage(1), [recherche, filtreStatut, filtreFiliale]);

  const compteurs = useMemo(() => {
    const parStatut: Record<StatutEmploye, number> = { actif: 0, en_cours_creation: 0, suspendu: 0, sorti: 0 };
    for (const e of employes) parStatut[e.statut]++;
    return parStatut;
  }, [employes]);

  function majChamp<K extends keyof typeof ETAT_INITIAL>(cle: K, valeur: (typeof ETAT_INITIAL)[K]) {
    setChamps((precedent) => ({ ...precedent, [cle]: valeur }));
  }

  async function creerEmploye(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton) return;

    setEnvoiEnCours(true);
    setErreur(null);

    try {
      let filialeId = champs.filialeId;
      if (filialeId === 'autre') {
        const nouvelle = await api.creerFiliale(jeton, { nom: nouvelleFiliale });
        filialeId = nouvelle.id;
        rafraichirFiliales();
      }

      await api.creerEmploye(jeton, {
        ...champs,
        filialeId,
        rib: champs.rib || undefined,
        banque: champs.banque || undefined,
        modePaiement: champs.modePaiement || undefined,
        personnesACharge: Number(champs.personnesACharge),
        categorieProfessionnelle: champs.categorieProfessionnelle || undefined,
        chantierId: champs.chantierId || undefined,
      });
      setChamps(ETAT_INITIAL);
      setNouvelleFiliale('');
      setFormulaireOuvert(false);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la création');
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function activer(id: string) {
    if (!jeton) return;
    try {
      await api.changerStatutEmploye(jeton, id, 'actif');
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'activation");
    }
  }

  return (
    <MiseEnPage>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Employés</h2>
          <p className="text-sm text-slate-500">{employes.length} employé(s) dans votre périmètre</p>
        </div>
        {peutGerer && (
          <button
            onClick={() => setFormulaireOuvert((v) => !v)}
            className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-800 hover:shadow-md"
          >
            {formulaireOuvert ? 'Fermer' : '+ Nouvel employé'}
          </button>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <TuileStat libelle="Actifs" valeur={compteurs.actif} icone={<IconeEmployes />} couleur="succes" delaiMs={0} />
        <TuileStat
          libelle="En cours de création"
          valeur={compteurs.en_cours_creation}
          icone={<IconeEmployes />}
          couleur="primary"
          delaiMs={60}
        />
        <TuileStat libelle="Suspendus" valeur={compteurs.suspendu} icone={<IconeEmployes />} couleur="alerte" delaiMs={120} />
        <TuileStat libelle="Sortis" valeur={compteurs.sorti} icone={<IconeEmployes />} couleur="accent" delaiMs={180} />
      </div>

      {erreur && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {erreur}
        </div>
      )}

      {formulaireOuvert && peutGerer && (
        <form onSubmit={creerEmploye} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Nouvel employé</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label className={LABEL}>Matricule</label>
              <input
                value={champs.matricule}
                onChange={(e) => majChamp('matricule', e.target.value)}
                placeholder="AMP-2026-0001"
                required
                className={CHAMP}
              />
            </div>
            <div>
              <label className={LABEL}>Nom</label>
              <input value={champs.nom} onChange={(e) => majChamp('nom', e.target.value)} required className={CHAMP} />
            </div>
            <div>
              <label className={LABEL}>Prénom(s)</label>
              <input
                value={champs.prenoms}
                onChange={(e) => majChamp('prenoms', e.target.value)}
                required
                className={CHAMP}
              />
            </div>
            <div>
              <label className={LABEL}>Date de naissance</label>
              <input
                type="date"
                value={champs.dateNaissance}
                onChange={(e) => majChamp('dateNaissance', e.target.value)}
                required
                className={CHAMP}
              />
            </div>
            <div>
              <label className={LABEL}>Sexe</label>
              <select value={champs.sexe} onChange={(e) => majChamp('sexe', e.target.value as 'M' | 'F')} className={CHAMP}>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Nationalité</label>
              <input
                value={champs.nationalite}
                onChange={(e) => majChamp('nationalite', e.target.value)}
                required
                className={CHAMP}
              />
            </div>
            <div>
              <label className={LABEL}>Téléphone</label>
              <input
                value={champs.telephone}
                onChange={(e) => majChamp('telephone', e.target.value)}
                required
                className={CHAMP}
              />
            </div>
            <div>
              <label className={LABEL}>N° CNIB</label>
              <input value={champs.numCnib} onChange={(e) => majChamp('numCnib', e.target.value)} required className={CHAMP} />
            </div>
            <div>
              <label className={LABEL}>N° CNSS</label>
              <input value={champs.numCnss} onChange={(e) => majChamp('numCnss', e.target.value)} required className={CHAMP} />
            </div>
            <div>
              <label className={LABEL}>Filiale</label>
              <select
                value={champs.filialeId}
                onChange={(e) => majChamp('filialeId', e.target.value)}
                required={champs.filialeId !== 'autre'}
                className={CHAMP}
              >
                <option value="">— Choisir —</option>
                {filialesVisibles.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nom}
                  </option>
                ))}
                <option value="autre">Autre…</option>
              </select>
            </div>
            {champs.filialeId === 'autre' && (
              <div>
                <label className={LABEL}>Nom de la nouvelle filiale</label>
                <input
                  value={nouvelleFiliale}
                  onChange={(e) => setNouvelleFiliale(e.target.value)}
                  placeholder="Ex. AMP Centre"
                  required
                  className={CHAMP}
                />
              </div>
            )}
            <div>
              <label className={LABEL}>Date d'embauche</label>
              <input
                type="date"
                value={champs.dateEmbauche}
                onChange={(e) => majChamp('dateEmbauche', e.target.value)}
                required
                className={CHAMP}
              />
            </div>
            <div>
              <label className={LABEL}>Catégorie professionnelle</label>
              <select
                value={champs.categorieProfessionnelle}
                onChange={(e) => majChamp('categorieProfessionnelle', e.target.value)}
                className={CHAMP}
              >
                <option value="">— Non renseignée —</option>
                {categoriesVisibles.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.libelle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Personnes à charge</label>
              <input
                type="number"
                min="0"
                value={champs.personnesACharge}
                onChange={(e) => majChamp('personnesACharge', e.target.value)}
                className={CHAMP}
              />
            </div>
            <div>
              <label className={LABEL}>N° de compte (RIB)</label>
              <input value={champs.rib} onChange={(e) => majChamp('rib', e.target.value)} className={CHAMP} />
            </div>
            <div>
              <label className={LABEL}>Banque</label>
              <input value={champs.banque} onChange={(e) => majChamp('banque', e.target.value)} className={CHAMP} />
            </div>
            <div>
              <label className={LABEL}>Mode de paiement</label>
              <input
                value={champs.modePaiement}
                onChange={(e) => majChamp('modePaiement', e.target.value)}
                placeholder="Espèces, virement…"
                className={CHAMP}
              />
            </div>
            <div>
              <label className={LABEL}>Lieu d'affectation par défaut</label>
              <select value={champs.chantierId} onChange={(e) => majChamp('chantierId', e.target.value)} className={CHAMP}>
                <option value="">— Non renseigné —</option>
                {chantiers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Utilisé sur le Journal de Paie ; écrasé automatiquement si un pointage validé existe pour le mois.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="soumisPointage"
                checked={champs.soumisPointage}
                onChange={(e) => majChamp('soumisPointage', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-700 focus:ring-primary-100"
              />
              <label htmlFor="soumisPointage" className="text-sm text-slate-700">
                Soumis au pointage
                <span className="block text-xs font-normal text-slate-400">
                  La paie sera bloquée tant que sa fiche de pointage du mois n'est pas validée.
                </span>
              </label>
            </div>
          </div>
          <button
            disabled={envoiEnCours}
            className="mt-4 rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-800 hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
          >
            {envoiEnCours ? 'Création...' : "Créer l'employé"}
          </button>
        </form>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Rechercher un nom, matricule…" />
        </div>
        <FiltreSelect
          valeur={filtreStatut}
          onChange={setFiltreStatut}
          toutLibelle="Tous les statuts"
          options={Object.entries(LIBELLES_STATUT).map(([valeur, libelle]) => ({ valeur, libelle }))}
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
                  <EnTeteTriable label="Matricule" cleColonne="matricule" cleActive={cle} sens={sens} onTrier={trierPar} />
                  <EnTeteTriable label="Nom" cleColonne="nom" cleActive={cle} sens={sens} onTrier={trierPar} />
                  <th className="px-4 py-3">Filiale</th>
                  <EnTeteTriable
                    label="Date d'embauche"
                    cleColonne="dateEmbauche"
                    cleActive={cle}
                    sens={sens}
                    onTrier={trierPar}
                  />
                  <EnTeteTriable label="Statut" cleColonne="statut" cleActive={cle} sens={sens} onTrier={trierPar} />
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageAffichee.map((employe) => (
                  <tr key={employe.id} className="transition-colors duration-200 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{employe.matricule}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {employe.nom} {employe.prenoms}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{nomFiliale(employe.filialeId)}</td>
                    <td className="px-4 py-3 text-slate-600">{formaterDateFr(employe.dateEmbauche)}</td>
                    <td className="px-4 py-3">
                      <BadgeStatut statut={employe.statut} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => setEmployeSelectionne(employe)}
                          className="font-medium text-primary-700 transition-colors duration-200 hover:text-primary-800 hover:underline"
                        >
                          Voir
                        </button>
                        {peutGerer && employe.statut === 'en_cours_creation' && (
                          <button
                            onClick={() => activer(employe.id)}
                            className="font-medium text-succes-700 transition-colors duration-200 hover:text-succes-800 hover:underline"
                          >
                            Activer
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
            icone={<IconeEmployes />}
            titre={employes.length === 0 ? 'Aucun employé' : 'Aucun résultat'}
            message={
              employes.length === 0
                ? peutGerer
                  ? "Cliquez sur « + Nouvel employé » pour créer le premier dossier."
                  : "Aucun employé n'a encore été créé dans votre périmètre."
                : 'Aucun employé ne correspond à votre recherche ou vos filtres.'
            }
          />
        )}
      </div>

      {employeSelectionne && (
        <Modale titre={`${employeSelectionne.nom} ${employeSelectionne.prenoms}`} onFermer={() => setEmployeSelectionne(null)}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {[
              ['Matricule', employeSelectionne.matricule],
              ['Statut', <BadgeStatut key="s" statut={employeSelectionne.statut} />],
              ['Filiale', nomFiliale(employeSelectionne.filialeId)],
              ['Catégorie professionnelle', libelleCategorie(employeSelectionne.categorieProfessionnelle) ?? 'Non renseignée'],
              ['Sexe', employeSelectionne.sexe],
              ['Nationalité', employeSelectionne.nationalite],
              ['Téléphone', employeSelectionne.telephone],
              ['N° CNIB', employeSelectionne.numCnib],
              ['N° CNSS', employeSelectionne.numCnss],
              ['Date de naissance', formaterDateFr(employeSelectionne.dateNaissance)],
              ["Date d'embauche", formaterDateFr(employeSelectionne.dateEmbauche)],
            ].map(([label, valeur]) => (
              <div key={label as string}>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
                <dd className="mt-0.5 text-slate-800">{valeur}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Lieu d'affectation par défaut</dt>
            {peutGerer ? (
              <select
                value={employeSelectionne.chantierId ?? ''}
                onChange={(e) => definirChantierEmployeSelectionne(e.target.value)}
                disabled={chantierEnCours}
                className={`${CHAMP} mt-1`}
              >
                <option value="">— Non renseigné —</option>
                {chantiers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            ) : (
              <dd className="mt-0.5 text-slate-800">{nomChantier(employeSelectionne.chantierId) ?? 'Non renseigné'}</dd>
            )}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Soumis au pointage</dt>
            {peutGerer ? (
              <label className="mt-1.5 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={employeSelectionne.soumisPointage}
                  onChange={(e) => definirSoumisPointageEmployeSelectionne(e.target.checked)}
                  disabled={pointageEnCours}
                  className="h-4 w-4 rounded border-slate-300 text-primary-700 focus:ring-primary-100"
                />
                {employeSelectionne.soumisPointage ? 'Oui — paie bloquée sans pointage validé' : 'Non'}
              </label>
            ) : (
              <dd className="mt-0.5 text-slate-800">{employeSelectionne.soumisPointage ? 'Oui' : 'Non'}</dd>
            )}
          </div>

          {resumeRh && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="mb-2 flex items-center justify-between">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Congés et absences — {resumeRh.annee}
                </dt>
                {resumeRh.enMission && <Badge couleur="accent">En mission</Badge>}
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Absences validées</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{resumeRh.joursAbsenceValides} j</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Congés pris</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{resumeRh.congesPris} j</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Solde restant</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{resumeRh.soldeConges} j</dd>
                </div>
              </div>
              {resumeRh.enMission && (
                <p className="mt-2 text-xs text-slate-500">
                  {resumeRh.missionDestination}
                  {resumeRh.missionDateRetourPrevue && ` — retour prévu le ${formaterDateFr(resumeRh.missionDateRetourPrevue)}`}
                </p>
              )}
            </div>
          )}
        </Modale>
      )}
    </MiseEnPage>
  );
}
