# Spécifications fonctionnelles — Module Gestion des contrats

## 1. Objectif et périmètre

Gérer le cycle de vie des contrats de travail (CDI, CDD, Stage) : création, renouvellement, suivi des expirations, historique par employé, génération du document PDF.

## 2. Acteurs et droits (RBAC)

| Rôle | Droits sur ce module |
|---|---|
| Employé | Consulter ses propres contrats (lecture seule) |
| Chef de service | Aucun accès direct |
| RH Filiale | Créer/modifier/renouveler les contrats de sa filiale |
| DRH Holding | Mêmes droits sur l'ensemble du groupe, validation des contrats CDI |
| Super Admin | Paramétrage des modèles de contrat, tous droits |

## 3. Fonctionnalités détaillées

### 3.1 Création d'un contrat

| Champ | Détail |
|---|---|
| Employé | Réf. employé |
| Filiale | Auto depuis le dossier employé |
| Type de contrat | CDI / CDD / Stage |
| Date de début | Obligatoire |
| Date de fin | Obligatoire pour CDD/Stage, vide pour CDI |
| Durée | Calculée (CDD/Stage) |
| Poste / fonction | Lien module Postes |
| Salaire de base et éléments contractuels | Lien module Paie |
| Période d'essai | Durée, date de fin |
| Statut | BROUILLON, SIGNE, ACTIF, RENOUVELE, EXPIRE, ROMPU, TERMINE |
| Document PDF | Généré à partir d'un modèle par type de contrat |

### 3.2 Spécificités par type

| Type | Particularités |
|---|---|
| CDI | Pas de date de fin, période d'essai selon catégorie |
| CDD | Date de fin obligatoire, nombre de renouvellements suivi, durée max légale à confirmer (cf. section 8) |
| Stage | Convention de stage, tuteur interne, établissement d'origine, indemnité de stage (régime social distinct à confirmer) |

### 3.3 Renouvellement

- Un renouvellement crée un nouvel enregistrement `Contrat` lié au précédent via `contrat_precedent_id`.
- Le contrat précédent passe au statut RENOUVELE.
- Compteur `nb_renouvellements` incrémenté sur la chaîne de contrats de l'employé.

### 3.4 Expiration et alertes

| Fonction | Détail |
|---|---|
| Détection automatique | Contrats CDD/Stage dont `date_fin` approche |
| Seuils d'alerte | 90 / 60 / 30 jours avant échéance (paramétrable) |
| Notification | RH Filiale + DRH Holding |
| Action à l'échéance sans renouvellement | Statut auto-basculé à EXPIRE, dossier employé mis à jour |

### 3.5 Rupture anticipée

| Champ | Détail |
|---|---|
| Date de rupture | Obligatoire |
| Motif | Démission, licenciement, rupture d'un commun accord, faute grave, etc. (liste à confirmer selon droit du travail burkinabè) |
| Préavis respecté | Oui/Non, durée |
| Document de solde de tout compte | Généré, lié à Archivage |

### 3.6 Historique

Vue chronologique de tous les contrats successifs d'un employé (chaîne complète via `contrat_precedent_id`), consultable depuis le dossier employé ou ce module.

## 4. Workflow

| Étape | Statut | Acteur |
|---|---|---|
| Rédaction | BROUILLON | RH Filiale |
| Génération PDF et signature (upload scan ou signature électronique — cf. section 8) | SIGNE | RH Filiale |
| Prise d'effet à la date de début | ACTIF | Système (automatique) |
| Selon issue | RENOUVELE / EXPIRE / ROMPU / TERMINE | RH Filiale / DRH / Système |

## 5. Modèle de données

| Entité | Attributs clés | Relations |
|---|---|---|
| `Contrat` | id, employe_id, type, date_debut, date_fin, duree_essai, fonction_id, salaire_base, statut, contrat_precedent_id, nb_renouvellements, motif_rupture, date_rupture, pdf_url | → Employe, Fonction, Contrat (précédent) |
| `ModeleContrat` | id, type, contenu_template | — |

## 6. Exemple concret

**Entrée** : CDD de Fatima Kaboré, du 01/03/2026 au 28/02/2027, poste Assistante RH, AMP Holding (siège).

**Sortie** : contrat créé au statut BROUILLON → PDF généré → SIGNE → passage automatique à ACTIF le 01/03/2026 → alerte envoyée à RH Filiale le 01/12/2026 (J-90 avant l'échéance du 28/02/2027).

## 7. Points à clarifier

| Point | Pourquoi c'est bloquant |
|---|---|
| Durée maximale légale d'un CDD et nombre maximal de renouvellements (droit du travail burkinabè) | Nécessaire pour bloquer/avertir en cas de dépassement |
| Délai légal de préavis de rupture selon ancienneté/catégorie | Nécessaire pour le contrôle de rupture |
| Signature électronique requise ou simple upload de scan signé ? | Impacte le workflow (intégration éventuelle d'un prestataire de signature) |
| Régime social du stagiaire (cotisations applicables ou non) | Impacte l'interface avec le module Paie |
| Liste exhaustive des motifs de rupture à proposer dans le formulaire | Nécessaire pour la conformité du document de solde de tout compte |
