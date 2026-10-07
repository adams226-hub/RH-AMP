import { FormEvent, useState } from 'react';
import { ErreurApi, api } from '../api/client';
import { EtatVide } from '../components/EtatVide';
import { IconeAttestations } from '../components/icones';
import { MiseEnPage } from '../components/MiseEnPage';
import { SelecteurEmploye } from '../components/SelecteurEmploye';
import { useAuth } from '../context/AuthContext';
import {
  DonneesAttestation,
  DonneesAttestationStage,
  DonneesAttestationTravail,
  DonneesCertificatTravail,
  PosteOccupe,
  TypeAttestation,
} from '../types/attestations';

const CHAMP =
  'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';
const LABEL = 'mb-1 block text-xs font-medium text-slate-600';
const BOUTON =
  'rounded-md bg-primary-700 px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-800 hover:shadow-md disabled:pointer-events-none disabled:opacity-60';
const ROLES_ACCES = ['super_admin', 'drh_holding', 'rh_filiale'];

const LIBELLES_TYPE: Record<TypeAttestation, string> = {
  att_trav: 'Attestation de travail',
  cert_trav: 'Certificat de travail (fin de contrat)',
  att_stage: 'Attestation de stage',
};

function Champ({
  label,
  valeur,
  onChange,
  type = 'text',
}: {
  label: string;
  valeur: string;
  onChange: (v: string) => void;
  type?: 'text' | 'date' | 'textarea';
}) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      {type === 'textarea' ? (
        <textarea value={valeur} onChange={(e) => onChange(e.target.value)} rows={3} className={CHAMP} />
      ) : (
        <input type={type} value={valeur} onChange={(e) => onChange(e.target.value)} className={CHAMP} />
      )}
    </div>
  );
}

