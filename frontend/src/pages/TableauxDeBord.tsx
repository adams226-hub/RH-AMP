import { useEffect, useState } from 'react';
import { ErreurApi, api } from '../api/client';
import { BarreFiltresRH } from '../components/dashboard/BarreFiltresRH';
import { GraphiqueBarresCategoriel } from '../components/dashboard/GraphiqueBarresCategoriel';
import { GraphiqueBarresEmpilees } from '../components/dashboard/GraphiqueBarresEmpilees';
import { GraphiqueDonutSexe } from '../components/dashboard/GraphiqueDonutSexe';
import { GraphiqueMasseSalariale } from '../components/dashboard/GraphiqueMasseSalariale';
import { GraphiquePyramideAges } from '../components/dashboard/GraphiquePyramideAges';
import { SelecteurPeriode } from '../components/dashboard/SelecteurPeriode';
import { TableauSorties } from '../components/dashboard/TableauSorties';
import { IconeAlerte, IconeConges, IconeEmployes, IconePaie } from '../components/icones';
import { MiseEnPage } from '../components/MiseEnPage';
import { TuileStat } from '../components/TuileStat';
import { useAuth } from '../context/AuthContext';
import { Filiale } from '../types/postes';
import { CategorieProfessionnelle } from '../types/categoriesProfessionnelles';
import { FILTRES_VIDES, FiltresRHOverview, RHOverviewReponse } from '../types/rhOverview';
import { ContratsReponse, EffectifReponse, MasseSalarialeReponse, SortiesReponse, TurnoverReponse } from '../types/tableauDeBord';

function formaterFCFA(montant: number) {
  return `${Math.round(montant).toLocaleString('fr-FR')} F CFA`;
}

function moisCourant() {
  return new Date().toISOString().slice(0, 7);
}

function moisMoins(nb: number) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - nb);
  return d.toISOString().slice(0, 7);
}

function finDuMois(periodeYYYYMM: string) {
  const [annee, mois] = periodeYYYYMM.split('-').map(Number);
  const dernierJour = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  return `${periodeYYYYMM}-${String(dernierJour).padStart(2, '0')}`;
}

