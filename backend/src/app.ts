import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { gestionnaireErreurs } from './middleware/gestionErreurs';
import { journalAudit } from './middleware/journalAudit';
import { routesAuth } from './modules/auth/auth.routes';
import { routesEmployes } from './modules/employes/employes.routes';
import { routesPostes } from './modules/postes/postes.routes';
import { routesContrats } from './modules/contrats/contrats.routes';
import { routesConges } from './modules/conges/conges.routes';
import { routesCongesSpeciaux } from './modules/congesSpeciaux/congesSpeciaux.routes';
import { routesAbsences } from './modules/absences/absences.routes';
import { routesMissions } from './modules/missions/missions.routes';
import { routesPointage } from './modules/pointage/pointage.routes';
import { routesPaie } from './modules/paie/paie';
import { routesElementsVariables } from './modules/elementsVariables/elementsVariables.routes';
import { routesCyclesPaie } from './modules/cyclesPaie/cyclesPaie.routes';
import { routesCategoriesProfessionnelles } from './modules/categoriesProfessionnelles/categoriesProfessionnelles.routes';
import { routesTableauxDeBord } from './modules/tableauxDeBord/tableauxDeBord.routes';
import { routesAudit } from './modules/audit/audit.routes';
import { routesUtilisateurs } from './modules/utilisateurs/utilisateurs.routes';
import { routesParametresPaie } from './modules/parametresPaie/parametresPaie.routes';
import { routesJoursFeries } from './modules/joursFeries/joursFeries.routes';
import { routesAttestations } from './modules/attestations/attestations.routes';

export const app = express();

app.use(cors());
app.use(express.json());

// Simulation de réseau lent (dev uniquement) — cf. LATENCE_SIMULEE_MS dans config/env.ts.
if (env.LATENCE_SIMULEE_MS > 0) {
  console.log(`Latence simulée activée : +${env.LATENCE_SIMULEE_MS}ms sur chaque requête API`);
  app.use((_req, _res, next) => setTimeout(next, env.LATENCE_SIMULEE_MS));
}

app.use(journalAudit);

app.get('/sante', (_req, res) => res.json({ statut: 'ok' }));

app.use('/api/auth', routesAuth);
app.use('/api/employes', routesEmployes);
app.use('/api/postes', routesPostes);
app.use('/api/contrats', routesContrats);
app.use('/api/conges', routesConges);
app.use('/api/conges-speciaux', routesCongesSpeciaux);
app.use('/api/absences', routesAbsences);
app.use('/api/missions', routesMissions);
app.use('/api/pointage', routesPointage);
app.use('/api/paie', routesPaie);
app.use('/api/elements-variables', routesElementsVariables);
app.use('/api/cycles-paie', routesCyclesPaie);
app.use('/api/categories-professionnelles', routesCategoriesProfessionnelles);
app.use('/api/tableaux-de-bord', routesTableauxDeBord);
app.use('/api/audit', routesAudit);
app.use('/api/utilisateurs', routesUtilisateurs);
app.use('/api/parametres-paie', routesParametresPaie);
app.use('/api/jours-feries', routesJoursFeries);
app.use('/api/attestations', routesAttestations);

app.use(gestionnaireErreurs);
