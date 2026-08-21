import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RouteProtegee() {
  const { jeton } = useAuth();
  return jeton ? <Outlet /> : <Navigate to="/connexion" replace />;
}
