import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ErreurApi, api } from '../api/client';
import { AccesRestreint } from '../components/AccesRestreint';
import { Badge } from '../components/Badge';
import { ChampRecherche } from '../components/ChampRecherche';
import { MiseEnPage } from '../components/MiseEnPage';
import { useAuth } from '../context/AuthContext';
import { Departement, Filiale, Fonction, ServiceOrg } from '../types/postes';

const CHAMP =
  'rounded-md border border-slate-300 px-2 py-1.5 text-sm transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';
const BOUTON =
  'rounded-md bg-primary-700 px-3 py-1.5 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-800 hover:shadow-md';
const LIEN = 'font-medium text-primary-700 transition-colors duration-200 hover:underline';
const ROLES_ACCES = ['super_admin', 'drh_holding', 'rh_filiale'];
const ROLES_ARCHIVAGE = ['super_admin'];

function Compteur({ n }: { n: number }) {
  return (
    <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-medium text-slate-600">
      {n}
    </span>
  );
}

function BadgeActif({ actif, libelleArchive = 'Archivé' }: { actif: boolean; libelleArchive?: string }) {
  return actif ? <Badge couleur="succes">Actif</Badge> : <Badge couleur="slate">{libelleArchive}</Badge>;
}

export function Postes() {
  const { jeton, role } = useAuth();
  const peutGerer = role !== null && ROLES_ACCES.includes(role);
  const peutArchiver = role !== null && ROLES_ARCHIVAGE.includes(role);

  const [filiales, setFiliales] = useState<Filiale[]>([]);
  const [departements, setDepartements] = useState<Departement[]>([]);
  const [departementsVisibles, setDepartementsVisibles] = useState<Departement[]>([]);
  const [services, setServices] = useState<ServiceOrg[]>([]);
  const [fonctions, setFonctions] = useState<Fonction[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  const [rechercheDept, setRechercheDept] = useState('');
  const [rechercheService, setRechercheService] = useState('');
  const [rechercheFonction, setRechercheFonction] = useState('');

  const [nomDepartement, setNomDepartement] = useState('');
  const [filialeDepartement, setFilialeDepartement] = useState('');
  const [nomService, setNomService] = useState('');
  const [departementService, setDepartementService] = useState('');
  const [intituleFonction, setIntituleFonction] = useState('');

  // Édition inline (renommage) — un seul élément en cours d'édition par section.
  const [editionDept, setEditionDept] = useState<{ id: string; valeur: string } | null>(null);
  const [editionService, setEditionService] = useState<{ id: string; valeur: string } | null>(null);
  const [editionFonction, setEditionFonction] = useState<{ id: string; valeur: string } | null>(null);

  function rafraichir() {
    if (!jeton) return;
    Promise.all([
      api.listerFiliales(jeton),
      api.listerDepartements(jeton),
      api.listerDepartements(jeton, true),
      api.listerServices(jeton),
      api.listerFonctions(jeton),
    ])
      .then(([f, d, dv, s, fn]) => {
        setFiliales(f);
        setDepartements(d);
        setDepartementsVisibles(dv);
        setServices(s);
        setFonctions(fn);
      })
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : 'Erreur de chargement'));
  }

  useEffect(rafraichir, [jeton]);

  const departementsFiltres = useMemo(
    () => departements.filter((d) => d.nom.toLowerCase().includes(rechercheDept.trim().toLowerCase())),
    [departements, rechercheDept]
  );
  const servicesFiltres = useMemo(
    () => services.filter((s) => s.nom.toLowerCase().includes(rechercheService.trim().toLowerCase())),
    [services, rechercheService]
  );
  const fonctionsFiltrees = useMemo(
    () => fonctions.filter((f) => f.intitule.toLowerCase().includes(rechercheFonction.trim().toLowerCase())),
    [fonctions, rechercheFonction]
  );

  function departementActifDe(id: string): boolean {
    return departements.find((d) => d.id === id)?.actif ?? true;
  }

  async function ajouterDepartement(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !filialeDepartement || !nomDepartement) return;
    try {
      await api.creerDepartement(jeton, { filialeId: filialeDepartement, nom: nomDepartement });
      setNomDepartement('');
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors de la création du département");
    }
  }

  async function ajouterService(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !departementService || !nomService) return;
    try {
      await api.creerService(jeton, { departementId: departementService, nom: nomService });
      setNomService('');
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors de la création du service");
    }
  }

  async function ajouterFonction(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !intituleFonction) return;
    try {
      await api.creerFonction(jeton, { intitule: intituleFonction });
      setIntituleFonction('');
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors de la création de la fonction — un intitulé identique existe peut-être déjà");
    }
  }

  async function validerRenommageDept() {
    if (!jeton || !editionDept) return;
    try {
      await api.renommerDepartement(jeton, editionDept.id, editionDept.valeur);
      setEditionDept(null);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors du renommage');
    }
  }

  async function basculerActifDept(d: Departement) {
    if (!jeton) return;
    try {
      await api.archiverDepartement(jeton, d.id, !d.actif);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors du changement de statut");
    }
  }

  async function validerRenommageService() {
    if (!jeton || !editionService) return;
    try {
      await api.renommerService(jeton, editionService.id, editionService.valeur);
      setEditionService(null);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors du renommage');
    }
  }

  async function basculerActifService(s: ServiceOrg) {
    if (!jeton) return;
    try {
      await api.archiverService(jeton, s.id, !s.actif);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors du changement de statut");
    }
  }

  async function validerRenommageFonction() {
    if (!jeton || !editionFonction) return;
    try {
      await api.renommerFonction(jeton, editionFonction.id, editionFonction.valeur);
      setEditionFonction(null);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors du renommage — un intitulé identique existe peut-être déjà');
    }
  }

  async function basculerActifFonction(f: Fonction) {
    if (!jeton) return;
    try {
      await api.archiverFonction(jeton, f.id, !f.actif);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors du changement de statut");
    }
  }

  function nomFiliale(id: string) {
    return filiales.find((f) => f.id === id)?.nom ?? id;
  }

  function nomDepartementDe(id: string) {
    return departements.find((d) => d.id === id)?.nom ?? id;
  }

  if (role !== null && !ROLES_ACCES.includes(role)) {
    return <AccesRestreint />;
  }

  return (
    <MiseEnPage>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Postes</h2>
      <p className="mb-6 text-sm text-slate-500">
        Référentiel de l'organigramme. Un élément archivé disparaît des listes pour les nouvelles créations, mais
        reste visible et intact sur ce qui le référence déjà.
      </p>

      {erreur && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 flex items-center text-sm font-semibold text-slate-800">
            Filiales
            <Compteur n={filiales.length} />
          </h3>
          <ul className="space-y-1.5 text-sm text-slate-700">
            {filiales.map((f) => (
              <li key={f.id} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                {f.nom}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 flex items-center text-sm font-semibold text-slate-800">
            Départements
            <Compteur n={departements.length} />
          </h3>
          {departements.length > 5 && (
            <div className="mb-2">
              <ChampRecherche valeur={rechercheDept} onChange={setRechercheDept} placeholder="Filtrer…" />
            </div>
          )}
          <ul className="mb-3 max-h-64 space-y-1.5 overflow-y-auto text-sm text-slate-700">
            {departementsFiltres.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                {editionDept?.id === d.id ? (
                  <div className="flex flex-1 gap-1.5">
                    <input
                      value={editionDept.valeur}
                      onChange={(e) => setEditionDept({ id: d.id, valeur: e.target.value })}
                      className={`flex-1 ${CHAMP}`}
                      autoFocus
                    />
                    <button onClick={validerRenommageDept} className={LIEN}>
                      OK
                    </button>
                    <button onClick={() => setEditionDept(null)} className="text-slate-400 hover:text-slate-600">
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
                        <button onClick={() => setEditionDept({ id: d.id, valeur: d.nom })} className={`${LIEN} text-xs`}>
                          Renommer
                        </button>
                      )}
                      {peutArchiver && (
                        <button onClick={() => basculerActifDept(d)} className="text-xs text-slate-500 hover:underline">
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
            <form onSubmit={ajouterDepartement} className="flex gap-2">
              <select value={filialeDepartement} onChange={(e) => setFilialeDepartement(e.target.value)} className={CHAMP}>
                <option value="">Filiale…</option>
                {filiales.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nom}
                  </option>
                ))}
              </select>
              <input
                value={nomDepartement}
                onChange={(e) => setNomDepartement(e.target.value)}
                placeholder="Nom du département"
                className={`flex-1 ${CHAMP}`}
              />
              <button className={BOUTON}>Ajouter</button>
            </form>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 flex items-center text-sm font-semibold text-slate-800">
            Services
            <Compteur n={services.length} />
          </h3>
          {services.length > 5 && (
            <div className="mb-2">
              <ChampRecherche valeur={rechercheService} onChange={setRechercheService} placeholder="Filtrer…" />
            </div>
          )}
          <ul className="mb-3 max-h-64 space-y-1.5 overflow-y-auto text-sm text-slate-700">
            {servicesFiltres.map((s) => {
              const parentActif = departementActifDe(s.departementId);
              return (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  {editionService?.id === s.id ? (
                    <div className="flex flex-1 gap-1.5">
                      <input
                        value={editionService.valeur}
                        onChange={(e) => setEditionService({ id: s.id, valeur: e.target.value })}
                        className={`flex-1 ${CHAMP}`}
                        autoFocus
                      />
                      <button onClick={validerRenommageService} className={LIEN}>
                        OK
                      </button>
                      <button onClick={() => setEditionService(null)} className="text-slate-400 hover:text-slate-600">
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
                          <button onClick={() => setEditionService({ id: s.id, valeur: s.nom })} className={`${LIEN} text-xs`}>
                            Renommer
                          </button>
                        )}
                        {peutArchiver && (
                          <button onClick={() => basculerActifService(s)} className="text-xs text-slate-500 hover:underline">
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
            <form onSubmit={ajouterService} className="flex gap-2">
              <select value={departementService} onChange={(e) => setDepartementService(e.target.value)} className={CHAMP}>
                <option value="">Département…</option>
                {departementsVisibles.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nom}
                  </option>
                ))}
              </select>
              <input
                value={nomService}
                onChange={(e) => setNomService(e.target.value)}
                placeholder="Nom du service"
                className={`flex-1 ${CHAMP}`}
              />
              <button className={BOUTON}>Ajouter</button>
            </form>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-1 flex items-center text-sm font-semibold text-slate-800">
            Fonctions
            <Compteur n={fonctions.length} />
          </h3>
          <p className="mb-3 text-xs text-slate-400">
            Référentiel partagé à l'échelle du groupe (toutes filiales confondues) — pas de rattachement à un service.
          </p>
          {fonctions.length > 5 && (
            <div className="mb-2">
              <ChampRecherche valeur={rechercheFonction} onChange={setRechercheFonction} placeholder="Filtrer…" />
            </div>
          )}
          <ul className="mb-3 max-h-64 space-y-1.5 overflow-y-auto text-sm text-slate-700">
            {fonctionsFiltrees.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2">
                {editionFonction?.id === f.id ? (
                  <div className="flex flex-1 gap-1.5">
                    <input
                      value={editionFonction.valeur}
                      onChange={(e) => setEditionFonction({ id: f.id, valeur: e.target.value })}
                      className={`flex-1 ${CHAMP}`}
                      autoFocus
                    />
                    <button onClick={validerRenommageFonction} className={LIEN}>
                      OK
                    </button>
                    <button onClick={() => setEditionFonction(null)} className="text-slate-400 hover:text-slate-600">
                      Annuler
                    </button>
                  </div>
                ) : (
                  <>
                    <span className={f.actif ? '' : 'text-slate-400'}>{f.intitule}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <BadgeActif actif={f.actif} />
                      {peutGerer && (
                        <button onClick={() => setEditionFonction({ id: f.id, valeur: f.intitule })} className={`${LIEN} text-xs`}>
                          Renommer
                        </button>
                      )}
                      {peutArchiver && (
                        <button onClick={() => basculerActifFonction(f)} className="text-xs text-slate-500 hover:underline">
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
            <form onSubmit={ajouterFonction} className="flex gap-2">
              <input
                value={intituleFonction}
                onChange={(e) => setIntituleFonction(e.target.value)}
                placeholder="Intitulé de la fonction"
                className={`flex-1 ${CHAMP}`}
              />
              <button className={BOUTON}>Ajouter</button>
            </form>
          )}
        </section>
      </div>
    </MiseEnPage>
  );
}
