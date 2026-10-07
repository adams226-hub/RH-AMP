import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ErreurApi, api } from '../../api/client';
import { Badge } from '../Badge';
import { ChampRecherche } from '../ChampRecherche';
import { useAuth } from '../../context/AuthContext';
import { CategorieProfessionnelle } from '../../types/categoriesProfessionnelles';
import { Chantier } from '../../types/pointage';
import { Departement, Filiale, Fonction, ServiceOrg } from '../../types/postes';

const CHAMP =
  'rounded-md border border-slate-300 px-2 py-1.5 text-sm transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';
const BOUTON =
  'rounded-md bg-primary-700 px-3 py-1.5 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-800 hover:shadow-md disabled:pointer-events-none disabled:opacity-60';
const LIEN = 'text-xs font-medium text-primary-700 transition-colors duration-200 hover:underline';

function BadgeActif({ actif }: { actif: boolean }) {
  return actif ? <Badge couleur="succes">Actif</Badge> : <Badge couleur="slate">Archivé</Badge>;
}

// --- Filiales -----------------------------------------------------------------------------

function SectionFiliales() {
  const { jeton, role } = useAuth();
  const peutGerer = role === 'super_admin' || role === 'drh_holding' || role === 'rh_filiale';
  const peutArchiver = role === 'super_admin';

  const [filiales, setFiliales] = useState<Filiale[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [edition, setEdition] = useState<{ id: string; valeur: string } | null>(null);
  const [coordEnEdition, setCoordEnEdition] = useState<string | null>(null);
  const [formCoord, setFormCoord] = useState({
    raisonSociale: '',
    adresse: '',
    rccm: '',
    ifu: '',
    telephone: '',
    siteWeb: '',
    couleurAccent: '#94a3b8',
  });
  const [coordEnCours, setCoordEnCours] = useState(false);
  const [logoEnCours, setLogoEnCours] = useState<string | null>(null);

  function rafraichir() {
    if (!jeton) return;
    api.listerFiliales(jeton).then(setFiliales);
  }

  useEffect(rafraichir, [jeton]);

  async function creer(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !nom) return;
    try {
      await api.creerFiliale(jeton, { nom });
      setNom('');
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la création');
    }
  }

  async function valider() {
    if (!jeton || !edition) return;
    try {
      await api.renommerFiliale(jeton, edition.id, edition.valeur);
      setEdition(null);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors du renommage');
    }
  }

  async function basculer(f: Filiale) {
    if (!jeton) return;
    try {
      await api.archiverFiliale(jeton, f.id, !f.actif);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors du changement de statut');
    }
  }

  function ouvrirCoordonnees(f: Filiale) {
    setCoordEnEdition(f.id);
    setFormCoord({
      raisonSociale: f.raisonSociale ?? '',
      adresse: f.adresse ?? '',
      rccm: f.rccm ?? '',
      ifu: f.ifu ?? '',
      telephone: f.telephone ?? '',
      siteWeb: f.siteWeb ?? '',
      couleurAccent: f.couleurAccent ?? '#94a3b8',
    });
  }

  async function enregistrerCoordonnees(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !coordEnEdition) return;
    setCoordEnCours(true);
    try {
      await api.modifierCoordonneesFiliale(jeton, coordEnEdition, formCoord);
      setCoordEnEdition(null);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'enregistrement des coordonnées");
    } finally {
      setCoordEnCours(false);
    }
  }

  async function uploaderLogo(f: Filiale, fichier: File) {
    if (!jeton) return;
    setLogoEnCours(f.id);
    try {
      await api.uploaderLogoFiliale(jeton, f.id, fichier);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'envoi du logo");
    } finally {
      setLogoEnCours(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Filiales</h3>
      {erreur && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}
      <ul className="mb-3 max-h-80 space-y-1.5 overflow-y-auto text-sm text-slate-700">
        {filiales.map((f) => (
          <li key={f.id}>
            <div className="flex items-center justify-between gap-2">
              {edition?.id === f.id ? (
                <div className="flex flex-1 gap-1.5">
                  <input
                    value={edition.valeur}
                    onChange={(e) => setEdition({ id: f.id, valeur: e.target.value })}
                    className={`flex-1 ${CHAMP}`}
                    autoFocus
                  />
                  <button onClick={valider} className={LIEN}>
                    OK
                  </button>
                  <button onClick={() => setEdition(null)} className="text-xs text-slate-400 hover:text-slate-600">
                    Annuler
                  </button>
                </div>
              ) : (
                <>
                  <span className={f.actif ? '' : 'text-slate-400'}>{f.nom}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <BadgeActif actif={f.actif} />
                    {peutGerer && (
                      <button onClick={() => setEdition({ id: f.id, valeur: f.nom })} className={LIEN}>
                        Renommer
                      </button>
                    )}
                    {peutGerer && (
                      <button
                        onClick={() => (coordEnEdition === f.id ? setCoordEnEdition(null) : ouvrirCoordonnees(f))}
                        className={LIEN}
                      >
                        {coordEnEdition === f.id ? 'Fermer' : 'Coordonnées'}
                      </button>
                    )}
                    {peutArchiver && (
                      <button onClick={() => basculer(f)} className="text-xs text-slate-500 hover:underline">
                        {f.actif ? 'Archiver' : 'Réactiver'}
                      </button>
                    )}
                  </span>
                </>
              )}
            </div>

            {coordEnEdition === f.id && (
              <form onSubmit={enregistrerCoordonnees} className="mt-2 grid grid-cols-1 gap-2 rounded-md bg-slate-50 p-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-slate-500">
                    Raison sociale complète (ex. "African Mining Partenair (AMP) SA") — utilisée dans les
                    attestations
                  </label>
                  <input
                    value={formCoord.raisonSociale}
                    onChange={(e) => setFormCoord({ ...formCoord, raisonSociale: e.target.value })}
                    placeholder={f.nom}
                    className={`w-full ${CHAMP}`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-slate-500">Adresse</label>
                  <input
                    value={formCoord.adresse}
                    onChange={(e) => setFormCoord({ ...formCoord, adresse: e.target.value })}
                    placeholder="04 BP 8704 Ouagadougou 04"
                    className={`w-full ${CHAMP}`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">RCCM</label>
                  <input
                    value={formCoord.rccm}
                    onChange={(e) => setFormCoord({ ...formCoord, rccm: e.target.value })}
                    className={`w-full ${CHAMP}`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">IFU</label>
                  <input
                    value={formCoord.ifu}
                    onChange={(e) => setFormCoord({ ...formCoord, ifu: e.target.value })}
                    className={`w-full ${CHAMP}`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Téléphone</label>
                  <input
                    value={formCoord.telephone}
                    onChange={(e) => setFormCoord({ ...formCoord, telephone: e.target.value })}
                    className={`w-full ${CHAMP}`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Site web</label>
                  <input
                    value={formCoord.siteWeb}
                    onChange={(e) => setFormCoord({ ...formCoord, siteWeb: e.target.value })}
                    className={`w-full ${CHAMP}`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Couleur d'accent (bandeau/pied de page des attestations)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formCoord.couleurAccent}
                      onChange={(e) => setFormCoord({ ...formCoord, couleurAccent: e.target.value })}
                      className="h-8 w-10 cursor-pointer rounded border border-slate-300"
                    />
                    <input
                      value={formCoord.couleurAccent}
                      onChange={(e) => setFormCoord({ ...formCoord, couleurAccent: e.target.value })}
                      className={`w-full ${CHAMP}`}
                    />
                  </div>
                </div>
                <div className="col-span-2 flex items-center gap-3 border-t border-slate-200 pt-2">
                  <label className="text-xs text-slate-500">
                    Logo {f.logoUrl ? <span className="text-succes-700">— déjà déposé</span> : <span className="text-slate-400">— aucun</span>}
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    disabled={logoEnCours === f.id}
                    onChange={(e) => {
                      const fichier = e.target.files?.[0];
                      if (fichier) uploaderLogo(f, fichier);
                      e.target.value = '';
                    }}
                    className="text-xs text-slate-600"
                  />
                  {logoEnCours === f.id && <span className="text-xs text-slate-400">Envoi...</span>}
                </div>
                <div className="col-span-2">
                  <button disabled={coordEnCours} className={BOUTON}>
                    {coordEnCours ? 'Enregistrement...' : 'Enregistrer les coordonnées'}
                  </button>
                </div>
              </form>
            )}
          </li>
        ))}
        {filiales.length === 0 && <li className="text-slate-400">Aucune filiale.</li>}
      </ul>
      {peutGerer && (
        <form onSubmit={creer} className="flex gap-2">
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Nom de la filiale"
            className={`flex-1 ${CHAMP}`}
          />
          <button className={BOUTON}>Ajouter</button>
        </form>
      )}
    </div>
  );
}

// --- Catégories professionnelles -----------------------------------------------------------

function SectionCategories() {
  const { jeton, role } = useAuth();
  // Réservé à super_admin côté backend (estCadre pilote l'abattement IUTS) — pas de niveau
  // intermédiaire ici, contrairement aux autres référentiels.
  const peutGerer = role === 'super_admin';

  const [categories, setCategories] = useState<CategorieProfessionnelle[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [libelle, setLibelle] = useState('');
  const [estCadre, setEstCadre] = useState(false);
  const [edition, setEdition] = useState<{ id: string; libelle: string; estCadre: boolean } | null>(null);

  function rafraichir() {
    if (!jeton) return;
    api.listerCategoriesProfessionnelles(jeton).then(setCategories);
  }

  useEffect(rafraichir, [jeton]);

  async function creer(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !libelle) return;
    try {
      await api.creerCategorieProfessionnelle(jeton, { libelle, estCadre });
      setLibelle('');
      setEstCadre(false);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la création');
    }
  }

  async function valider() {
    if (!jeton || !edition) return;
    try {
      await api.modifierCategorieProfessionnelle(jeton, edition.id, { libelle: edition.libelle, estCadre: edition.estCadre });
      setEdition(null);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la modification');
    }
  }

  async function basculer(c: CategorieProfessionnelle) {
    if (!jeton) return;
    try {
      await api.archiverCategorieProfessionnelle(jeton, c.id, !c.actif);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors du changement de statut');
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-slate-800">Catégories professionnelles</h3>
      <p className="mb-3 text-xs text-slate-400">
        « Cadre » pilote l'abattement forfaitaire IUTS (20% si cadre, 25% sinon) — n'affecte que les calculs de paie
        à venir, jamais les bulletins déjà générés.
      </p>
      {erreur && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}
      <ul className="mb-3 max-h-64 space-y-1.5 overflow-y-auto text-sm text-slate-700">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2">
            {edition?.id === c.id ? (
              <div className="flex flex-1 flex-wrap items-center gap-1.5">
                <input
                  value={edition.libelle}
                  onChange={(e) => setEdition({ ...edition, libelle: e.target.value })}
                  className={`flex-1 ${CHAMP}`}
                  autoFocus
                />
                <label className="flex items-center gap-1 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={edition.estCadre}
                    onChange={(e) => setEdition({ ...edition, estCadre: e.target.checked })}
                  />
                  Cadre
                </label>
                <button onClick={valider} className={LIEN}>
                  OK
                </button>
                <button onClick={() => setEdition(null)} className="text-xs text-slate-400 hover:text-slate-600">
                  Annuler
                </button>
              </div>
            ) : (
              <>
                <span className={c.actif ? '' : 'text-slate-400'}>
                  {c.libelle} {c.estCadre && <span className="text-slate-400">— Cadre</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <BadgeActif actif={c.actif} />
                  {peutGerer && (
                    <button onClick={() => setEdition({ id: c.id, libelle: c.libelle, estCadre: c.estCadre })} className={LIEN}>
                      Modifier
                    </button>
                  )}
                  {peutGerer && (
                    <button onClick={() => basculer(c)} className="text-xs text-slate-500 hover:underline">
                      {c.actif ? 'Archiver' : 'Réactiver'}
                    </button>
                  )}
                </span>
              </>
            )}
          </li>
        ))}
        {categories.length === 0 && <li className="text-slate-400">Aucune catégorie.</li>}
      </ul>
      {peutGerer && (
        <form onSubmit={creer} className="flex flex-wrap items-center gap-2">
          <input
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="Ex. Technicien supérieur"
            className={`flex-1 ${CHAMP}`}
          />
          <label className="flex items-center gap-1 text-xs text-slate-600">
            <input type="checkbox" checked={estCadre} onChange={(e) => setEstCadre(e.target.checked)} />
            Cadre
          </label>
          <button className={BOUTON}>Ajouter</button>
        </form>
      )}
    </div>
  );
}

// --- Départements ---------------------------------------------------------------------------

function SectionDepartements() {
  const { jeton, role } = useAuth();
  const peutGerer = role === 'super_admin' || role === 'drh_holding' || role === 'rh_filiale';
  const peutArchiver = role === 'super_admin';

  const [filiales, setFiliales] = useState<Filiale[]>([]);
  const [departements, setDepartements] = useState<Departement[]>([]);
  const [recherche, setRecherche] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [filialeId, setFilialeId] = useState('');
  const [edition, setEdition] = useState<{ id: string; valeur: string } | null>(null);

  function rafraichir() {
    if (!jeton) return;
    api.listerDepartements(jeton).then(setDepartements);
  }

  useEffect(rafraichir, [jeton]);

  useEffect(() => {
    if (!jeton) return;
    api.listerFiliales(jeton, true).then(setFiliales);
  }, [jeton]);

  const departementsFiltres = useMemo(
    () => departements.filter((d) => d.nom.toLowerCase().includes(recherche.trim().toLowerCase())),
    [departements, recherche]
  );

  const nomFiliale = (id: string) => filiales.find((f) => f.id === id)?.nom ?? id;

  async function creer(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !filialeId || !nom) return;
    try {
      await api.creerDepartement(jeton, { filialeId, nom });
      setNom('');
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la création');
    }
  }

  async function valider() {
    if (!jeton || !edition) return;
    try {
      await api.renommerDepartement(jeton, edition.id, edition.valeur);
      setEdition(null);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors du renommage');
    }
  }

  async function basculer(d: Departement) {
    if (!jeton) return;
    try {
      await api.archiverDepartement(jeton, d.id, !d.actif);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors du changement de statut');
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Départements</h3>
      {erreur && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}
      {departements.length > 5 && (
        <div className="mb-2">
          <ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Filtrer…" />
        </div>
      )}
      <ul className="mb-3 max-h-64 space-y-1.5 overflow-y-auto text-sm text-slate-700">
        {departementsFiltres.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-2">
            {edition?.id === d.id ? (
              <div className="flex flex-1 gap-1.5">
                <input
                  value={edition.valeur}
                  onChange={(e) => setEdition({ id: d.id, valeur: e.target.value })}
                  className={`flex-1 ${CHAMP}`}
                  autoFocus
                />
                <button onClick={valider} className={LIEN}>
                  OK
                </button>
                <button onClick={() => setEdition(null)} className="text-xs text-slate-400 hover:text-slate-600">
                  Annuler
                </button>
              </div>
            ) : (
              <>
                <span className={d.actif ? '' : 'text-slate-400'}>
                  {d.nom} <span className="text-slate-400">— {nomFiliale(d.filialeId)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <BadgeActif actif={d.actif} />
                  {peutGerer && (
                    <button onClick={() => setEdition({ id: d.id, valeur: d.nom })} className={LIEN}>
                      Renommer
                    </button>
                  )}
                  {peutArchiver && (
                    <button onClick={() => basculer(d)} className="text-xs text-slate-500 hover:underline">
                      {d.actif ? 'Archiver' : 'Réactiver'}
                    </button>
                  )}
                </span>
              </>
            )}
          </li>
        ))}
        {departementsFiltres.length === 0 && <li className="text-slate-400">Aucun résultat.</li>}
      </ul>
      {peutGerer && (
        <form onSubmit={creer} className="flex flex-wrap gap-2">
          <select value={filialeId} onChange={(e) => setFilialeId(e.target.value)} required className={CHAMP}>
            <option value="">Filiale…</option>
            {filiales.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nom}
              </option>
            ))}
          </select>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Nom du département"
            className={`flex-1 ${CHAMP}`}
          />
          <button className={BOUTON}>Ajouter</button>
        </form>
      )}
    </div>
  );
}

// --- Services ---------------------------------------------------------------------------------

function SectionServices() {
  const { jeton, role } = useAuth();
  const peutGerer = role === 'super_admin' || role === 'drh_holding' || role === 'rh_filiale';
  const peutArchiver = role === 'super_admin';

  const [services, setServices] = useState<ServiceOrg[]>([]);
  const [departements, setDepartements] = useState<Departement[]>([]);
  const [departementsVisibles, setDepartementsVisibles] = useState<Departement[]>([]);
  const [recherche, setRecherche] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [departementId, setDepartementId] = useState('');
  const [edition, setEdition] = useState<{ id: string; valeur: string } | null>(null);

  function rafraichir() {
    if (!jeton) return;
    api.listerServices(jeton).then(setServices);
  }

  useEffect(rafraichir, [jeton]);

  useEffect(() => {
    if (!jeton) return;
    api.listerDepartements(jeton).then(setDepartements);
    api.listerDepartements(jeton, true).then(setDepartementsVisibles);
  }, [jeton]);

  const servicesFiltres = useMemo(
    () => services.filter((s) => s.nom.toLowerCase().includes(recherche.trim().toLowerCase())),
    [services, recherche]
  );

  function departementActifDe(id: string): boolean {
    return departements.find((d) => d.id === id)?.actif ?? true;
  }
  const nomDepartementDe = (id: string) => departements.find((d) => d.id === id)?.nom ?? id;

  async function creer(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !departementId || !nom) return;
    try {
      await api.creerService(jeton, { departementId, nom });
      setNom('');
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors de la création du service");
    }
  }

  async function valider() {
    if (!jeton || !edition) return;
    try {
      await api.renommerService(jeton, edition.id, edition.valeur);
      setEdition(null);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors du renommage');
    }
  }

  async function basculer(s: ServiceOrg) {
    if (!jeton) return;
    try {
      await api.archiverService(jeton, s.id, !s.actif);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors du changement de statut');
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Services</h3>
      {erreur && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}
      {services.length > 5 && (
        <div className="mb-2">
          <ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Filtrer…" />
        </div>
      )}
      <ul className="mb-3 max-h-64 space-y-1.5 overflow-y-auto text-sm text-slate-700">
        {servicesFiltres.map((s) => {
          const parentActif = departementActifDe(s.departementId);
          return (
            <li key={s.id} className="flex items-center justify-between gap-2">
              {edition?.id === s.id ? (
                <div className="flex flex-1 gap-1.5">
                  <input
                    value={edition.valeur}
                    onChange={(e) => setEdition({ id: s.id, valeur: e.target.value })}
                    className={`flex-1 ${CHAMP}`}
                    autoFocus
                  />
                  <button onClick={valider} className={LIEN}>
                    OK
                  </button>
                  <button onClick={() => setEdition(null)} className="text-xs text-slate-400 hover:text-slate-600">
                    Annuler
                  </button>
                </div>
              ) : (
                <>
                  <span className={s.actif && parentActif ? '' : 'text-slate-400'}>
                    {s.nom} <span className="text-slate-400">— {nomDepartementDe(s.departementId)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {!s.actif ? (
                      <BadgeActif actif={false} />
                    ) : !parentActif ? (
                      <Badge couleur="alerte">Masqué (département archivé)</Badge>
                    ) : (
                      <BadgeActif actif={true} />
                    )}
                    {peutGerer && (
                      <button onClick={() => setEdition({ id: s.id, valeur: s.nom })} className={LIEN}>
                        Renommer
                      </button>
                    )}
                    {peutArchiver && (
                      <button onClick={() => basculer(s)} className="text-xs text-slate-500 hover:underline">
                        {s.actif ? 'Archiver' : 'Réactiver'}
                      </button>
                    )}
                  </span>
                </>
              )}
            </li>
          );
        })}
        {servicesFiltres.length === 0 && <li className="text-slate-400">Aucun résultat.</li>}
      </ul>
      {peutGerer && (
        <form onSubmit={creer} className="flex flex-wrap gap-2">
          <select value={departementId} onChange={(e) => setDepartementId(e.target.value)} required className={CHAMP}>
            <option value="">Département…</option>
            {departementsVisibles.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </select>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Nom du service"
            className={`flex-1 ${CHAMP}`}
          />
          <button className={BOUTON}>Ajouter</button>
        </form>
      )}
    </div>
  );
}

// --- Fonctions --------------------------------------------------------------------------------

function SectionFonctions() {
  const { jeton, role } = useAuth();
  const peutGerer = role === 'super_admin' || role === 'drh_holding' || role === 'rh_filiale';
  const peutArchiver = role === 'super_admin';

  const [fonctions, setFonctions] = useState<Fonction[]>([]);
  const [recherche, setRecherche] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [intitule, setIntitule] = useState('');
  const [edition, setEdition] = useState<{ id: string; valeur: string } | null>(null);

  function rafraichir() {
    if (!jeton) return;
    api.listerFonctions(jeton).then(setFonctions);
  }

  useEffect(rafraichir, [jeton]);

  const fonctionsFiltrees = useMemo(
    () => fonctions.filter((f) => f.intitule.toLowerCase().includes(recherche.trim().toLowerCase())),
    [fonctions, recherche]
  );

  async function creer(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !intitule) return;
    try {
      await api.creerFonction(jeton, { intitule });
      setIntitule('');
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors de la création de la fonction — un intitulé identique existe peut-être déjà");
    }
  }

  async function valider() {
    if (!jeton || !edition) return;
    try {
      await api.renommerFonction(jeton, edition.id, edition.valeur);
      setEdition(null);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors du renommage — un intitulé identique existe peut-être déjà');
    }
  }

  async function basculer(f: Fonction) {
    if (!jeton) return;
    try {
      await api.archiverFonction(jeton, f.id, !f.actif);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors du changement de statut');
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-slate-800">Fonctions</h3>
      <p className="mb-3 text-xs text-slate-400">
        Référentiel partagé à l'échelle du groupe (toutes filiales confondues) — pas de rattachement à un service.
        Ex. Menuisier, Comptable, Informaticien, Soudeur…
      </p>
      {erreur && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}
      {fonctions.length > 5 && (
        <div className="mb-2">
          <ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Filtrer…" />
        </div>
      )}
      <ul className="mb-3 max-h-64 space-y-1.5 overflow-y-auto text-sm text-slate-700">
        {fonctionsFiltrees.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-2">
            {edition?.id === f.id ? (
              <div className="flex flex-1 gap-1.5">
                <input
                  value={edition.valeur}
                  onChange={(e) => setEdition({ id: f.id, valeur: e.target.value })}
                  className={`flex-1 ${CHAMP}`}
                  autoFocus
                />
                <button onClick={valider} className={LIEN}>
                  OK
                </button>
                <button onClick={() => setEdition(null)} className="text-xs text-slate-400 hover:text-slate-600">
                  Annuler
                </button>
              </div>
            ) : (
              <>
                <span className={f.actif ? '' : 'text-slate-400'}>{f.intitule}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <BadgeActif actif={f.actif} />
                  {peutGerer && (
                    <button onClick={() => setEdition({ id: f.id, valeur: f.intitule })} className={LIEN}>
                      Renommer
                    </button>
                  )}
                  {peutArchiver && (
                    <button onClick={() => basculer(f)} className="text-xs text-slate-500 hover:underline">
                      {f.actif ? 'Archiver' : 'Réactiver'}
                    </button>
                  )}
                </span>
              </>
            )}
          </li>
        ))}
        {fonctionsFiltrees.length === 0 && <li className="text-slate-400">Aucun résultat.</li>}
      </ul>
      {peutGerer && (
        <form onSubmit={creer} className="flex gap-2">
          <input
            value={intitule}
            onChange={(e) => setIntitule(e.target.value)}
            placeholder="Intitulé de la fonction"
            className={`flex-1 ${CHAMP}`}
          />
          <button className={BOUTON}>Ajouter</button>
        </form>
      )}
    </div>
  );
}

// --- Chantiers (lieu d'affectation) --------------------------------------------------------

function SectionChantiers() {
  const { jeton, role } = useAuth();
  const peutGerer = role === 'super_admin' || role === 'drh_holding' || role === 'rh_filiale';
  const peutArchiver = role === 'super_admin';

  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [filiales, setFiliales] = useState<Filiale[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [filialeId, setFilialeId] = useState('');
  const [edition, setEdition] = useState<{ id: string; valeur: string } | null>(null);

  function rafraichir() {
    if (!jeton) return;
    api.listerChantiers(jeton, true).then(setChantiers);
  }

  useEffect(rafraichir, [jeton]);

  useEffect(() => {
    if (!jeton) return;
    api.listerFiliales(jeton, true).then(setFiliales);
  }, [jeton]);

  const nomFiliale = (id: string) => filiales.find((f) => f.id === id)?.nom ?? id;

  async function creer(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !nom || !filialeId) return;
    try {
      await api.creerChantier(jeton, { filialeId, nom });
      setNom('');
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la création');
    }
  }

  async function valider() {
    if (!jeton || !edition) return;
    try {
      await api.renommerChantier(jeton, edition.id, edition.valeur);
      setEdition(null);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors du renommage');
    }
  }

  async function basculer(c: Chantier) {
    if (!jeton) return;
    try {
      await api.archiverChantier(jeton, c.id, !c.actif);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors du changement de statut');
    }
  }

  // Le backend refuse (409) si le chantier a un employé affecté ou des pointages — dans ce cas le
  // message renvoyé invite déjà à archiver à la place, affiché tel quel.
  async function supprimer(c: Chantier) {
    if (!jeton) return;
    if (!window.confirm(`Supprimer définitivement le chantier « ${c.nom} » ? Cette action est irréversible.`)) return;
    try {
      await api.supprimerChantier(jeton, c.id);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la suppression');
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-slate-800">Lieux d'affectation (chantiers)</h3>
      <p className="mb-3 text-xs text-slate-400">
        Utilisés par Pointage et comme lieu d'affectation par défaut sur la fiche employé (Journal de Paie).
      </p>
      {erreur && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}
      <ul className="mb-3 max-h-64 space-y-1.5 overflow-y-auto text-sm text-slate-700">
        {chantiers.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2">
            {edition?.id === c.id ? (
              <div className="flex flex-1 gap-1.5">
                <input
                  value={edition.valeur}
                  onChange={(e) => setEdition({ id: c.id, valeur: e.target.value })}
                  className={`flex-1 ${CHAMP}`}
                  autoFocus
                />
                <button onClick={valider} className={LIEN}>
                  OK
                </button>
                <button onClick={() => setEdition(null)} className="text-xs text-slate-400 hover:text-slate-600">
                  Annuler
                </button>
              </div>
            ) : (
              <>
                <span className={c.actif ? '' : 'text-slate-400'}>
                  {c.nom} <span className="text-slate-400">— {nomFiliale(c.filialeId)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <BadgeActif actif={c.actif} />
                  {peutGerer && (
                    <button onClick={() => setEdition({ id: c.id, valeur: c.nom })} className={LIEN}>
                      Renommer
                    </button>
                  )}
                  {peutArchiver && (
                    <button onClick={() => basculer(c)} className="text-xs text-slate-500 hover:underline">
                      {c.actif ? 'Archiver' : 'Réactiver'}
                    </button>
                  )}
                  {peutArchiver && (
                    <button onClick={() => supprimer(c)} className="text-xs text-red-600 hover:underline">
                      Supprimer
                    </button>
                  )}
                </span>
              </>
            )}
          </li>
        ))}
        {chantiers.length === 0 && <li className="text-slate-400">Aucun chantier.</li>}
      </ul>
      {peutGerer && (
        <form onSubmit={creer} className="flex flex-wrap gap-2">
          <select value={filialeId} onChange={(e) => setFilialeId(e.target.value)} required className={CHAMP}>
            <option value="">Filiale…</option>
            {filiales.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nom}
              </option>
            ))}
          </select>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Nom du chantier"
            className={`flex-1 ${CHAMP}`}
          />
          <button className={BOUTON}>Ajouter</button>
        </form>
      )}
    </div>
  );
}

export function SectionReferentiels() {
  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Un élément archivé disparaît des listes pour les nouvelles fiches employé, mais reste intact sur ce qui le
        référence déjà.
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <SectionFiliales />
        <SectionDepartements />
        <SectionServices />
        <SectionCategories />
        <SectionFonctions />
        <SectionChantiers />
      </div>
    </div>
  );
}
