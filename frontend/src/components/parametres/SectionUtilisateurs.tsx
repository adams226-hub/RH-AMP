import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ErreurApi, api } from '../../api/client';
import { Badge, CouleurBadge } from '../Badge';
import { ChampRecherche } from '../ChampRecherche';
import { EnTeteTriable } from '../EnTeteTriable';
import { EtatVide } from '../EtatVide';
import { FiltreSelect } from '../FiltreSelect';
import { IconeEmployes } from '../icones';
import { Modale } from '../Modale';
import { SelecteurEmploye } from '../SelecteurEmploye';
import { useTri } from '../../hooks/useTri';
import { CodeRole, useAuth } from '../../context/AuthContext';
import { Chantier } from '../../types/pointage';
import { Filiale } from '../../types/postes';
import { Utilisateur } from '../../types/utilisateurs';
import { SelecteurMulti } from '../dashboard/SelecteurMulti';

const CHAMP =
  'rounded-md border border-slate-300 px-2.5 py-1.5 text-sm transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';
const BOUTON =
  'rounded-md bg-primary-700 px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-800 hover:shadow-md disabled:pointer-events-none disabled:opacity-60';

// Liste à cocher toujours visible (pas de menu déroulant en `position: absolute`) — utilisée dans
// la modale Périmètre, dont le conteneur défilant (Modale.tsx, `overflow-y-auto`) rogne tout menu
// positionné en absolu qui tenterait de flotter par-dessus (cf. bug remonté sur SelecteurMulti).
function ListeCoches({
  options,
  valeurs,
  onChange,
}: {
  options: { valeur: string; libelle: string }[];
  valeurs: string[];
  onChange: (valeurs: string[]) => void;
}) {
  function basculer(valeur: string) {
    onChange(valeurs.includes(valeur) ? valeurs.filter((v) => v !== valeur) : [...valeurs, valeur]);
  }

  if (options.length === 0) {
    return <p className="text-xs text-slate-400">Aucune option disponible.</p>;
  }

  return (
    <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-md border border-slate-200 p-2">
      {options.map((o) => (
        <label
          key={o.valeur}
          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-200 hover:bg-slate-50"
        >
          <input
            type="checkbox"
            checked={valeurs.includes(o.valeur)}
            onChange={() => basculer(o.valeur)}
            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          {o.libelle}
        </label>
      ))}
    </div>
  );
}

const LIBELLES_ROLE: Record<CodeRole, string> = {
  super_admin: 'Super Admin',
  drh_holding: 'DRH Holding',
  rh_filiale: 'RH Filiale',
  chef_service: 'Chef de service',
  employe: 'Employé',
  responsable_rh_chantier: 'Responsable RH Chantier',
};

const COULEURS_ROLE: Record<CodeRole, CouleurBadge> = {
  super_admin: 'erreur',
  drh_holding: 'primary',
  rh_filiale: 'accent',
  chef_service: 'alerte',
  employe: 'slate',
  responsable_rh_chantier: 'accent',
};

const LIBELLES_STATUT: Record<Utilisateur['statut'], string> = {
  actif: 'Actif',
  suspendu: 'Suspendu',
  supprime: 'Supprimé',
};

const COULEURS_STATUT: Record<Utilisateur['statut'], CouleurBadge> = {
  actif: 'succes',
  suspendu: 'alerte',
  supprime: 'slate',
};

// Reflète exactement la règle backend (rolesAssignablesPar) — jamais un rôle "supérieur" au sien.
const ROLES_ASSIGNABLES: Record<CodeRole, CodeRole[]> = {
  super_admin: ['super_admin', 'drh_holding', 'rh_filiale', 'chef_service', 'employe', 'responsable_rh_chantier'],
  drh_holding: ['rh_filiale', 'chef_service', 'employe', 'responsable_rh_chantier'],
  rh_filiale: ['chef_service', 'employe', 'responsable_rh_chantier'],
  chef_service: [],
  employe: [],
  responsable_rh_chantier: [],
};

