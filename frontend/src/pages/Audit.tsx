import { useEffect, useState } from 'react';
import { ErreurApi, api } from '../api/client';
import { AccesRestreint } from '../components/AccesRestreint';
import { Badge, CouleurBadge } from '../components/Badge';
import { ChampRecherche } from '../components/ChampRecherche';
import { EtatVide } from '../components/EtatVide';
import { IconeAudit } from '../components/icones';
import { FiltreSelect } from '../components/FiltreSelect';
import { MiseEnPage } from '../components/MiseEnPage';
import { Modale } from '../components/Modale';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { Table } from '../components/Table';
import { useAuth } from '../context/AuthContext';
import { EntreeAudit } from '../types/audit';

const CHAMP =
  'rounded-md border border-slate-300 px-2.5 py-1.5 text-sm transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';

const PAR_PAGE = 25;

const MODULES = [
  'auth',
  'employes',
  'postes',
  'contrats',
  'conges',
  'conges-speciaux',
  'absences',
  'missions',
  'pointage',
  'paie',
  'elements-variables',
  'cycles-paie',
  'categories-professionnelles',
  'tableaux-de-bord',
  'audit',
  'utilisateurs',
  'parametres-paie',
  'jours-feries',
  'attestations',
];
const ACTIONS = ['creation', 'modification', 'suppression', 'connexion', 'connexion_echouee'];

// Les modules viennent du segment brut de l'URL API (cf. middleware/journalAudit.ts) — traduits
// ici en libellés lisibles pour un utilisateur RH, sans toucher à ce qui est stocké en base.
const LIBELLES_MODULE: Record<string, string> = {
  auth: 'Connexion',
  employes: 'Employés',
  postes: 'Organisation (filiales, services, fonctions)',
  contrats: 'Contrats',
  conges: 'Congés',
  'conges-speciaux': 'Congés spéciaux',
  absences: 'Absences',
  missions: 'Missions',
  pointage: 'Pointage',
  paie: 'Paie',
  'elements-variables': 'Éléments du mois',
  'cycles-paie': 'Cycle de paie',
  'categories-professionnelles': 'Catégories professionnelles',
  'tableaux-de-bord': 'Tableaux de bord',
  audit: 'Audit',
  utilisateurs: 'Utilisateurs',
  'parametres-paie': 'Paramètres de paie',
  'jours-feries': 'Jours fériés',
  attestations: 'Attestations',
};

function libelleModule(module: string): string {
  return LIBELLES_MODULE[module] ?? module;
}

const COULEURS_ACTION: Record<string, CouleurBadge> = {
  creation: 'succes',
  modification: 'primary',
  suppression: 'erreur',
  connexion: 'accent',
  connexion_echouee: 'alerte',
};

const LIBELLES_ACTION: Record<string, string> = {
  creation: 'Création',
  modification: 'Modification',
  suppression: 'Suppression',
  connexion: 'Connexion',
  connexion_echouee: 'Connexion échouée',
};

