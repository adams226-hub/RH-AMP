import { FormEvent, useEffect, useState } from 'react';
import { ErreurApi, api } from '../api/client';
import { Badge, CouleurBadge } from '../components/Badge';
import { ChampRecherche } from '../components/ChampRecherche';
import { EtatVide } from '../components/EtatVide';
import { FiltreSelect } from '../components/FiltreSelect';
import { IconeArchivage } from '../components/icones';
import { MiseEnPage } from '../components/MiseEnPage';
import { Pagination } from '../components/Pagination';
import { SelecteurEmploye } from '../components/SelecteurEmploye';
import { useAuth } from '../context/AuthContext';
import { CategorieDocument, DocumentArchive, StatutDocument } from '../types/archivage';

const LIBELLES_CATEGORIE: Record<CategorieDocument, string> = {
  contrat: 'Contrat',
  cnib: 'CNIB',
  diplome: 'Diplôme',
  certificat: 'Certificat',
  permis: 'Permis',
  document_administratif: 'Document administratif',
  bulletin_paie: 'Bulletin de paie',
  autre: 'Autre',
};

const COULEURS_STATUT: Record<StatutDocument, CouleurBadge> = {
  valide: 'succes',
  expire: 'erreur',
  a_renouveler: 'alerte',
};

const LIBELLES_STATUT: Record<StatutDocument, string> = {
  valide: 'Valide',
  expire: 'Expiré',
  a_renouveler: 'À renouveler',
};

const PAR_PAGE = 10;
const ROLES_GESTION = ['super_admin', 'drh_holding', 'rh_filiale'];

function formaterTaille(octets: number) {
  return `${(octets / 1024).toFixed(0)} Ko`;
}

