# Spécifications fonctionnelles — Module Gestion des employés

## 1. Objectif et périmètre

Constituer et maintenir le dossier numérique de chaque employé du groupe : informations personnelles, professionnelles, et documents rattachés (en lien avec le module Archivage pour le stockage physique des fichiers).

## 2. Acteurs et droits (RBAC)

| Rôle | Droits sur ce module |
|---|---|
| Employé | Consulter son propre dossier, modifier certains champs personnels (adresse, téléphone, contact urgence), déposer des documents |
| Chef de service | Consulter les dossiers (lecture seule) des employés de son équipe |
| RH Filiale | Créer/modifier/consulter les dossiers de sa filiale, valider les modifications employé |
| DRH Holding | Mêmes droits sur l'ensemble du groupe |
| Super Admin | Tous droits, configuration des champs/catégories |

## 3. Fonctionnalités détaillées

### 3.1 Informations personnelles

| Champ | Détail |
|---|---|
| Nom, prénom(s) | Obligatoire |
| Date et lieu de naissance | Obligatoire |
| Sexe | Obligatoire |
| Nationalité | Obligatoire |
| Situation matrimoniale | Optionnel |
| Nombre d'enfants à charge | Optionnel (utile pour la paie/mutuelle si applicable) |
| Adresse | Optionnel |
| Téléphone(s) | Obligatoire (au moins un) |
| Email personnel | Optionnel |
| Contact d'urgence | Nom, lien, téléphone |
| N° CNIB / passeport | Obligatoire |
| N° CNSS | Obligatoire (nécessaire pour la paie) |
| Coordonnées bancaires (RIB) | Obligatoire pour le virement de salaire |

### 3.2 Informations professionnelles

| Champ | Détail |
|---|---|
| Matricule | Généré automatiquement (format à définir, cf. section 6) |
| Filiale / Département / Service / Fonction | Rattachement, lien module Postes |
| Catégorie / échelon | Lien grille salariale (module Paie) |
| Date d'embauche | Obligatoire |
| Type de contrat en cours | Lien module Contrats |
| Statut du dossier | EN_COURS_CREATION, ACTIF, SUSPENDU, SORTI |
| Supérieur hiérarchique | Réf. employé |
| Site de travail | Optionnel |
| Date et motif de sortie | Renseigné à la sortie de l'employé |

### 3.3 Documents du dossier

| Champ | Détail |
|---|---|
| Catégorie | CNIB, diplôme, certificat, photo, CV, RIB, autre justificatif |
| Fichier | Stocké via le module Archivage (Supabase Storage) |
| Date d'expiration | Optionnelle (ex. CNIB, permis) |
| Statut | VALIDE / EXPIRE / A_RENOUVELER |

Ce sous-module est une vue filtrée (par employé) du référentiel documentaire central géré par le module **Archivage documentaire** — voir ce module pour les règles de rétention, versionning et confidentialité.

## 4. Workflow du dossier employé

| Étape | Statut | Acteur |
|---|---|---|
| Création du dossier | EN_COURS_CREATION | RH Filiale / DRH |
| Complétion des informations obligatoires | EN_COURS_CREATION | RH Filiale + Employé |
| Activation (toutes infos obligatoires renseignées + premier contrat créé) | ACTIF | RH Filiale |
| Suspension (ex. congé longue durée, procédure disciplinaire) | SUSPENDU | RH Filiale / DRH |
| Sortie définitive | SORTI | RH Filiale / DRH |

## 5. Modèle de données

| Entité | Attributs clés | Relations |
|---|---|---|
| `Employe` | id, matricule, nom, prenoms, date_naissance, lieu_naissance, sexe, nationalite, situation_matrimoniale, nb_enfants, adresse, telephone, email_perso, contact_urgence, num_cnib, num_cnss, rib, filiale_id, departement_id, service_id, fonction_id, superieur_id, date_embauche, statut, date_sortie, motif_sortie | → Filiale, Departement, Service, Fonction, Employe (superieur) |
| `DocumentEmploye` | id, employe_id, categorie, document_id (→ Archivage), date_expiration, statut | → Employe, Document |

## 6. Exemple concret

**Entrée** : création du dossier de Ibrahim Ouédraogo, embauché le 01/09/2026 à AMP Logistique, poste Chef de parc.

**Sortie** : matricule généré `AMP-2026-0143`, statut EN_COURS_CREATION jusqu'à ce que CNIB, CNSS, RIB et contrat soient renseignés, puis passage automatique à ACTIF.

## 7. Points à clarifier

| Point | Pourquoi c'est bloquant |
|---|---|
| Format exact du matricule (préfixe filiale ? séquence par filiale ou groupe ?) | Nécessaire pour la génération automatique |
| Liste exhaustive des champs obligatoires vs optionnels à la création | Conditionne le passage EN_COURS_CREATION → ACTIF |
| Conformité à la loi burkinabè n°010-2004/AN sur la protection des données à caractère personnel (consentement, durée de conservation, droit à l'effacement) | Impacte le modèle de données et les droits d'accès |
| Un employé peut-il être rattaché à plusieurs filiales simultanément (détachement) ? | Impacte le modèle relationnel `Employe` ↔ `Filiale` |
| Quota de stockage documents par employé/filiale | Dimensionnement Supabase Storage |