export function TableauxDeBord() {
  const { jeton } = useAuth();

  // --- Section opérationnelle (période sélectionnable) ---
  const [periodeDebut, setPeriodeDebut] = useState(moisMoins(5));
  const [periodeFin, setPeriodeFin] = useState(moisCourant());

  const [effectif, setEffectif] = useState<EffectifReponse | null>(null);
  const [contrats, setContrats] = useState<ContratsReponse | null>(null);
  const [conges, setConges] = useState<{ congesEnCours: number; soldeMoyenDisponible: number } | null>(null);
  const [sorties, setSorties] = useState<SortiesReponse | null>(null);
  const [masseSalariale, setMasseSalariale] = useState<MasseSalarialeReponse | null>(null);
  const [turnover, setTurnover] = useState<TurnoverReponse | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (!jeton) return;
    setChargement(true);
    const dateDebut = `${periodeDebut}-01`;
    const dateFin = finDuMois(periodeFin);

    Promise.all([
      api.obtenirEffectif(jeton),
      api.obtenirContratsDashboard(jeton),
      api.obtenirCongesDashboard(jeton),
      api.obtenirSorties(jeton, dateDebut, dateFin),
      api.obtenirMasseSalarialeParPeriode(jeton, periodeDebut, periodeFin),
      api.obtenirTurnover(jeton, dateDebut, dateFin),
    ])
      .then(([e, c, cg, s, ms, t]) => {
        setEffectif(e);
        setContrats(c);
        setConges(cg);
        setSorties(s);
        setMasseSalariale(ms);
        setTurnover(t);
      })
      .catch((err) => setErreur(err instanceof ErreurApi ? err.message : 'Erreur de chargement'))
      .finally(() => setChargement(false));
  }, [jeton, periodeDebut, periodeFin]);

  const totalEffectifActif = effectif?.parStatut.find((s) => s.statut === 'actif')?.total ?? 0;

  // --- Section RH détaillée (barre de filtres façon slicers Excel) ---
  const [filiales, setFiliales] = useState<Filiale[]>([]);
  const [categories, setCategories] = useState<CategorieProfessionnelle[]>([]);
  const [filtresRH, setFiltresRH] = useState<FiltresRHOverview>(FILTRES_VIDES);
  const [apercuRH, setApercuRH] = useState<RHOverviewReponse | null>(null);
  const [chargementRH, setChargementRH] = useState(true);
  const [erreurRH, setErreurRH] = useState<string | null>(null);

  useEffect(() => {
    if (!jeton) return;
    api.listerFiliales(jeton).then(setFiliales);
    api.listerCategoriesProfessionnelles(jeton).then(setCategories);
  }, [jeton]);

  useEffect(() => {
    if (!jeton) return;
    setChargementRH(true);
    api
      .obtenirApercuRH(jeton, filtresRH)
      .then(setApercuRH)
      .catch((err) => setErreurRH(err instanceof ErreurApi ? err.message : 'Erreur de chargement'))
      .finally(() => setChargementRH(false));
  }, [jeton, filtresRH]);

  return (
    <MiseEnPage>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Tableaux de bord</h2>
        <SelecteurPeriode periodeDebut={periodeDebut} periodeFin={periodeFin} onChangeDebut={setPeriodeDebut} onChangeFin={setPeriodeFin} />
      </div>

      {erreur && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      {chargement ? (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-6">
          <TuileStat libelle="Effectif actif" valeur={totalEffectifActif} icone={<IconeEmployes />} couleur="primary" delaiMs={0} />
          <TuileStat libelle="Sorties (période)" valeur={sorties?.total ?? '—'} icone={<IconeEmployes />} couleur="erreur" delaiMs={40} />
          <TuileStat
            libelle="Turnover (période)"
            valeur={turnover ? `${turnover.tauxPourcent.toFixed(1)} %` : '—'}
            icone={<IconeAlerte />}
            couleur="alerte"
            delaiMs={80}
          />
          <TuileStat
            libelle="Congés en cours"
            valeur={conges?.congesEnCours ?? '—'}
            icone={<IconeConges />}
            couleur="accent"
            delaiMs={120}
          />
          <TuileStat
            libelle="Contrats expirant sous 90j"
            valeur={contrats?.expirantSous90Jours ?? '—'}
            icone={<IconeAlerte />}
            couleur="alerte"
            delaiMs={160}
          />
          <TuileStat
            libelle="Masse salariale (dernier mois)"
            valeur={masseSalariale ? formaterFCFA(masseSalariale.mois.at(-1)?.total ?? 0) : '—'}
            icone={<IconePaie />}
            couleur="succes"
            delaiMs={200}
          />
        </div>
      )}

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <GraphiqueBarresCategoriel
          titre="Effectif actif par société"
          items={(effectif?.parFiliale ?? []).map((f) => ({ libelle: f.filiale, valeur: f.total }))}
        />
        <GraphiqueBarresCategoriel
          titre="Contrats actifs par type"
          items={(contrats?.parType ?? []).map((t) => ({ libelle: t.type.toUpperCase(), valeur: t.total }))}
        />
      </div>

      <div className="mb-6">
        <GraphiqueMasseSalariale mois={masseSalariale?.mois ?? []} />
      </div>

      <div className="mb-10">
        <TableauSorties details={sorties?.details ?? []} />
      </div>

      {/* --- Vue RH détaillée, façon TCD + slicers Excel --- */}
      <div className="mb-6 border-t border-slate-200 pt-8">
        <h2 className="mb-1 text-lg font-semibold text-slate-900">Vue RH détaillée</h2>
        <p className="mb-4 text-sm text-slate-500">Combinez les filtres ci-dessous — tous les graphiques se recalculent instantanément.</p>
        <BarreFiltresRH filtres={filtresRH} onChange={setFiltresRH} filiales={filiales} categories={categories} />
      </div>

      {erreurRH && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreurRH}</div>}

      {chargementRH ? (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <TuileStat
            libelle="Rémunération moyenne"
            valeur={apercuRH ? formaterFCFA(apercuRH.kpi.remunerationMoyenne) : '—'}
            icone={<IconePaie />}
            couleur="succes"
            delaiMs={0}
          />
          <TuileStat
            libelle="Rémunération totale"
            valeur={apercuRH ? formaterFCFA(apercuRH.kpi.remunerationTotale) : '—'}
            icone={<IconePaie />}
            couleur="primary"
            delaiMs={40}
          />
          <TuileStat libelle="Effectif Femme" valeur={apercuRH?.kpi.effectifFemmes ?? '—'} icone={<IconeEmployes />} couleur="accent" delaiMs={80} />
          <TuileStat libelle="Effectif Homme" valeur={apercuRH?.kpi.effectifHommes ?? '—'} icone={<IconeEmployes />} couleur="alerte" delaiMs={120} />
        </div>
      )}

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <GraphiqueDonutSexe hommes={apercuRH?.sexe.hommes ?? 0} femmes={apercuRH?.sexe.femmes ?? 0} />
        <GraphiquePyramideAges tranches={apercuRH?.pyramideAges ?? []} />
      </div>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <GraphiqueBarresEmpilees titre="Employés par catégorie" items={apercuRH?.parCategorie ?? []} />
        <GraphiqueBarresEmpilees titre="Répartition par entreprise" items={apercuRH?.parEntreprise ?? []} />
      </div>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <GraphiqueBarresEmpilees titre="Type de contrat" items={apercuRH?.parTypeContrat ?? []} />
        <GraphiqueBarresEmpilees titre="Ancienneté" items={apercuRH?.parAnciennete ?? []} />
      </div>

      <div className="mb-6">
        <GraphiqueBarresEmpilees titre="Nationalité" items={apercuRH?.parNationalite ?? []} />
      </div>
    </MiseEnPage>
  );
}
