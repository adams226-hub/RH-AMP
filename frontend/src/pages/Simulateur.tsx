import { FormEvent, useState } from 'react';
import { ErreurApi, api } from '../api/client';
import { AccesRestreint } from '../components/AccesRestreint';
import { IconeSimulateur } from '../components/icones';
import { MiseEnPage } from '../components/MiseEnPage';
import { SelecteurEmploye } from '../components/SelecteurEmploye';
import { useAuth } from '../context/AuthContext';
import { ResultatSimulationNetVersBrut } from '../types/paie';

const CHAMP =
  'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';
const LABEL = 'mb-1 block text-xs font-medium text-slate-600';
const BOUTON =
  'rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-800 hover:shadow-md disabled:pointer-events-none disabled:opacity-60';
const ROLES_ACCES = ['super_admin', 'drh_holding', 'rh_filiale'];

function formaterFCFA(montant: number) {
  return `${Math.round(montant).toLocaleString('fr-FR')} F CFA`;
}

export function Simulateur() {
  const { jeton, role } = useAuth();
  const peutAcceder = role !== null && ROLES_ACCES.includes(role);

  const [employeId, setEmployeId] = useState('');
  const [netCible, setNetCible] = useState('');
  const [categorie, setCategorie] = useState<'CADRE' | 'NON_CADRE'>('NON_CADRE');
  const [personnesACharge, setPersonnesACharge] = useState('0');
  const [ancienneteAnnees, setAncienneteAnnees] = useState('0');
  const [champVariable, setChampVariable] = useState<'salaireDeBase' | 'sursalaire'>('salaireDeBase');

  const [indemnitesOuvertes, setIndemnitesOuvertes] = useState(false);
  const [salaireDeBase, setSalaireDeBase] = useState('0');
  const [sursalaire, setSursalaire] = useState('0');
  const [indemniteLogement, setIndemniteLogement] = useState('0');
  const [indemniteTransport, setIndemniteTransport] = useState('0');
  const [indemniteSujetion, setIndemniteSujetion] = useState('0');
  const [indemniteAstreinte, setIndemniteAstreinte] = useState('0');
  const [indemniteFonction, setIndemniteFonction] = useState('0');
  const [panier, setPanier] = useState('0');
  const [autresIndemnites, setAutresIndemnites] = useState('0');

  const [resultat, setResultat] = useState<ResultatSimulationNetVersBrut | null>(null);
  const [calculEnCours, setCalculEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function calculer(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !netCible) return;

    setCalculEnCours(true);
    setErreur(null);
    setResultat(null);
    try {
      const reponse = await api.simulerNetVersBrut(jeton, {
        netCible: Number(netCible),
        categorie,
        personnesACharge: Number(personnesACharge),
        ancienneteAnnees: Number(ancienneteAnnees),
        salaireDeBase: Number(salaireDeBase),
        sursalaire: Number(sursalaire),
        indemniteLogement: Number(indemniteLogement),
        indemniteTransport: Number(indemniteTransport),
        indemniteSujetion: Number(indemniteSujetion),
        indemniteAstreinte: Number(indemniteAstreinte),
        indemniteFonction: Number(indemniteFonction),
        panier: Number(panier),
        autresIndemnites: Number(autresIndemnites),
        champVariable,
      });
      setResultat(reponse);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors du calcul');
    } finally {
      setCalculEnCours(false);
    }
  }

  if (role !== null && !peutAcceder) {
    return <AccesRestreint />;
  }

  return (
    <MiseEnPage>
      <div className="mb-1 flex items-center gap-2">
        <IconeSimulateur className="h-5 w-5 text-primary-700" />
        <h2 className="text-lg font-semibold text-slate-900">Simulateur Net → Brut</h2>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Retrouve le salaire de base (ou le sursalaire) nécessaire pour atteindre un net à payer souhaité — recrutement,
        négociation, vérification. Ne modifie rien tant que rien n'est enregistré ailleurs.
      </p>

      {erreur && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      <form onSubmit={calculer} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className={LABEL}>Net à payer souhaité</label>
            <input type="number" value={netCible} onChange={(e) => setNetCible(e.target.value)} required className={CHAMP} />
          </div>
          <div className="col-span-2">
            <label className={LABEL}>Employé (optionnel — pour repère)</label>
            <SelecteurEmploye valeur={employeId} onChange={setEmployeId} />
          </div>
          <div>
            <label className={LABEL}>Champ à faire varier</label>
            <select value={champVariable} onChange={(e) => setChampVariable(e.target.value as 'salaireDeBase' | 'sursalaire')} className={CHAMP}>
              <option value="salaireDeBase">Salaire de base</option>
              <option value="sursalaire">Sursalaire</option>
            </select>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className={LABEL}>Statut</label>
            <select value={categorie} onChange={(e) => setCategorie(e.target.value as 'CADRE' | 'NON_CADRE')} className={CHAMP}>
              <option value="NON_CADRE">Non-cadre</option>
              <option value="CADRE">Cadre</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Charges familiales</label>
            <input type="number" min="0" value={personnesACharge} onChange={(e) => setPersonnesACharge(e.target.value)} className={CHAMP} />
          </div>
          <div>
            <label className={LABEL}>Ancienneté (années)</label>
            <input type="number" min="0" value={ancienneteAnnees} onChange={(e) => setAncienneteAnnees(e.target.value)} className={CHAMP} />
          </div>
          {champVariable === 'sursalaire' && (
            <div>
              <label className={LABEL}>Salaire de base</label>
              <input type="number" value={salaireDeBase} onChange={(e) => setSalaireDeBase(e.target.value)} className={CHAMP} />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIndemnitesOuvertes((v) => !v)}
          className="mb-2 text-xs font-medium text-primary-700 hover:underline"
        >
          {indemnitesOuvertes ? '− Masquer' : '+ Indemnités fixes'} (optionnel — laissées à 0 si non applicable)
        </button>

        {indemnitesOuvertes && (
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {champVariable !== 'sursalaire' && (
              <div>
                <label className={LABEL}>Sursalaire</label>
                <input type="number" value={sursalaire} onChange={(e) => setSursalaire(e.target.value)} className={CHAMP} />
              </div>
            )}
            <div>
              <label className={LABEL}>Indemnité logement</label>
              <input type="number" value={indemniteLogement} onChange={(e) => setIndemniteLogement(e.target.value)} className={CHAMP} />
            </div>
            <div>
              <label className={LABEL}>Indemnité transport</label>
              <input type="number" value={indemniteTransport} onChange={(e) => setIndemniteTransport(e.target.value)} className={CHAMP} />
            </div>
            <div>
              <label className={LABEL}>Indemnité sujétion</label>
              <input type="number" value={indemniteSujetion} onChange={(e) => setIndemniteSujetion(e.target.value)} className={CHAMP} />
            </div>
            <div>
              <label className={LABEL}>Indemnité astreinte</label>
              <input type="number" value={indemniteAstreinte} onChange={(e) => setIndemniteAstreinte(e.target.value)} className={CHAMP} />
            </div>
            <div>
              <label className={LABEL}>Indemnité fonction</label>
              <input type="number" value={indemniteFonction} onChange={(e) => setIndemniteFonction(e.target.value)} className={CHAMP} />
            </div>
            <div>
              <label className={LABEL}>Prime de panier</label>
              <input type="number" value={panier} onChange={(e) => setPanier(e.target.value)} className={CHAMP} />
            </div>
            <div>
              <label className={LABEL}>Autres indemnités</label>
              <input type="number" value={autresIndemnites} onChange={(e) => setAutresIndemnites(e.target.value)} className={CHAMP} />
            </div>
          </div>
        )}

        <button disabled={calculEnCours} className={BOUTON}>
          {calculEnCours ? 'Calcul...' : 'Calculer'}
        </button>
      </form>

      {resultat && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {resultat.champVariable === 'salaireDeBase' ? 'Salaire de base nécessaire' : 'Sursalaire nécessaire'}
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-primary-700 [font-variant-numeric:tabular-nums]">
                {formaterFCFA(resultat.valeurTrouvee)}
              </p>
            </div>
            {!resultat.convergence && (
              <span className="rounded-full bg-alerte-100 px-3 py-1 text-xs font-medium text-alerte-700">
                Approximatif — écart {formaterFCFA(Math.abs(resultat.ecartFinal))}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <Ligne libelle="Rémunération totale (brut)" valeur={resultat.bulletin.brut} />
            <Ligne libelle="Retenue CNSS" valeur={resultat.bulletin.cnssSalariale} />
            <Ligne libelle="Abattement forfaitaire" valeur={resultat.bulletin.abattementForfaitaire} />
            <Ligne libelle="Salaire net imposable" valeur={resultat.bulletin.salaireNetImposable} />
            <Ligne libelle="Base imposable" valeur={resultat.bulletin.baseImposable} />
            <Ligne libelle="IUTS net" valeur={resultat.bulletin.iuts} />
            <Ligne libelle="Retenue 1%" valeur={resultat.bulletin.fsp} />
            {resultat.bulletin.primeAnciennete > 0 && (
              <Ligne libelle={`Prime d'ancienneté (${resultat.bulletin.ancienneteAnnees} ans)`} valeur={resultat.bulletin.primeAnciennete} />
            )}
            <Ligne libelle="Net à payer obtenu" valeur={resultat.bulletin.netAPayer} accent />
          </div>
        </div>
      )}
    </MiseEnPage>
  );
}

function Ligne({ libelle, valeur, accent }: { libelle: string; valeur: number; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{libelle}</p>
      <p className={`font-medium [font-variant-numeric:tabular-nums] ${accent ? 'text-succes-700' : 'text-slate-900'}`}>
        {formaterFCFA(valeur)}
      </p>
    </div>
  );
}
