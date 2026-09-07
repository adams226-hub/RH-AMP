import { FiltresRHOverview, FILTRES_VIDES } from '../../types/rhOverview';
import { Filiale } from '../../types/postes';
import { CategorieProfessionnelle } from '../../types/categoriesProfessionnelles';
import { SelecteurMulti } from './SelecteurMulti';

const OPTIONS_SEXE = [
  { valeur: 'F', libelle: 'Femme' },
  { valeur: 'M', libelle: 'Homme' },
];

// CDC confirmé comme vrai type de contrat (Contrat à Durée de Chantier), plus une erreur de
// saisie — ajouté aux options du filtre.
const OPTIONS_TYPE_CONTRAT = [
  { valeur: 'cdi', libelle: 'CDI' },
  { valeur: 'cdd', libelle: 'CDD' },
  { valeur: 'cdc', libelle: 'CDC' },
  { valeur: 'stage', libelle: 'Stage' },
];

export function BarreFiltresRH({
  filtres,
  onChange,
  filiales,
  categories,
}: {
  filtres: FiltresRHOverview;
  onChange: (filtres: FiltresRHOverview) => void;
  filiales: Filiale[];
  categories: CategorieProfessionnelle[];
}) {
  const filtresActifs =
    filtres.filialeId.length + filtres.categorieProfessionnelle.length + filtres.sexe.length + filtres.typeContrat.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Filtres</span>

      <SelecteurMulti
        libelle="Filiale"
        options={filiales.map((f) => ({ valeur: f.id, libelle: f.nom }))}
        valeurs={filtres.filialeId}
        onChange={(v) => onChange({ ...filtres, filialeId: v })}
      />
      <SelecteurMulti
        libelle="Catégorie"
        options={categories.map((c) => ({ valeur: c.code, libelle: c.libelle }))}
        valeurs={filtres.categorieProfessionnelle}
        onChange={(v) => onChange({ ...filtres, categorieProfessionnelle: v })}
      />
      <SelecteurMulti
        libelle="Sexe"
        options={OPTIONS_SEXE}
        valeurs={filtres.sexe}
        onChange={(v) => onChange({ ...filtres, sexe: v as FiltresRHOverview['sexe'] })}
      />
      <SelecteurMulti
        libelle="Type de contrat"
        options={OPTIONS_TYPE_CONTRAT}
        valeurs={filtres.typeContrat}
        onChange={(v) => onChange({ ...filtres, typeContrat: v })}
      />

      {filtresActifs && (
        <button
          onClick={() => onChange(FILTRES_VIDES)}
          className="ml-auto text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-erreur-600 hover:underline"
        >
          Réinitialiser les filtres
        </button>
      )}
    </div>
  );
}