export function SectionUtilisateurs() {
  const { jeton, role: monRole } = useAuth();
  const rolesAssignables = monRole ? ROLES_ASSIGNABLES[monRole] : [];

  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [filiales, setFiliales] = useState<Filiale[]>([]);
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  const [recherche, setRecherche] = useState('');
  const [filtreRole, setFiltreRole] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');

  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CodeRole | ''>('');
  const [employeId, setEmployeId] = useState('');
  const [filialeIds, setFilialeIds] = useState<string[]>([]);
  const [chantierIds, setChantierIds] = useState<string[]>([]);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const [motDePasseAffiche, setMotDePasseAffiche] = useState<{ email: string; motDePasse: string } | null>(null);
  const [actionEnCoursId, setActionEnCoursId] = useState<string | null>(null);

  const [perimetreEnEdition, setPerimetreEnEdition] = useState<Utilisateur | null>(null);
  const [filialeIdsEdition, setFilialeIdsEdition] = useState<string[]>([]);
  const [chantierIdsEdition, setChantierIdsEdition] = useState<string[]>([]);
  const [perimetreEnCours, setPerimetreEnCours] = useState(false);

  function rafraichir() {
    if (!jeton) return;
    setChargement(true);
    api
      .listerUtilisateurs(jeton)
      .then(setUtilisateurs)
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : 'Erreur de chargement'))
      .finally(() => setChargement(false));
  }

  useEffect(rafraichir, [jeton]);

  useEffect(() => {
    if (!jeton) return;
    api.listerFiliales(jeton).then(setFiliales);
    api.listerChantiers(jeton).then(setChantiers);
  }, [jeton]);

  const filtres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return utilisateurs.filter((u) => {
      if (filtreRole && u.role !== filtreRole) return false;
      if (filtreStatut && u.statut !== filtreStatut) return false;
      if (terme) {
        const cible = `${u.email} ${u.employeNom ?? ''} ${u.employePrenoms ?? ''}`.toLowerCase();
        if (!cible.includes(terme)) return false;
      }
      return true;
    });
  }, [utilisateurs, recherche, filtreRole, filtreStatut]);

  const { trie, cle, sens, trierPar } = useTri<Utilisateur>(filtres, 'email');

  async function creer(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !email || !role) return;

    setEnvoiEnCours(true);
    setErreur(null);

    try {
      const { utilisateur, motDePasseTemporaire } = await api.creerUtilisateur(jeton, {
        email,
        role,
        employeId: employeId || undefined,
        filialeIds: role === 'rh_filiale' ? filialeIds : undefined,
        chantierIds: role === 'responsable_rh_chantier' ? chantierIds : undefined,
      });
      setMotDePasseAffiche({ email: utilisateur.email, motDePasse: motDePasseTemporaire });
      setEmail('');
      setRole('');
      setEmployeId('');
      setFilialeIds([]);
      setChantierIds([]);
      setFormulaireOuvert(false);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la création');
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function changerRole(id: string, nouveauRole: CodeRole) {
    if (!jeton) return;
    setActionEnCoursId(id);
    try {
      await api.changerRoleUtilisateur(jeton, id, nouveauRole);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors du changement de rôle');
    } finally {
      setActionEnCoursId(null);
    }
  }

  async function changerStatut(id: string, statut: Utilisateur['statut']) {
    if (!jeton) return;
    setActionEnCoursId(id);
    try {
      await api.changerStatutUtilisateur(jeton, id, statut);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors du changement de statut');
    } finally {
      setActionEnCoursId(null);
    }
  }

  function ouvrirPerimetre(u: Utilisateur) {
    setPerimetreEnEdition(u);
    setFilialeIdsEdition(u.filialeIds);
    setChantierIdsEdition(u.chantierIds);
  }

  async function enregistrerPerimetre(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !perimetreEnEdition) return;

    setPerimetreEnCours(true);
    try {
      await api.majPerimetreUtilisateur(jeton, perimetreEnEdition.id, {
        filialeIds: perimetreEnEdition.role === 'rh_filiale' ? filialeIdsEdition : undefined,
        chantierIds: perimetreEnEdition.role === 'responsable_rh_chantier' ? chantierIdsEdition : undefined,
      });
      setPerimetreEnEdition(null);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la mise à jour du périmètre');
    } finally {
      setPerimetreEnCours(false);
    }
  }

  async function reinitialiser(u: Utilisateur) {
    if (!jeton) return;
    setActionEnCoursId(u.id);
    try {
      const { motDePasseTemporaire } = await api.reinitialiserMotDePasse(jeton, u.id);
      setMotDePasseAffiche({ email: u.email, motDePasse: motDePasseTemporaire });
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la réinitialisation');
    } finally {
      setActionEnCoursId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{utilisateurs.length} compte(s)</p>
        {rolesAssignables.length > 0 && (
          <button onClick={() => setFormulaireOuvert((v) => !v)} className={BOUTON}>
            {formulaireOuvert ? 'Fermer' : '+ Nouveau compte'}
          </button>
        )}
      </div>

      {erreur && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      {formulaireOuvert && (
        <form onSubmit={creer} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Nouveau compte</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className={CHAMP}
            />
            <select value={role} onChange={(e) => setRole(e.target.value as CodeRole)} required className={CHAMP}>
              <option value="">— Rôle —</option>
              {rolesAssignables.map((r) => (
                <option key={r} value={r}>
                  {LIBELLES_ROLE[r]}
                </option>
              ))}
            </select>
            <div className="col-span-2 sm:col-span-1">
              <SelecteurEmploye valeur={employeId} onChange={setEmployeId} />
            </div>
          </div>

          {role === 'rh_filiale' && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium text-slate-600">Filiale(s) gérée(s)</p>
              <SelecteurMulti
                libelle="Filiales"
                options={filiales.map((f) => ({ valeur: f.id, libelle: f.nom }))}
                valeurs={filialeIds}
                onChange={setFilialeIds}
              />
            </div>
          )}

          {role === 'responsable_rh_chantier' && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium text-slate-600">Chantier(s) géré(s)</p>
              <SelecteurMulti
                libelle="Chantiers"
                options={chantiers.map((c) => ({ valeur: c.id, libelle: c.nom }))}
                valeurs={chantierIds}
                onChange={setChantierIds}
              />
            </div>
          )}

          <button disabled={envoiEnCours} className={`${BOUTON} mt-4`}>
            {envoiEnCours ? 'Création...' : 'Créer le compte'}
          </button>
        </form>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <ChampRecherche valeur={recherche} onChange={setRecherche} placeholder="Rechercher un email, un nom…" />
        </div>
        <FiltreSelect
          valeur={filtreRole}
          onChange={setFiltreRole}
          toutLibelle="Tous les rôles"
          options={Object.entries(LIBELLES_ROLE).map(([valeur, libelle]) => ({ valeur, libelle }))}
        />
        <FiltreSelect
          valeur={filtreStatut}
          onChange={setFiltreStatut}
          toutLibelle="Tous les statuts"
          options={Object.entries(LIBELLES_STATUT).map(([valeur, libelle]) => ({ valeur, libelle }))}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {chargement ? (
          <div className="space-y-3 p-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : trie.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <EnTeteTriable label="Email" cleColonne="email" cleActive={cle} sens={sens} onTrier={trierPar} />
                <th className="px-4 py-3">Employé lié</th>
                <EnTeteTriable label="Rôle" cleColonne="role" cleActive={cle} sens={sens} onTrier={trierPar} />
                <EnTeteTriable label="Statut" cleColonne="statut" cleActive={cle} sens={sens} onTrier={trierPar} />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trie.map((u) => {
                const peutModifier = rolesAssignables.includes(u.role) && u.id !== undefined;
                return (
                  <tr key={u.id} className="transition-colors duration-200 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{u.email}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {u.employeNom ? `${u.employeNom} ${u.employePrenoms}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge couleur={COULEURS_ROLE[u.role]}>{LIBELLES_ROLE[u.role]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge couleur={COULEURS_STATUT[u.statut]}>{LIBELLES_STATUT[u.statut]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {peutModifier && (
                        <div className="flex justify-end gap-3">
                          {(u.role === 'rh_filiale' || u.role === 'responsable_rh_chantier') && (
                            <button
                              onClick={() => ouvrirPerimetre(u)}
                              className="font-medium text-primary-700 transition-colors duration-200 hover:underline"
                            >
                              Périmètre
                            </button>
                          )}
                          <button
                            disabled={actionEnCoursId === u.id}
                            onClick={() => reinitialiser(u)}
                            className="font-medium text-primary-700 transition-colors duration-200 hover:underline disabled:opacity-50"
                          >
                            Réinitialiser mdp
                          </button>
                          {u.statut === 'actif' ? (
                            <button
                              disabled={actionEnCoursId === u.id}
                              onClick={() => changerStatut(u.id, 'suspendu')}
                              className="font-medium text-alerte-700 transition-colors duration-200 hover:underline disabled:opacity-50"
                            >
                              Suspendre
                            </button>
                          ) : (
                            u.statut === 'suspendu' && (
                              <button
                                disabled={actionEnCoursId === u.id}
                                onClick={() => changerStatut(u.id, 'actif')}
                                className="font-medium text-succes-700 transition-colors duration-200 hover:underline disabled:opacity-50"
                              >
                                Réactiver
                              </button>
                            )
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EtatVide
            icone={<IconeEmployes />}
            titre={utilisateurs.length === 0 ? 'Aucun compte' : 'Aucun résultat'}
            message={
              utilisateurs.length === 0
                ? "Créez le premier compte avec « + Nouveau compte »."
                : 'Aucun compte ne correspond à votre recherche ou vos filtres.'
            }
          />
        )}
      </div>

      {perimetreEnEdition && (
        <Modale titre={`Périmètre — ${perimetreEnEdition.email}`} onFermer={() => setPerimetreEnEdition(null)}>
          <form onSubmit={enregistrerPerimetre}>
            {perimetreEnEdition.role === 'rh_filiale' && (
              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">Filiale(s) gérée(s)</p>
                <ListeCoches
                  options={filiales.map((f) => ({ valeur: f.id, libelle: f.nom }))}
                  valeurs={filialeIdsEdition}
                  onChange={setFilialeIdsEdition}
                />
              </div>
            )}
            {perimetreEnEdition.role === 'responsable_rh_chantier' && (
              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">Chantier(s) géré(s)</p>
                <ListeCoches
                  options={chantiers.map((c) => ({ valeur: c.id, libelle: c.nom }))}
                  valeurs={chantierIdsEdition}
                  onChange={setChantierIdsEdition}
                />
              </div>
            )}
            <button disabled={perimetreEnCours} className={`${BOUTON} mt-4`}>
              {perimetreEnCours ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        </Modale>
      )}

      {motDePasseAffiche && (
        <Modale titre="Mot de passe temporaire" onFermer={() => setMotDePasseAffiche(null)}>
          <p className="mb-3 text-sm text-slate-600">
            Compte <strong>{motDePasseAffiche.email}</strong>. Communiquez ce mot de passe de façon sécurisée — il ne sera
            plus jamais réaffiché.
          </p>
          <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2">
            <code className="flex-1 font-mono text-sm text-slate-900">{motDePasseAffiche.motDePasse}</code>
            <button
              onClick={() => navigator.clipboard.writeText(motDePasseAffiche.motDePasse)}
              className="text-xs font-medium text-primary-700 hover:underline"
            >
              Copier
            </button>
          </div>
        </Modale>
      )}
    </div>
  );
}
