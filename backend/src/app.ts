import cors from 'cors';
import express from 'express';
import { gestionnaireErreurs } from './middleware/gestionErreurs';
import { journalAudit } from './middleware/journalAudit';
import { routesAuth } from './modules/auth/auth.routes';
import { routesEmployes } from './modules/employes/employes.routes';
import { routesPostes } from './modules/postes/postes.routes';
import { routesContrats } from './modules/contrats/contrats.routes';
import { routesConges } from './modules/conges/conges.routes';
import { routesAbsences } from './modules/absences/absences.routes';
import { routesMissions } from './modules/missions/missions.routes';
import { routesPointage } from './modules/pointage/pointage.routes';
import { routesPaie } from './modules/paie/paie';
import { routesElementsVariables } from './modules/elementsVariables/elementsVariables.routes';
import { routesCyclesPaie } from './modules/cyclesPaie/cyclesPaie.routes';
import { routesCategoriesProfessionnelles } from './modules/categoriesProfessionnelles/categoriesProfessionnelles.routes';
import { routesArchivage } from './modules/archivage/archivage.routes';
import { routesTableauxDeBord } from './modules/tableauxDeBord/tableauxDeBord.routes';
import { routesAudit } from './modules/audit/audit.routes';
import { routesUtilisateurs } from './modules/utilisateurs/utilisateurs.routes';
import { routesParametresPaie } from './modules/parametresPaie/parametresPaie.routes';
import { routesJoursFeries } from './modules/joursFeries/joursFeries.routes';
import { routesAttestations } from './modules/attestations/attestations.routes';

export const app = express();

app.use(cors());
app.use(express.json());
app.use(journalAudit);

app.get('/sante', (_req, res) => res.json({ statut: 'ok' }));

app.use('/api/auth', routesAuth);
app.use('/api/employes', routesEmployes);
app.use('/api/postes', routesPostes);
app.use('/api/contrats', routesContrats);
app.use('/api/conges', routesConges);
app.use('/api/absences', routesAbsences);
app.use('/api/missions', routesMissions);
app.use('/api/pointage', routesPointage);
app.use('/api/paie', routesPaie);
app.use('/api/elements-variables', routesElementsVariables);
app.use('/api/cycles-paie', routesCyclesPaie);
app.use('/api/categories-professionnelles', routesCategoriesProfessionnelles);
app.use('/api/archivage', routesArchivage);
app.use('/api/tableaux-de-bord', routesTableauxDeBord);
app.use('/api/audit', routesAudit);
app.use('/api/utilisateurs', routesUtilisateurs);
app.use('/api/parametres-paie', routesParametresPaie);
app.use('/api/jours-feries', routesJoursFeries);
app.use('/api/attestations', routesAttestations);

app.use(gestionnaireErreurs);
