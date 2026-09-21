import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RouteProtegee } from './components/RouteProtegee';
import { FournisseurAuth } from './context/AuthContext';
import { FournisseurTheme } from './context/ThemeContext';
import { Absences } from './pages/Absences';
import { Attestations } from './pages/Attestations';
import { Audit } from './pages/Audit';
import { Conges } from './pages/Conges';
import { Connexion } from './pages/Connexion';
import { Contrats } from './pages/Contrats';
import { CyclePaie } from './pages/CyclePaie';
import { Employes } from './pages/Employes';
import { Missions } from './pages/Missions';
import { Paie } from './pages/Paie';
import { Parametres } from './pages/Parametres';
import { Pointage } from './pages/Pointage';
import { Simulateur } from './pages/Simulateur';
import { TableauxDeBord } from './pages/TableauxDeBord';

export function App() {
  return (
    <FournisseurTheme>
      <FournisseurAuth>
        <BrowserRouter>
          <Routes>
            <Route path="/connexion" element={<Connexion />} />
            <Route element={<RouteProtegee />}>
              <Route path="/employes" element={<Employes />} />
              <Route path="/contrats" element={<Contrats />} />
              <Route path="/conges" element={<Conges />} />
              <Route path="/absences" element={<Absences />} />
              <Route path="/missions" element={<Missions />} />
              <Route path="/pointage" element={<Pointage />} />
              <Route path="/paie" element={<Paie />} />
              <Route path="/cycle-paie" element={<CyclePaie />} />
              <Route path="/simulateur" element={<Simulateur />} />
              <Route path="/attestations" element={<Attestations />} />
              <Route path="/tableaux-de-bord" element={<TableauxDeBord />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="/parametres" element={<Parametres />} />
            </Route>
            <Route path="*" element={<Navigate to="/employes" replace />} />
          </Routes>
        </BrowserRouter>
      </FournisseurAuth>
    </FournisseurTheme>
  );
}