export function Archivage() {
  const { jeton, role, employeId: monEmployeId } = useAuth();
  const estEmploye = role === 'employe';
  const peutSupprimer = role !== null && ROLES_GESTION.includes(role);

  const [employeId, setEmployeId] = useState('');
  const [documents, setDocuments] = useState<DocumentArchive[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [suppressionId, setSuppressionId] = useState<string | null>(null);

  const [recherche, setRecherche] = useState('');
  const [rechercheDebounce, setRechercheDebounce] = useState('');
  const [filtreCategorie, setFiltreCategorie] = useState('');
  const [page, setPage] = useState(1);

  const [categorie, setCategorie] = useState<CategorieDocument>('autre');
  const [fichier, setFichier] = useState<File | null>(null);

  // Filtre (matricule, nom, prénoms, nom de fichier) et catégorie appliqués côté serveur — avec
  // potentiellement des milliers de documents, tout charger puis filtrer dans le navigateur ne
  // passe pas à l'échelle (même raisonnement que le sélecteur d'employé).
  useEffect(() => {
    const identifiant = setTimeout(() => setRechercheDebounce(recherche.trim()), 250);
    return () => clearTimeout(identifiant);
  }, [recherche]);

  function rafraichir() {
    if (!jeton) return;
    api
      .listerDocuments(jeton, estEmploye ? undefined : employeId || undefined, filtreCategorie || undefined, rechercheDebounce || undefined)
      .then(setDocuments)
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : 'Erreur de chargement'));
  }

  useEffect(rafraichir, [jeton, employeId, estEmploye, filtreCategorie, rechercheDebounce]);

  const totalPages = Math.max(1, Math.ceil(documents.length / PAR_PAGE));
  const pageBornee = Math.min(page, totalPages);
  const pageAffichee = documents.slice((pageBornee - 1) * PAR_PAGE, pageBornee * PAR_PAGE);

  useEffect(() => setPage(1), [rechercheDebounce, filtreCategorie]);

  async function deposer(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !fichier) return;

    setEnCours(true);
    setErreur(null);

    try {
      await api.deposerDocument(jeton, fichier, categorie, estEmploye ? monEmployeId ?? undefined : employeId || undefined);
      setFichier(null);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'envoi");
    } finally {
      setEnCours(false);
    }
  }

  async function telecharger(id: string) {
    if (!jeton) return;
    try {
      const { url } = await api.telechargerDocument(jeton, id);
      window.open(url, '_blank');
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur de téléchargement');
    }
  }

  async function supprimer(id: string) {
    if (!jeton) return;
    if (!window.confirm('Supprimer ce document ? Cette action le déplace dans la corbeille.')) return;

    setSuppressionId(id);
    try {
      await api.supprimerDocument(jeton, id);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la suppression');
    } finally {
      setSuppressionId(null);
    }
  }

  return (
    <MiseEnPage>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">{estEmploye ? 'Mes documents' : 'Archivage documentaire'}</h2>
      <p className="mb-6 text-sm text-slate-500">{documents.length} document(s)</p>

      {!estEmploye && (
        <div className="mb-6">
          <SelecteurEmploye valeur={employeId} onChange={setEmployeId} />
          <span className="ml-2 text-xs text-slate-500">Laisser vide pour un document société</span>
        </div>
      )}

      {erreur && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <ChampRecherche
            valeur={recherche}
            onChange={setRecherche}
            placeholder="Rechercher un matricule, un nom, un fichier…"
          />
        </div>
        <FiltreSelect
          valeur={filtreCategorie}
          onChange={setFiltreCategorie}
          toutLibelle="Toutes les catégories"
          options={Object.entries(LIBELLES_CATEGORIE).map(([valeur, libelle]) => ({ valeur, libelle }))}
        />
        <span className="ml-auto text-xs text-slate-500">
          {documents.length} résultat{documents.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {documents.length > 0 ? (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Fichier</th>
                  <th className="px-4 py-3">Employé</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3">Taille</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageAffichee.map((d) => (
                  <tr key={d.id} className="transition-colors duration-200 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{d.nomOriginal}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {d.employeNom ? (
                        <>
                          {d.employeNom} {d.employePrenoms}
                          <span className="ml-1 font-mono text-xs text-slate-400">{d.employeMatricule}</span>
                        </>
                      ) : (
                        <span className="text-slate-400">Société</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{LIBELLES_CATEGORIE[d.categorie]}</td>
                    <td className="px-4 py-3 text-slate-500">{formaterTaille(d.tailleOctets)}</td>
                    <td className="px-4 py-3">
                      <Badge couleur={COULEURS_STATUT[d.statut]}>{LIBELLES_STATUT[d.statut]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => telecharger(d.id)}
                          className="font-medium text-primary-700 transition-colors duration-200 hover:text-primary-800 hover:underline"
                        >
                          Télécharger
                        </button>
                        {peutSupprimer && (
                          <button
                            disabled={suppressionId === d.id}
                            onClick={() => supprimer(d.id)}
                            className="font-medium text-erreur-600 transition-colors duration-200 hover:underline disabled:opacity-50"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={pageBornee} totalPages={totalPages} onChange={setPage} totalItems={documents.length} parPage={PAR_PAGE} />
          </>
        ) : (
          <EtatVide
            icone={<IconeArchivage />}
            titre={rechercheDebounce || filtreCategorie || employeId ? 'Aucun résultat' : 'Aucun document'}
            message={
              rechercheDebounce || filtreCategorie || employeId
                ? 'Aucun document ne correspond à votre recherche ou vos filtres.'
                : 'Les documents déposés apparaîtront ici, classés par catégorie.'
            }
          />
        )}
      </div>

      <form onSubmit={deposer} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Déposer un document</h3>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={categorie}
            onChange={(e) => setCategorie(e.target.value as CategorieDocument)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
            {Object.entries(LIBELLES_CATEGORIE).map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </select>
          <input type="file" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} required className="text-sm" />
          <button
            disabled={enCours}
            className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-800 hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
          >
            {enCours ? 'Envoi...' : 'Déposer'}
          </button>
        </div>
      </form>
    </MiseEnPage>
  );
}
