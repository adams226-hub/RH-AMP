import { useEffect, useState } from 'react';
import { ErreurApi, api } from '../api/client';
import { AccesRestreint } from '../components/AccesRestreint';
import { Badge, CouleurBadge } from '../components/Badge';
import { EtatVide } from '../components/EtatVide';
import { IconeAudit } from '../components/icones';
import { FiltreSelect } from '../components/FiltreSelect';
import { MiseEnPage } from '../components/MiseEnPage';
import { Modale } from '../components/Modale';
import { Pagination } from '../components/Pagination';
import { useAuth } from '../context/AuthContext';
import { EntreeAudit } from '../types/audit';

const PAR_PAGE = 25;

const MODULES = ['employes', 'contrats', 'conges', 'pointage', 'paie', 'archivage', 'postes', 'auth', 'audit'];
const ACTIONS = ['creation', 'modification', 'suppression', 'connexion', 'connexion_echouee'];

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

function formaterHorodatage(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
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

export function Audit() {
  const { jeton, role } = useAuth();

  const [entrees, setEntrees] = useState<EntreeAudit[]>([]);
  const [total, setTotal] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [page, setPage] = useState(1);
  const [filtreModule, setFiltreModule] = useState('');
  const [filtreAction, setFiltreAction] = useState('');
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
    api
      .listerJournalAudit(jeton, { page, parPage: PAR_PAGE, module: filtreModule || undefined, action: filtreAction || undefined })
      .then((r) => {
        setEntrees(r.entrees);
        setTotal(r.total);
      })
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : 'Erreur de chargement'))
      .finally(() => setChargement(false));
  }, [jeton, role, page, filtreModule, filtreAction]);

  useEffect(() => setPage(1), [filtreModule, filtreAction]);

  if (role !== null && role !== 'super_admin') {
    return <AccesRestreint />;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAR_PAGE));

  return (
    <MiseEnPage>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Journal d'audit</h2>
      <p className="mb-6 text-sm text-slate-500">{total} action(s) enregistrée(s)</p>

      {erreur && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FiltreSelect
          valeur={filtreModule}
          onChange={setFiltreModule}
          toutLibelle="Tous les modules"
          options={MODULES.map((m) => ({ valeur: m, libelle: m }))}
        />
        <FiltreSelect
          valeur={filtreAction}
          onChange={setFiltreAction}
          toutLibelle="Toutes les actions"
          options={ACTIONS.map((a) => ({ valeur: a, libelle: LIBELLES_ACTION[a] }))}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {chargement ? (
          <div className="space-y-3 p-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : entrees.length > 0 ? (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Quand</th>
                  <th className="px-4 py-3">Qui</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Adresse IP</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entrees.map((e) => (
                  <tr key={e.id} className="transition-colors duration-200 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{formaterHorodatage(e.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-700">{e.utilisateurEmail ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{e.module}</td>
                    <td className="px-4 py-3">
                      <Badge couleur={COULEURS_ACTION[e.action] ?? 'slate'}>{LIBELLES_ACTION[e.action] ?? e.action}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.adresseIp ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
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
            <Pagination page={page} totalPages={totalPages} onChange={setPage} totalItems={total} parPage={PAR_PAGE} />
          </>
        ) : (
          <EtatVide icone={<IconeAudit />} titre="Aucune action enregistrée" message="Le journal se remplit au fil des actions effectuées dans le SIRH." />
        )}
      </div>

      {entreeSelectionnee && (
        <Modale titre="Détail de l'action" onFermer={() => setEntreeSelectionnee(null)}>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Entité</p>
              <p className="font-mono text-xs text-slate-700">{entreeSelectionnee.entiteId ?? '—'}</p>
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
