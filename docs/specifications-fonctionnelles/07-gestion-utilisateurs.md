# Spécifications fonctionnelles — Module Gestion des utilisateurs

## 1. Objectif et périmètre

Gérer les comptes d'accès à la plateforme, l'attribution des rôles RBAC, et le contrôle fin des droits par module. Ce module pilote la sécurité d'accès de l'ensemble du SIRH.

## 2. Rôles gérés

| Rôle | Périmètre | Droits (rappel synthétique) |
|---|---|---|
| Super Admin | Groupe | Accès total, configuration système, gestion des utilisateurs, audit |
| DRH Holding | Groupe | Lecture/écriture tous modules, validation finale contrats/congés/paie, dashboards consolidés |
| RH Filiale | Filiale d'affectation | Lecture/écriture limitée à sa filiale |
| Chef de service | Service d'affectation | Validation congés/absences de son équipe, saisie évaluations |
| Employé | Son propre dossier | Consultation dossier/bulletins, demandes congés/absences |
| Responsable RH Chantier | Chantier(s) d'affectation | Saisie/validation du pointage et des heures sup de son/ses chantiers (module Pointage) — pas d'accès paie/contrats/congés |

## 3. Acteurs et droits sur ce module lui-même

| Rôle | Droits |
|---|---|
| Employé | Aucun accès |
| Chef de service | Aucun accès |
| RH Filiale | Créer un compte pour un nouvel employé de sa filiale, réinitialiser son mot de passe, suspendre son accès |
| DRH Holding | Idem RH Filiale sur l'ensemble du groupe, attribution des rôles RH Filiale/Chef de service |
| Super Admin | Tous droits, y compris attribution du rôle Super Admin/DRH Holding, configuration fine de la matrice RBAC |

## 4. Fonctionnalités détaillées

### 4.1 Création de compte

| Champ | Détail |
|---|---|
| Employé rattaché | Réf. employé (nullable — un compte technique Super Admin peut ne pas être lié à un dossier employé) |
| Email professionnel | Obligatoire, identifiant de connexion |
| Rôle | Un des 6 rôles listés en section 2 |
| Filiale(s) autorisée(s) | Une ou plusieurs pour RH Filiale (cf. section 6), la filiale d'affectation pour Chef de service/Employé, toutes pour DRH/Super Admin |
| Chantier(s) autorisé(s) | Un ou plusieurs pour Responsable RH Chantier (table `UtilisateurChantier`), sans objet pour les autres rôles |
| Statut | ACTIF / SUSPENDU / SUPPRIME |

Déclenchement : automatique à l'activation du dossier employé (module Employés), avec proposition de rôle par défaut « Employé », modifiable par la RH avant validation.

### 4.2 Cycle de vie du compte

| Étape | Détail |
|---|---|
| Création | Email d'activation envoyé automatiquement |
| Première connexion | Changement de mot de passe obligatoire |
| Utilisation | Connexion JWT, session avec expiration |
| Suspension | Accès bloqué, données conservées (ex. congé longue durée, procédure en cours) |
| Réactivation | Retour au statut ACTIF |
| Suppression | Anonymisation ou suppression selon règles de conservation (à définir avec le module Archivage) |

### 4.3 Matrice des droits par module

| Module | Employé | Chef de service | RH Filiale | DRH Holding | Super Admin | Responsable RH Chantier |
|---|---|---|---|---|---|---|
| Employés | Lecture (soi-même) | Lecture (équipe) | Lecture/Écriture (filiale) | Lecture/Écriture (groupe) | Total | Lecture (chantier) |
| Contrats | Lecture (soi-même) | — | Lecture/Écriture (filiale) | Lecture/Écriture (groupe) | Total | — |
| Congés | Lecture/Écriture (soi-même) | Avis (équipe) | Validation (filiale) | Validation (groupe) | Total | — |
| Absences | Lecture/Écriture (soi-même) | Avis (équipe) | Validation (filiale) | Validation (groupe) | Total | — |
| Postes | Lecture | Lecture (service) | Lecture/Écriture (filiale) | Lecture/Écriture (groupe) | Total | Lecture (chantier) |
| Pointage | Lecture (soi-même) | — | Lecture/Écriture (filiale) | Lecture/Écriture (groupe) | Total | Lecture/Écriture (chantier) |
| Paie | Lecture (soi-même) | — | Lecture/Écriture (filiale) | Validation (groupe) | Total | — |
| Archivage | Lecture/Écriture (soi-même) | — | Lecture/Écriture (filiale) | Lecture/Écriture (groupe) | Total | — |
| Évaluation | Lecture (soi-même) | Écriture (équipe) | Lecture (filiale) | Lecture (groupe) | Total | — |
| Santé et sécurité | Lecture (soi-même) | — | Lecture/Écriture (filiale) | Lecture/Écriture (groupe) | Total | — |
| Tableaux de bord | — | Restreint (équipe) | Filiale | Groupe | Total | — |
| Utilisateurs | — | — | Restreint (filiale) | Groupe | Total | — |

### 4.4 Journal des connexions

Intégré au journal d'audit global du système (traçabilité complète des actions) : horodatage, utilisateur, action, module concerné, adresse IP.

## 5. Modèle de données

| Entité | Attributs clés | Relations |
|---|---|---|
| `Utilisateur` | id, employe_id (nullable), email, mot_de_passe_hash, role_id, statut, derniere_connexion, mfa_active | → Employe, Role |
| `Role` | id, code (super_admin, drh_holding, rh_filiale, chef_service, employe, responsable_rh_chantier), libelle | — |
| `UtilisateurFiliale` | utilisateur_id, filiale_id | → Utilisateur, Filiale (table de liaison N:N pour un RH Filiale multi-filiales) |
| `UtilisateurChantier` | utilisateur_id, chantier_id | → Utilisateur, Chantier (table de liaison N:N pour un Responsable RH Chantier multi-chantiers) |

## 6. Exemple concret

**Entrée** : le dossier employé de Fatima Kaboré est activé, rôle proposé « Employé » par défaut.

**Sortie** : compte créé avec email `fatima.kabore@amp-holding.bf`, email d'activation envoyé, changement de mot de passe imposé à la première connexion, journal d'audit alimenté.

## 7. Points à clarifier

| Point | Pourquoi c'est bloquant |
|---|---|
| Authentification à deux facteurs (MFA) obligatoire pour certains rôles (Super Admin, DRH) ? | Impacte le schéma d'authentification |
| Politique de mot de passe (complexité, durée de validité, historique) | Nécessaire pour la configuration JWT/sécurité |
| SSO envisagé (Google Workspace / Microsoft 365) ou authentification interne uniquement ? | Impacte l'architecture d'authentification |
| Un utilisateur RH Filiale peut-il être rattaché à plusieurs filiales ? | Conditionne la table de liaison `UtilisateurFiliale` proposée en section 5 |
| Durée de conservation des comptes après suppression (anonymisation immédiate ou délai légal) | Lié à la conformité loi n°010-2004/AN |
