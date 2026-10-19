import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LIENS, lienVisible, pageAccueil } from '../nav';
import { estGestionnaire } from '../permissions';

export function RouteProtegee() {
  const { jeton, role } = useAuth();
  const { pathname } = useLocation();

  if (!jeton) return <Navigate to="/connexion" replace />;

  // Rôles gestionnaires : une page hors de leurs modules renvoie vers leur première page autorisée
  // (y compris juste après la connexion, qui mène toujours à /employes). Les autres rôles gardent
  // le comportement de chaque page (AccesRestreint ou vue réduite).
  if (estGestionnaire(role)) {
    const lien = LIENS.find((l) => pathname.startsWith(l.vers));
    if (lien && !lienVisible(lien, role)) return <Navigate to={pageAccueil(role)} replace />;
  }

  return <Outlet />;
}
