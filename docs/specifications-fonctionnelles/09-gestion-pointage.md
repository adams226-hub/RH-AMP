# Spécifications fonctionnelles — Module Pointage

## 1. Objectif et périmètre

Enregistrer la présence journalière et les heures supplémentaires des employés affectés à un chantier, saisies par un Responsable RH Chantier, et alimenter le calcul des heures sup dans la paie. Module ajouté le 2026-08-06, en complément du lot initial de 8 modules.

## 2. Acteurs et droits (RBAC)

| Rôle | Droits sur ce module |
|---|---|
| Employé | Consulter son propre historique de pointage (lecture seule) |
| Responsable RH Chantier | Saisir/modifier le pointage journalier des employés de son/ses chantiers, valider la synthèse mensuelle avant transmission à la paie |
| Chef de service | Aucun accès direct (le pointage suit le chantier, pas la ligne hiérarchique classique) |
| RH Filiale | Consulter le pointage des chantiers de sa filiale, corriger en cas d'anomalie |
| DRH Holding | Mêmes droits sur l'ensemble du groupe |
| Super Admin | Tous droits, configuration des chantiers |

Ce rôle est nouveau et distinct de RH Filiale : son périmètre est un ou plusieurs **chantiers** (table `utilisateurs_chantiers`), pas une filiale entière — il n'a pas accès aux modules Paie, Contrats ou Congés.

## 3. Chantiers (référentiel)

| Champ | Détail |
|---|---|
| Nom | Obligatoire |
| Filiale de rattachement | Obligatoire |
| Localisation | Optionnelle |
| Responsable | Employé désigné comme Responsable RH Chantier (peut être distinct de l'utilisateur qui saisit, cf. section 8) |
| Statut | Actif / inactif (chantier clôturé) |

Un chantier est une entité distincte de la structure Filiale > Département > Service > Fonction du module Postes — il représente un site opérationnel, pas un niveau hiérarchique.

## 4. Fonctionnalités détaillées

### 4.1 Saisie du pointage journalier

| Champ | Détail |
|---|---|
| Employé | Réf. employé, doit être affecté au chantier du jour |
| Chantier | Réf. chantier, auto-rempli selon l'utilisateur connecté |
| Date | Obligatoire, une seule ligne par employé et par date |
| Présent | Oui/Non |
| Heures travaillées | Numérique, saisi si présent |
| Heures supplémentaires | Numérique, au-delà de l'horaire normal (règles de majoration à confirmer, cf. section 7) |
| Statut | SAISI → VALIDE |

### 4.2 Validation et transmission à la paie

| Étape | Détail |
|---|---|
| Saisie quotidienne | Par le Responsable RH Chantier, statut SAISI |
| Validation mensuelle | En fin de mois, le Responsable RH Chantier (ou RH Filiale) valide l'ensemble des pointages de la période, statut VALIDE |
| Agrégation | Somme des `heures_sup` du mois par employé |
| Transmission | Une écriture est créée dans `elements_variables_paie` (type `heure_sup`) pour la période de paie correspondante |

Seuls les pointages au statut VALIDE alimentent la paie — un pointage encore SAISI ne doit pas être pris en compte dans le calcul du bulletin.

## 5. Interface avec le module Paie

`pointages.heures_sup` (agrégées mensuellement, statut VALIDE) → `elements_variables_paie.montant` ou `.jours` selon la convention retenue pour la valorisation (cf. point ouvert section 7 sur les majorations). Le rattachement se fait par `employe_id` + `periode`.

## 6. Modèle de données

| Entité | Attributs clés | Relations |
|---|---|---|
| `Chantier` | id, filiale_id, nom, localisation, responsable_id, actif | → Filiale, Employe |
| `UtilisateurChantier` | utilisateur_id, chantier_id | → Utilisateur, Chantier (table de liaison, périmètre RBAC) |
| `Pointage` | id, employe_id, chantier_id, date, present, heures_travaillees, heures_sup, statut, saisi_par, valide_par | → Employe, Chantier, Utilisateur |

## 7. Exemple concret

**Entrée** : Responsable RH Chantier de « ROMBAT — Chantier Kossodo » saisit le 15/09/2026 : employé Paul Sawadogo, présent, 8h travaillées, 2h supplémentaires.

**Sortie** : ligne `Pointage` créée (statut SAISI). En fin de mois, validation → total heures_sup de septembre pour Paul Sawadogo = somme des lignes du mois → écriture créée dans `elements_variables_paie` pour la période 09/2026, reprise dans son bulletin de paie.

## 8. Points à clarifier

| Point | Pourquoi c'est bloquant |
|---|---|
| Règles de majoration des heures sup (taux horaire majoré, paliers légaux burkinabè) | Nécessaire pour convertir des heures en montant dans `elements_variables_paie` |
| Le Responsable RH Chantier est-il lui-même un employé du groupe avec un compte dédié, ou un compte technique sans dossier employé ? | Impacte la création de compte (module Utilisateurs) |
| Granularité de validation : validation ligne par ligne ou validation globale du mois ? | Impacte l'ergonomie de saisie et le workflow de transmission à la paie |
| Un employé peut-il être pointé sur plusieurs chantiers dans la même journée ? | La contrainte `UNIQUE (employe_id, date)` du schéma suppose un seul chantier par jour — à confirmer |
| Delta avec le module Absences existant (retard, absence) : le pointage doit-il aussi enregistrer les retards, ou cela reste dans Absences ? | Évite une double saisie entre les deux modules |
