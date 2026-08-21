import { useState } from 'react';
import { AccesRestreint } from '../components/AccesRestreint';
import { MiseEnPage } from '../components/MiseEnPage';
import { SectionJoursFeries } from '../components/parametres/SectionJoursFeries';
import { SectionParametresPaie } from '../components/parametres/SectionParametresPaie';
import { SectionReferentiels } from '../components/parametres/SectionReferentiels';
import { SectionUtilisateurs } from '../components/parametres/SectionUtilisateurs';
import { useAuth } from '../context/AuthContext';

type Onglet = 'utilisateurs' | 'referentiels' | 'paie' | 'jours-feries';

const ROLES_ACCES = ['super_admin', 'drh_holding', 'rh_filiale'];

export function Parametres() {
  const { role } = useAuth();
  const [onglet, setOnglet] = useState<Onglet>('utilisateurs');

  // Paramètres de paie réservé à super_admin/drh_holding (cf. RBAC : "Paramètres" est le
  // domaine de Super Admin, DRH en lecture) — RH Filiale n'a accès qu'à Utilisateurs/Référentiels/
  // Jours fériés.
  const onglets: { id: Onglet; libelle: string; visible: boolean }[] = [
    { id: 'utilisateurs', libelle: 'Utilisateurs', visible: true },
    { id: 'referentiels', libelle: 'Référentiels', visible: true },
    { id: 'paie', libelle: 'Paramètres de paie', visible: role === 'super_admin' || role === 'drh_holding' },
    { id: 'jours-feries', libelle: 'Jours fériés', visible: true },
  ];

  if (role !== null && !ROLES_ACCES.includes(role)) {
    return <AccesRestreint />;
  }

  const ongletActif = onglets.find((o) => o.id === onglet)?.visible ? onglet : 'utilisateurs';

  return (
    <MiseEnPage>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Paramètres</h2>
      <p className="mb-6 text-sm text-slate-500">Comptes, taux de paie et calendrier — configuration du groupe.</p>

      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {onglets
          .filter((o) => o.visible)
          .map((o) => (
            <button
              key={o.id}
              onClick={() => setOnglet(o.id)}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${
                ongletActif === o.id
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {o.libelle}
            </button>
          ))}
      </div>

      {ongletActif === 'utilisateurs' && <SectionUtilisateurs />}
      {ongletActif === 'referentiels' && <SectionReferentiels />}
      {ongletActif === 'paie' && <SectionParametresPaie />}
      {ongletActif === 'jours-feries' && <SectionJoursFeries />}
    </MiseEnPage>
  );
}