export function Attestations() {
  const { jeton, role } = useAuth();
  const aAcces = role !== null && ROLES_ACCES.includes(role);

  const [employeId, setEmployeId] = useState('');
  const [type, setType] = useState<TypeAttestation>('att_trav');
  const [donnees, setDonnees] = useState<DonneesAttestation | null>(null);
  const [chargementEnCours, setChargementEnCours] = useState(false);
  const [generationEnCours, setGenerationEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [derniereGeneree, setDerniereGeneree] = useState<{ id: string; numeroComplet: string } | null>(null);

  function champ(cle: string, valeur: string) {
    setDonnees((d) => (d ? ({ ...d, [cle]: valeur } as DonneesAttestation) : d));
  }

  async function chargerApercu() {
    if (!jeton || !employeId) return;
    setChargementEnCours(true);
    setErreur(null);
    setDonnees(null);
    setDerniereGeneree(null);
    try {
      const resultat = await api.apercuAttestation(jeton, employeId, type);
      setDonnees(resultat);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors du chargement de l'aperçu");
    } finally {
      setChargementEnCours(false);
    }
  }

  async function generer(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !employeId || !donnees) return;
    setGenerationEnCours(true);
    setErreur(null);
    try {
      const resultat = await api.genererAttestation(jeton, { employeId, type, donnees });
      setDerniereGeneree({ id: resultat.id, numeroComplet: resultat.numeroComplet });
      setDonnees(null);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la génération');
    } finally {
      setGenerationEnCours(false);
    }
  }

  async function telecharger(id: string) {
    if (!jeton) return;
    const blob = await api.obtenirAttestationPdf(jeton, id);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function modifierPoste(index: number, champPoste: keyof PosteOccupe, valeur: string) {
    setDonnees((d) => {
      if (!d || !('postesOccupes' in d)) return d;
      const postes = [...d.postesOccupes];
      postes[index] = { ...postes[index], [champPoste]: champPoste === 'dateFin' ? valeur || null : valeur };
      return { ...d, postesOccupes: postes };
    });
  }

  function ajouterPoste() {
    setDonnees((d) => {
      if (!d || !('postesOccupes' in d)) return d;
      return { ...d, postesOccupes: [...d.postesOccupes, { poste: '', dateDebut: '', dateFin: null }] };
    });
  }

  function retirerPoste(index: number) {
    setDonnees((d) => {
      if (!d || !('postesOccupes' in d)) return d;
      return { ...d, postesOccupes: d.postesOccupes.filter((_, i) => i !== index) };
    });
  }

  if (!aAcces) {
    return (
      <MiseEnPage>
        <EtatVide
          icone={<IconeAttestations />}
          titre="Aucun accès"
          message="Votre rôle ne donne pas accès au module Attestations."
        />
      </MiseEnPage>
    );
  }

  return (
    <MiseEnPage>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Attestations</h2>
      <p className="mb-6 text-sm text-slate-500">
        Attestation de travail, certificat de travail (fin de contrat) et attestation de stage — numérotées
        officiellement par filiale.
      </p>

      {erreur && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className={LABEL}>Employé / Stagiaire</label>
            <SelecteurEmploye valeur={employeId} onChange={setEmployeId} />
          </div>
          <div>
            <label className={LABEL}>Type de document</label>
            <select value={type} onChange={(e) => setType(e.target.value as TypeAttestation)} className={CHAMP}>
              {(Object.keys(LIBELLES_TYPE) as TypeAttestation[]).map((t) => (
                <option key={t} value={t}>
                  {LIBELLES_TYPE[t]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" disabled={!employeId || chargementEnCours} onClick={chargerApercu} className={BOUTON}>
          {chargementEnCours ? 'Chargement...' : 'Aperçu'}
        </button>
      </div>

      {donnees && (
        <form onSubmit={generer} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">
            {LIBELLES_TYPE[type]} — aperçu éditable avant génération
          </h3>

          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Champ label="Entreprise" valeur={donnees.entreprise} onChange={(v) => champ('entreprise', v)} />
            <Champ label="Nom du dirigeant" valeur={donnees.nomDirigeant} onChange={(v) => champ('nomDirigeant', v)} />
            <Champ
              label="Fonction du dirigeant"
              valeur={donnees.fonctionDirigeant}
              onChange={(v) => champ('fonctionDirigeant', v)}
            />
          </div>

          {type === 'att_trav' && (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(() => {
                const d = donnees as DonneesAttestationTravail;
                return (
                  <>
                    <Champ label="Nom et prénoms" valeur={d.nomPrenomsEmploye} onChange={(v) => champ('nomPrenomsEmploye', v)} />
                    <Champ label="Date de naissance" type="date" valeur={d.dateNaissance ?? ''} onChange={(v) => champ('dateNaissance', v)} />
                    <Champ label="Lieu de naissance" valeur={d.lieuNaissance ?? ''} onChange={(v) => champ('lieuNaissance', v)} />
                    <Champ label="Matricule" valeur={d.matricule} onChange={(v) => champ('matricule', v)} />
                    <Champ label="Date d'embauche" type="date" valeur={d.dateEmbauche} onChange={(v) => champ('dateEmbauche', v)} />
                    <Champ label="Poste" valeur={d.poste} onChange={(v) => champ('poste', v)} />
                  </>
                );
              })()}
            </div>
          )}

          {type === 'cert_trav' && (
            <>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {(() => {
                  const d = donnees as DonneesCertificatTravail;
                  return (
                    <>
                      <Champ label="Nom et prénoms" valeur={d.nomPrenomsEmploye} onChange={(v) => champ('nomPrenomsEmploye', v)} />
                      <Champ label="Date de naissance" type="date" valeur={d.dateNaissance ?? ''} onChange={(v) => champ('dateNaissance', v)} />
                      <Champ label="Lieu de naissance" valeur={d.lieuNaissance ?? ''} onChange={(v) => champ('lieuNaissance', v)} />
                      <Champ label="Matricule" valeur={d.matricule} onChange={(v) => champ('matricule', v)} />
                      <Champ label="Date d'embauche" type="date" valeur={d.dateEmbauche} onChange={(v) => champ('dateEmbauche', v)} />
                      <Champ label="Date de sortie" type="date" valeur={d.dateSortie} onChange={(v) => champ('dateSortie', v)} />
                      <Champ label="Durée de service" valeur={d.dureeService} onChange={(v) => champ('dureeService', v)} />
                    </>
                  );
                })()}
              </div>
              <div className="mb-4">
                <label className={LABEL}>Postes occupés successivement</label>
                <p className="mb-2 text-xs text-slate-400">
                  Un seul poste : affiché en ligne ("en qualité de X"). Plusieurs postes : affichés en liste, comme
                  l'exige la loi pour un certificat de travail.
                </p>
                <div className="space-y-2">
                  {(donnees as DonneesCertificatTravail).postesOccupes.map((p, i) => (
                    <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
                      <input
                        placeholder="Poste"
                        value={p.poste}
                        onChange={(e) => modifierPoste(i, 'poste', e.target.value)}
                        className={CHAMP}
                      />
                      <input type="date" value={p.dateDebut} onChange={(e) => modifierPoste(i, 'dateDebut', e.target.value)} className={CHAMP} />
                      <input
                        type="date"
                        value={p.dateFin ?? ''}
                        onChange={(e) => modifierPoste(i, 'dateFin', e.target.value)}
                        className={CHAMP}
                      />
                      <button type="button" onClick={() => retirerPoste(i)} className="text-xs font-medium text-red-600 hover:underline">
                        Retirer
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={ajouterPoste} className="text-xs font-medium text-primary-700 hover:underline">
                    + Ajouter un poste
                  </button>
                </div>
              </div>
            </>
          )}

          {type === 'att_stage' && (
            <>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {(() => {
                  const d = donnees as DonneesAttestationStage;
                  return (
                    <>
                      <Champ label="Nom et prénoms" valeur={d.nomPrenomsStagiaire} onChange={(v) => champ('nomPrenomsStagiaire', v)} />
                      <Champ label="Date de naissance" type="date" valeur={d.dateNaissance ?? ''} onChange={(v) => champ('dateNaissance', v)} />
                      <Champ label="Lieu de naissance" valeur={d.lieuNaissance ?? ''} onChange={(v) => champ('lieuNaissance', v)} />
                      <Champ label="Filière d'études" valeur={d.filiereEtudes} onChange={(v) => champ('filiereEtudes', v)} />
                      <Champ label="Établissement" valeur={d.etablissement} onChange={(v) => champ('etablissement', v)} />
                      <Champ label="Début du stage" type="date" valeur={d.dateDebutStage} onChange={(v) => champ('dateDebutStage', v)} />
                      <Champ label="Fin du stage" type="date" valeur={d.dateFinStage} onChange={(v) => champ('dateFinStage', v)} />
                      <Champ label="Durée du stage" valeur={d.dureeStage} onChange={(v) => champ('dureeStage', v)} />
                      <Champ label="Service" valeur={d.service} onChange={(v) => champ('service', v)} />
                      <Champ label="Superviseur" valeur={d.superviseur} onChange={(v) => champ('superviseur', v)} />
                    </>
                  );
                })()}
              </div>
              <div className="mb-4 space-y-3">
                <Champ
                  label="Description des missions"
                  type="textarea"
                  valeur={(donnees as DonneesAttestationStage).descriptionMissions}
                  onChange={(v) => champ('descriptionMissions', v)}
                />
                <Champ
                  label="Appréciation (optionnel — rester neutre)"
                  type="textarea"
                  valeur={(donnees as DonneesAttestationStage).appreciation}
                  onChange={(v) => champ('appreciation', v)}
                />
              </div>
            </>
          )}

          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Champ label="Fonction du signataire" valeur={donnees.fonctionSignataire} onChange={(v) => champ('fonctionSignataire', v)} />
            <Champ label="Date d'émission" type="date" valeur={donnees.dateEmission} onChange={(v) => champ('dateEmission', v)} />
          </div>

          <p className="mb-3 text-xs text-slate-400">
            Une fois généré, le document est numéroté officiellement et n'est plus modifiable.
          </p>
          <button disabled={generationEnCours} className={BOUTON}>
            {generationEnCours ? 'Génération...' : 'Générer et numéroter'}
          </button>
        </form>
      )}

      {derniereGeneree && (
        <div className="mb-6 rounded-md bg-succes-100 px-4 py-3 text-sm text-succes-700">
          Document généré — N° {derniereGeneree.numeroComplet}.{' '}
          <button onClick={() => telecharger(derniereGeneree.id)} className="font-medium underline">
            Télécharger le PDF
          </button>
        </div>
      )}
    </MiseEnPage>
  );
}
