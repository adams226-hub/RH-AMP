import { useEffect, useState } from 'react';
import { ErreurApi, api } from '../../api/client';
import { Badge } from '../Badge';
import { useAuth } from '../../context/AuthContext';
import { ParametrePaie } from '../../types/parametresPaie';
import { formaterDateFr } from '../../utils/date';

const CHAMP =
  'w-28 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';

const LIBELLES: Record<string, string> = {
  taux_cnss_patronale: 'Taux CNSS patronale',
  taux_tpa: 'Taux TPA',
  taux_fsp: 'Taux FSP',
  taux_abattement: 'Taux abattement forfaitaire',
  taux_panier_jour: 'Prime de panier / jour',
};

const NOTES: Record<string, string> = {
  taux_cnss_patronale: 'Marqué provisoire depuis le départ — à reconfirmer auprès de la CNSS.',
  taux_tpa: 'Taxe Patronale d’Apprentissage, à la charge de l’employeur.',
  taux_fsp: 'Fonds de Soutien Patriotique, retenue sur le salaire net.',
  taux_abattement: 'Abattement forfaitaire pour frais professionnels (20% cadre / 25% autre catégorie).',
  taux_panier_jour: 'Montant en F CFA par jour de panier pointé (pointage validé).',
};

// taux_panier_jour est un montant en F CFA, pas un taux — les autres clés restent des
// pourcentages (valeur stockée entre 0 et 1, affichée ×100 avec un signe %).
const UNITES_MONTANT = new Set(['taux_panier_jour']);

export function SectionParametresPaie() {
  const { jeton, role } = useAuth();
  const peutModifier = role === 'super_admin';

  const [parametres, setParametres] = useState<ParametrePaie[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [edition, setEdition] = useState<{ cle: string; valeur: string } | null>(null);
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);

  function rafraichir() {
    if (!jeton) return;
    setChargement(true);
    api
      .listerParametresPaie(jeton)
      .then(setParametres)
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : 'Erreur de chargement'))
      .finally(() => setChargement(false));
  }

  useEffect(rafraichir, [jeton]);

  async function enregistrer() {
    if (!jeton || !edition) return;
    const estMontant = UNITES_MONTANT.has(edition.cle);
    const saisie = Number(edition.valeur);

    if (Number.isNaN(saisie) || saisie < 0 || (!estMontant && saisie > 100)) {
      setErreur(estMontant ? 'Le montant doit être un nombre positif.' : 'Le taux doit être un nombre entre 0 et 100.');
      return;
    }

    setEnregistrementEnCours(true);
    setErreur(null);
    try {
      await api.definirParametrePaie(jeton, edition.cle, estMontant ? saisie : saisie / 100);
      setEdition(null);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'enregistrement");
    } finally {
      setEnregistrementEnCours(false);
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Ces taux alimentent directement le calcul des bulletins de paie — aucune valeur n'est codée en dur dans l'application.
      </p>

      {erreur && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {chargement ? (
          <div className="space-y-3 p-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Paramètre</th>
                <th className="px-4 py-3">Valeur</th>
                <th className="px-4 py-3">En vigueur depuis</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {parametres.map((p) => (
                <tr key={p.cle} className="transition-colors duration-200 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{LIBELLES[p.cle] ?? p.cle}</div>
                    <div className="text-xs text-slate-400">{NOTES[p.cle]}</div>
                  </td>
                  <td className="px-4 py-3">
                    {edition?.cle === p.cle ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step={UNITES_MONTANT.has(p.cle) ? '1' : '0.1'}
                          value={edition.valeur}
                          onChange={(e) => setEdition({ cle: p.cle, valeur: e.target.value })}
                          className={CHAMP}
                          autoFocus
                        />
                        <span className="text-slate-500">{UNITES_MONTANT.has(p.cle) ? 'F CFA' : '%'}</span>
                      </div>
                    ) : p.valeur === null ? (
                      <Badge couleur="alerte">Non configuré</Badge>
                    ) : (
                      <span className="font-semibold text-slate-900 [font-variant-numeric:tabular-nums]">
                        {UNITES_MONTANT.has(p.cle)
                          ? `${p.valeur.toLocaleString('fr-FR')} F CFA`
                          : `${(p.valeur * 100).toFixed(1)} %`}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.dateEffet ? formaterDateFr(p.dateEffet) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {peutModifier &&
                      (edition?.cle === p.cle ? (
                        <div className="flex justify-end gap-3">
                          <button
                            disabled={enregistrementEnCours}
                            onClick={enregistrer}
                            className="font-medium text-succes-700 transition-colors duration-200 hover:underline disabled:opacity-50"
                          >
                            Enregistrer
                          </button>
                          <button
                            onClick={() => setEdition(null)}
                            className="font-medium text-slate-500 transition-colors duration-200 hover:underline"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            setEdition({
                              cle: p.cle,
                              valeur: p.valeur === null ? '' : String(UNITES_MONTANT.has(p.cle) ? p.valeur : p.valeur * 100),
                            })
                          }
                          className="font-medium text-primary-700 transition-colors duration-200 hover:underline"
                        >
                          Modifier
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
