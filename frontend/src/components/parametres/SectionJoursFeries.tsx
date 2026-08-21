import { FormEvent, useEffect, useState } from 'react';
import { ErreurApi, api } from '../../api/client';
import { EtatVide } from '../EtatVide';
import { IconeConges } from '../icones';
import { useAuth } from '../../context/AuthContext';
import { Filiale } from '../../types/postes';
import { JourFerie } from '../../types/joursFeries';
import { formaterDateFr } from '../../utils/date';

const CHAMP =
  'rounded-md border border-slate-300 px-2.5 py-1.5 text-sm transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100';
const BOUTON =
  'rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-800 hover:shadow-md disabled:pointer-events-none disabled:opacity-60';

export function SectionJoursFeries() {
  const { jeton, role } = useAuth();
  const peutGerer = role === 'super_admin' || role === 'drh_holding';

  const [jours, setJours] = useState<JourFerie[]>([]);
  const [filiales, setFiliales] = useState<Filiale[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [suppressionId, setSuppressionId] = useState<string | null>(null);

  const [date, setDate] = useState('');
  const [libelle, setLibelle] = useState('');
  const [filialeId, setFilialeId] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  function rafraichir() {
    if (!jeton) return;
    setChargement(true);
    api
      .listerJoursFeries(jeton)
      .then(setJours)
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : 'Erreur de chargement'))
      .finally(() => setChargement(false));
  }

  useEffect(rafraichir, [jeton]);

  useEffect(() => {
    if (!jeton) return;
    api.listerFiliales(jeton).then(setFiliales);
  }, [jeton]);

  const nomFiliale = (id: string | null) => (id ? (filiales.find((f) => f.id === id)?.nom ?? id) : 'Toutes (national)');

  async function creer(evenement: FormEvent) {
    evenement.preventDefault();
    if (!jeton || !date || !libelle) return;

    setEnvoiEnCours(true);
    setErreur(null);
    try {
      await api.creerJourFerie(jeton, { date, libelle, filialeId: filialeId || undefined });
      setDate('');
      setLibelle('');
      setFilialeId('');
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la création');
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function supprimer(id: string) {
    if (!jeton) return;
    setSuppressionId(id);
    try {
      await api.supprimerJourFerie(jeton, id);
      rafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur lors de la suppression');
    } finally {
      setSuppressionId(null);
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Utilisé pour exclure les jours fériés du décompte des jours ouvrés dans le module Congés. Un jour sans filiale
        s'applique à tout le groupe.
      </p>

      {erreur && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      {peutGerer && (
        <form onSubmit={creer} className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={CHAMP} />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Libellé</label>
            <input
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder="Ex. Fête de l'Indépendance"
              required
              className={`w-full ${CHAMP}`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Filiale</label>
            <select value={filialeId} onChange={(e) => setFilialeId(e.target.value)} className={CHAMP}>
              <option value="">Toutes (national)</option>
              {filiales.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom}
                </option>
              ))}
            </select>
          </div>
          <button disabled={envoiEnCours} className={BOUTON}>
            {envoiEnCours ? 'Ajout...' : 'Ajouter'}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {chargement ? (
          <div className="space-y-3 p-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : jours.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Libellé</th>
                <th className="px-4 py-3">Filiale</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jours.map((j) => (
                <tr key={j.id} className="transition-colors duration-200 hover:bg-slate-50">
                  <td className="px-4 py-3">{formaterDateFr(j.date)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{j.libelle}</td>
                  <td className="px-4 py-3 text-slate-600">{nomFiliale(j.filialeId)}</td>
                  <td className="px-4 py-3 text-right">
                    {peutGerer && (
                      <button
                        disabled={suppressionId === j.id}
                        onClick={() => supprimer(j.id)}
                        className="font-medium text-erreur-600 transition-colors duration-200 hover:underline disabled:opacity-50"
                      >
                        Supprimer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EtatVide icone={<IconeConges />} titre="Aucun jour férié" message="Ajoutez le calendrier des jours fériés du groupe." />
        )}
      </div>
    </div>
  );
}