// Format fixe (02/10/2026 15:35), jamais coupé sur deux lignes dans le tableau — demande
// explicite, plus précis que le format "2 oct. 2026, 15:35" utilisé auparavant.
function formaterHorodatage(iso: string) {
  const d = new Date(iso);
  const jour = String(d.getDate()).padStart(2, '0');
  const mois = String(d.getMonth() + 1).padStart(2, '0');
  const heures = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${jour}/${mois}/${d.getFullYear()} ${heures}:${minutes}`;
}

// --- Lisibilisation du détail d'action (Avant / Après) ---
// Le journal stocke le corps JSON brut des réponses API (identifiants, codes techniques).
// Ce qui suit le traduit en libellés et valeurs français lisibles pour un utilisateur RH.

interface Referentiels {
  employes: Record<string, string>;
  filiales: Record<string, string>;
  departements: Record<string, string>;
  services: Record<string, string>;
  fonctions: Record<string, string>;
  utilisateurs: Record<string, string>;
}

const REFERENTIELS_VIDES: Referentiels = {
  employes: {},
  filiales: {},
  departements: {},
  services: {},
  fonctions: {},
  utilisateurs: {},
};

const RESOLVEURS_ID: Record<string, keyof Referentiels> = {
  employeId: 'employes',
  responsableId: 'employes',
  filialeId: 'filiales',
  departementId: 'departements',
  serviceId: 'services',
  fonctionId: 'fonctions',
  utilisateurId: 'utilisateurs',
  soumisPar: 'utilisateurs',
  validePar: 'utilisateurs',
};

const LIBELLES_CHAMPS: Record<string, string> = {
  type: 'Type',
  jours: 'Jours',
  montant: 'Montant',
  periode: 'Période',
  moisPaie: 'Mois de paie',
  employeId: 'Employé',
  responsableId: 'Responsable',
  filialeId: 'Filiale',
  departementId: 'Département',
  serviceId: 'Service',
  fonctionId: 'Fonction',
  utilisateurId: 'Utilisateur',
  soumisPar: 'Soumis par',
  validePar: 'Validé par',
  chantierId: 'Chantier',
  nom: 'Nom',
  prenoms: 'Prénoms',
  matricule: 'Matricule',
  email: 'Email',
  role: 'Rôle',
  statut: 'Statut',
  actif: 'Actif',
  dateDebut: 'Date de début',
  dateFin: 'Date de fin',
  dateNaissance: 'Date de naissance',
  dateEmbauche: "Date d'embauche",
  motif: 'Motif',
  ville: 'Ville',
  pays: 'Pays',
  adresse: 'Adresse',
  telephone: 'Téléphone',
  intitule: 'Intitulé',
  description: 'Description',
  netAPayer: 'Net à payer',
  heuresHs15: 'Heures sup. 15 %',
  heuresHs35: 'Heures sup. 35 %',
  heuresHs60: 'Heures sup. 60 %',
  joursPanier: 'Jours panier',
  nbJoursAbsenceInjustifiee: "Jours d'absence injustifiée",
  nbJoursReposMedical: 'Jours de repos médical',
  nbJoursPermissionNonPayee: 'Jours de permission non payée',
  nbJoursPermissionPayee: 'Jours de permission payée',
  nbJoursCongeAnnuel: 'Jours de congé annuel',
};

const LIBELLES_TYPES_ELEMENT: Record<string, string> = {
  prime: 'Prime',
  avance: 'Avance / acompte',
  panier: 'Prime de panier',
  reliquat: 'Reliquat',
  absence_injustifiee: 'Absence injustifiée',
  trop_percu: 'Salaire trop perçu',
  prime_salissure: 'Prime de salissure',
  prime_lait: 'Prime de lait',
  heure_sup_50: 'Heure supplémentaire 50 %',
  heure_sup_120: 'Heure supplémentaire 120 %',
};

function libelleChamp(cle: string): string {
  if (cle in LIBELLES_CHAMPS) return LIBELLES_CHAMPS[cle];
  const espace = cle.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return espace.charAt(0).toUpperCase() + espace.slice(1);
}

function estDateIso(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valeur) && !isNaN(new Date(valeur).getTime());
}

function formaterChamp(
  cle: string,
  valeur: unknown,
  referentiels: Referentiels
): { libelle: string; valeur: string } | null {
  if (cle === 'id' || valeur === null || valeur === undefined || valeur === '') return null;

  const libelle = libelleChamp(cle);

  const categorie = RESOLVEURS_ID[cle];
  if (categorie && typeof valeur === 'string') {
    return { libelle, valeur: referentiels[categorie][valeur] ?? valeur };
  }
  if (cle === 'type' && typeof valeur === 'string') {
    return { libelle, valeur: LIBELLES_TYPES_ELEMENT[valeur] ?? valeur };
  }
  if (cle === 'montant' && typeof valeur === 'number') {
    return { libelle, valeur: `${valeur.toLocaleString('fr-FR')} F CFA` };
  }
  if (typeof valeur === 'number' && /^(jours|nbJours|heures)/i.test(cle)) {
    const unite = /^heures/i.test(cle) ? 'heure' : 'jour';
    return { libelle, valeur: `${valeur} ${unite}${valeur > 1 ? 's' : ''}` };
  }
  if (typeof valeur === 'boolean') {
    return { libelle, valeur: valeur ? 'Oui' : 'Non' };
  }
  if (estDateIso(valeur)) {
    if (cle === 'periode' || cle === 'moisPaie') {
      return { libelle, valeur: new Date(valeur).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) };
    }
    return { libelle, valeur: new Date(valeur).toLocaleDateString('fr-FR', { dateStyle: 'medium' }) };
  }
  return { libelle, valeur: String(valeur) };
}

function ChampsLisibles({ donnees, referentiels }: { donnees: unknown; referentiels: Referentiels }) {
  if (typeof donnees !== 'object' || donnees === null) {
    return <p className="text-xs text-slate-700">{String(donnees)}</p>;
  }

  const champs = Object.entries(donnees as Record<string, unknown>)
    .map(([cle, valeur]) => formaterChamp(cle, valeur, referentiels))
    .filter((c): c is { libelle: string; valeur: string } => c !== null);

  if (champs.length === 0) {
    return <p className="text-xs text-slate-400">Aucune information supplémentaire</p>;
  }

  return (
    <dl className="space-y-1 rounded-md bg-slate-50 p-2">
      {champs.map(({ libelle, valeur }) => (
        <div key={libelle} className="flex items-baseline justify-between gap-3 text-xs">
          <dt className="text-slate-500">{libelle}</dt>
          <dd className="text-right font-medium text-slate-700">{valeur}</dd>
        </div>
      ))}
    </dl>
  );
}

// La cible d'une action : si l'entité journalisée est un employé, un utilisateur ou un élément
// d'organisation, on affiche directement son nom. Sinon (contrat, congé, pointage...), on se rabat
// sur l'employeId présent dans le corps enregistré — l'info la plus utile pour un RH, à défaut de
// charger un référentiel dédié pour chaque module. En dernier recours, l'identifiant brut.
function resoudreCible(entree: EntreeAudit, referentiels: Referentiels): string {
  if (entree.module === 'utilisateurs' && entree.entiteId) {
    return referentiels.utilisateurs[entree.entiteId] ?? entree.entiteId;
  }
  if (entree.module === 'employes' && entree.entiteId) {
    return referentiels.employes[entree.entiteId] ?? entree.entiteId;
  }
  if (entree.module === 'postes' && entree.entiteId) {
    return (
      referentiels.filiales[entree.entiteId] ??
      referentiels.departements[entree.entiteId] ??
      referentiels.services[entree.entiteId] ??
      referentiels.fonctions[entree.entiteId] ??
      entree.entiteId
    );
  }

  const corps = (entree.valeurApres ?? entree.valeurAvant) as Record<string, unknown> | null;
  const employeId = corps && typeof corps.employeId === 'string' ? corps.employeId : null;
  if (employeId) {
    return referentiels.employes[employeId] ?? employeId;
  }

  return entree.entiteId ?? '—';
}

export function Audit() {
  const { jeton, role } = useAuth();

  const [entrees, setEntrees] = useState<EntreeAudit[]>([]);
  const [total, setTotal] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [page, setPage] = useState(1);
  const [filtreModule, setFiltreModule] = useState('');
  const [filtreAction, setFiltreAction] = useState('');
  const [recherche, setRecherche] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [entreeSelectionnee, setEntreeSelectionnee] = useState<EntreeAudit | null>(null);
  const [referentiels, setReferentiels] = useState<Referentiels>(REFERENTIELS_VIDES);

  // Chargés une fois pour traduire les identifiants (employeId, filialeId, ...) du détail
  // d'action en noms lisibles — best-effort : à défaut, l'identifiant brut reste affiché.
  useEffect(() => {
    if (!jeton || role !== 'super_admin') return;
    Promise.all([
      api.listerEmployes(jeton),
      api.listerFiliales(jeton),
      api.listerDepartements(jeton),
      api.listerServices(jeton),
      api.listerFonctions(jeton),
      api.listerUtilisateurs(jeton),
    ])
      .then(([employes, filiales, departements, services, fonctions, utilisateurs]) => {
        setReferentiels({
          employes: Object.fromEntries(employes.map((e) => [e.id, `${e.nom} ${e.prenoms}`])),
          filiales: Object.fromEntries(filiales.map((f) => [f.id, f.nom])),
          departements: Object.fromEntries(departements.map((d) => [d.id, d.nom])),
          services: Object.fromEntries(services.map((s) => [s.id, s.nom])),
          fonctions: Object.fromEntries(fonctions.map((f) => [f.id, f.intitule])),
          utilisateurs: Object.fromEntries(
            utilisateurs.map((u) => [u.id, u.employeNom ? `${u.employeNom} ${u.employePrenoms}` : u.email])
          ),
        });
      })
      .catch(() => {});
  }, [jeton, role]);

  useEffect(() => {
    if (!jeton || role !== 'super_admin') return;
    setChargement(true);
    const identifiant = setTimeout(() => {
      api
        .listerJournalAudit(jeton, {
          page,
          parPage: PAR_PAGE,
          module: filtreModule || undefined,
          action: filtreAction || undefined,
          recherche: recherche.trim() || undefined,
          dateDebut: dateDebut || undefined,
          dateFin: dateFin || undefined,
        })
        .then((r) => {
          setEntrees(r.entrees);
          setTotal(r.total);
        })
        .catch((e) => setErreur(e instanceof ErreurApi ? e.message : 'Erreur de chargement'))
        .finally(() => setChargement(false));
    }, 250);
    return () => clearTimeout(identifiant);
  }, [jeton, role, page, filtreModule, filtreAction, recherche, dateDebut, dateFin]);

  useEffect(() => setPage(1), [filtreModule, filtreAction, recherche, dateDebut, dateFin]);

  if (role !== null && role !== 'super_admin') {
    return <AccesRestreint />;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAR_PAGE));

  return (
    <MiseEnPage>
      <PageHeader titre="Journal d'audit" sousTitre={`${total} action(s) enregistrée(s)`} />

      {erreur && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Rechercher un email, un identifiant…" />
        </div>
        <FiltreSelect
          valeur={filtreModule}
          onChange={setFiltreModule}
          toutLibelle="Tous les modules"
          options={MODULES.map((m) => ({ valeur: m, libelle: libelleModule(m) }))}
        />
        <FiltreSelect
          valeur={filtreAction}
          onChange={setFiltreAction}
          toutLibelle="Toutes les actions"
          options={ACTIONS.map((a) => ({ valeur: a, libelle: LIBELLES_ACTION[a] }))}
        />
        <label className="flex items-center gap-1.5 text-sm text-slate-500">
          Du
          <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={CHAMP} />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-500">
          au
          <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={CHAMP} />
        </label>
      </div>

      <Table
        chargement={chargement}
        vide={entrees.length === 0}
        etatVide={
          <EtatVide
            icone={<IconeAudit />}
            titre="Aucune action enregistrée"
            message={
              filtreModule || filtreAction || recherche || dateDebut || dateFin
                ? 'Aucune action ne correspond à votre recherche ou vos filtres.'
                : 'Le journal se remplit au fil des actions effectuées dans le SIRH.'
            }
          />
        }
        pied={<Pagination page={page} totalPages={totalPages} onChange={setPage} totalItems={total} parPage={PAR_PAGE} />}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="whitespace-nowrap px-3 py-2">Quand</th>
              <th className="px-3 py-2">Qui</th>
              <th className="px-3 py-2">Module</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Cible</th>
              <th className="px-3 py-2" title="Appareil/réseau depuis lequel l'action a été faite — utile en cas d'enquête de sécurité">
                Adresse IP
              </th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entrees.map((e) => (
              <tr key={e.id} className="transition-colors duration-200 hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formaterHorodatage(e.createdAt)}</td>
                <td className="px-3 py-2 text-slate-700">
                  {e.utilisateurId ? referentiels.utilisateurs[e.utilisateurId] ?? e.utilisateurEmail ?? '—' : '—'}
                </td>
                <td className="px-3 py-2 text-slate-700">{libelleModule(e.module)}</td>
                <td className="px-3 py-2">
                  <Badge couleur={COULEURS_ACTION[e.action] ?? 'slate'}>{LIBELLES_ACTION[e.action] ?? e.action}</Badge>
                </td>
                <td className="px-3 py-2 text-slate-700">{resoudreCible(e, referentiels)}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-500">{e.adresseIp ?? '—'}</td>
                <td className="px-3 py-2 text-right">
                  {(e.valeurApres !== null || e.valeurAvant !== null) && (
                    <button
                      onClick={() => setEntreeSelectionnee(e)}
                      className="font-medium text-primary-700 transition-colors duration-200 hover:underline"
                    >
                      Détail
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Table>

      {entreeSelectionnee && (
        <Modale titre="Détail de l'action" onFermer={() => setEntreeSelectionnee(null)}>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Cible</p>
              <p className="text-sm text-slate-700">{resoudreCible(entreeSelectionnee, referentiels)}</p>
              {entreeSelectionnee.entiteId && (
                <p className="font-mono text-xs text-slate-400">{entreeSelectionnee.entiteId}</p>
              )}
            </div>
            {entreeSelectionnee.valeurAvant !== null && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Avant</p>
                <ChampsLisibles donnees={entreeSelectionnee.valeurAvant} referentiels={referentiels} />
              </div>
            )}
            {entreeSelectionnee.valeurApres !== null && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Après</p>
                <ChampsLisibles donnees={entreeSelectionnee.valeurApres} referentiels={referentiels} />
              </div>
            )}
          </div>
        </Modale>
      )}
    </MiseEnPage>
  );
}
