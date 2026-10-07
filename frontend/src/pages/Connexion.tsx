import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErreurApi, api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function Connexion() {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const { connecte } = useAuth();
  const navigate = useNavigate();

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    setErreur(null);
    setEnCours(true);

    try {
      const { jeton } = await api.connexion(email, motDePasse);
      connecte(jeton, email);
      navigate('/employes');
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Erreur de connexion au serveur');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-700 text-lg font-bold text-white">
            AH
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-slate-900">RH AMP Holding</h1>
            <p className="text-sm text-slate-500">Connectez-vous à votre espace</p>
          </div>
        </div>

        <form onSubmit={soumettre} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            />
          </div>

          <div className="mb-5">
            <label htmlFor="mot-de-passe" className="mb-1 block text-sm font-medium text-slate-700">
              Mot de passe
            </label>
            <input
              id="mot-de-passe"
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            />
          </div>

          {erreur && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {erreur}
            </div>
          )}

          <button
            type="submit"
            disabled={enCours}
            className="w-full rounded-md bg-primary-700 px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-800 hover:shadow-md disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-60"
          >
            {enCours ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
