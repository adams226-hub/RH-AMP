import { FormEvent, useEffect, useState } from 'react';
import { ErreurApi, api } from '../../api/client';
import { Badge } from '../Badge';
import { useAuth } from '../../context/AuthContext';
import { CategorieProfessionnelle } from '../../types/categoriesProfessionnelles';
import { Chantier } from '../../types/pointage';
import { Filiale } from '../../types/postes';

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

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Filiales</h3>
      {erreur && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}
      <ul className="mb-3 max-h-64 space-y-1.5 overflow-y-auto text-sm text-slate-700">
        {filiales.map((f) => (
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
                <span className={f.actif ? '' : 'text-slate-400'}>{f.nom}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <BadgeActif actif={f.actif} />
                  {peutGerer && (
                    <button onClick={() => setEdition({ id: f.id, valeur: f.nom })} className={LIEN}>
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
        <SectionCategories />
        <SectionChantiers />
      </div>
    </div>
  );
}
