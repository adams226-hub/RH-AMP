# Spécifications fonctionnelles — Module Gestion des congés

## 1. Objectif et périmètre

Gérer le cycle de vie du congé administratif : demande, validation hiérarchique et RH, suivi du solde, visualisation calendaire. Les permissions exceptionnelles et absences (Note de service N°RH 013/DAF/2026) relèvent du module **Gestion des absences** (hors périmètre du présent lot) mais impactent le solde calculé ici — l'interface entre les deux modules est précisée en section 6.

## 2. Acteurs et droits (RBAC)

| Rôle | Droits sur ce module |
|---|---|
| Employé | Créer/consulter ses propres demandes, consulter son solde, annuler une demande non encore traitée par la RH |
| Chef de service | Consulter les demandes de son équipe, émettre un avis (favorable/défavorable) |
| RH Filiale | Traiter (valider/rejeter) les demandes de sa filiale, consulter soldes et calendrier de sa filiale, paramétrer les jours fériés de sa filiale |
| DRH Holding | Mêmes droits que RH Filiale sur l'ensemble du groupe, vue consolidée |
| Super Admin | Paramétrage des règles globales (volume annuel, règles de report), tous droits |

## 3. Fonctionnalités détaillées

### 3.1 Demande de congé

| Champ | Détail |
|---|---|
| Employé | Réf. employé, auto-rempli depuis la session |
| Type de congé | Congé administratif (seul type traité dans ce module) |
| Date début | Date, obligatoire |
| Date fin | Date, obligatoire, ≥ date début |
| Nombre de jours | Calculé automatiquement : jours ouvrés entre début et fin, hors week-ends et jours fériés (référentiel `JourFerie`) |
| Motif | Texte libre, optionnel |
| Solde disponible | Affiché en lecture seule au moment de la saisie |
| Pièce jointe | Optionnelle |
| Statut | Énuméré, cf. 3.2 |

**Règle de blocage** : une demande ne peut être soumise si `nombre de jours demandés > solde disponible`, sauf dérogation explicite RH (à confirmer, cf. section 7).

### 3.2 Validation (workflow)

| Étape | Statut résultant | Acteur |
|---|---|---|
| Saisie | BROUILLON | Employé |
| Soumission | SOUMISE | Employé |
| Avis hiérarchique favorable | AVIS_FAVORABLE | Chef de service |
| Avis hiérarchique défavorable | AVIS_DEFAVORABLE | Chef de service |
| Traitement RH — acceptation | VALIDEE_RH | RH Filiale / DRH |
| Traitement RH — rejet | REJETEE_RH | RH Filiale / DRH |
| Annulation avant traitement RH | ANNULEE | Employé |

Un avis défavorable du supérieur n'empêche pas la RH de statuer (elle garde la décision finale) mais doit rester visible dans l'historique de la demande.

### 3.3 Solde des congés

**Formule** :
`Solde disponible (année N) = Solde reporté (N-1 non consommé) + Jours acquis (N) − Jours consommés (N) − Jours déduits (absences hors barème imputées au congé administratif)`

| Champ | Détail |
|---|---|
| Solde initial (report N-1) | Repris automatiquement à la clôture d'exercice |
| Jours acquis | 30 jours/an — méthode d'acquisition à confirmer (cf. section 7) |
| Jours consommés | Somme des demandes au statut VALIDEE_RH sur la période |
| Jours déduits | Alimenté par le module Absences (absences hors barème) |
| Solde disponible | Calculé, affiché sur le dossier employé et dans le formulaire de demande |

### 3.4 Calendrier des congés

| Fonction | Détail |
|---|---|
| Vue | Mensuelle et annuelle |
| Filtres | Filiale, département, service, statut |
| Code couleur | Par statut (brouillon, en attente, validé) |
| Export | PDF et Excel |
| Accès | Restreint au périmètre du rôle (service pour Chef de service, filiale pour RH Filiale, groupe pour DRH) |

## 4. Modèle de données

| Entité | Attributs clés | Relations |
|---|---|---|
| `DemandeConge` | id, employe_id, date_debut, date_fin, nb_jours, motif, statut, avis_hierarchique, commentaire_hierarchique, decision_rh, commentaire_rh, created_at, updated_at | → Employe |
| `SoldeConge` | id, employe_id, annee, solde_initial, jours_acquis, jours_consommes, jours_deduits, solde_disponible | → Employe |
| `JourFerie` | id, date, libelle, filiale_id (nullable) | → Filiale |

## 5. Exemple concret

**Entrée** : Employée Awa Traoré, solde disponible = 22 jours, demande du 07/09/2026 au 18/09/2026, motif « congés annuels », aucun jour férié sur la période.

**Traitement** : nb_jours calculé = 10 (jours ouvrés) → soumission → avis favorable du chef de service → validation RH.

**Sortie** : statut = VALIDEE_RH, solde disponible mis à jour = 12 jours, entrée ajoutée au calendrier filiale, notification envoyée à l'employée.

## 6. Interface avec le module Absences

Les absences hors barème (Note RH 013/DAF/2026) sont déduites du solde de congé administratif via le champ `jours_deduits` de `SoldeConge`, alimenté par une écriture du module Absences — le contrat d'interface exact (API interne / événement) sera précisé lors de la spécification de ce module.

## 7. Points à clarifier

| Point | Pourquoi c'est bloquant |
|---|---|
| Méthode d'acquisition des 30 jours : bloc annuel en une fois ou prorata mensuel (2,5 j/mois) ? | Impacte directement le calcul du solde en cours d'année et pour un nouvel embauché |
| Plafond de report du solde non consommé (illimité ou plafonné) ? | La note dit « cumulable » sans préciser de plafond |
| Proratisation du solde pour un employé embauché en cours d'année | Non précisé dans la note RH |
| Délai de préavis pour une demande de congé administratif (le délai de 72h connu concerne la permission exceptionnelle) | Nécessaire pour bloquer/avertir en cas de demande tardive |
| Possibilité de dérogation RH pour dépasser le solde disponible | À confirmer avant de coder la règle de blocage en dur |
