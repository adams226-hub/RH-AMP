# Spécifications fonctionnelles — Module Archivage documentaire

## 1. Objectif et périmètre

Constituer le référentiel documentaire central du SIRH (GED), stockant tous les fichiers du groupe — contrats, CNIB, diplômes, certificats, permis, documents administratifs, bulletins — avec métadonnées, recherche, règles de rétention et contrôle d'accès. Ce module est consommé par les modules Employés, Contrats et Paie, qui en affichent des vues filtrées.

## 2. Frontière avec le module Employés

Le sous-module « Documents » du dossier employé (module Gestion des employés) est une **vue filtrée par employé** de ce référentiel. L'archivage documentaire est la couche de stockage, de classement et de gouvernance transverse ; il ne duplique pas les données, il les héberge.

## 3. Acteurs et droits (RBAC)

| Rôle | Droits sur ce module |
|---|---|
| Employé | Consulter/déposer uniquement ses propres documents |
| Chef de service | Aucun accès direct |
| RH Filiale | Gérer les documents de sa filiale (employés + documents société) |
| DRH Holding | Gérer les documents de l'ensemble du groupe |
| Super Admin | Tous droits, configuration des règles de rétention et catégories |

## 4. Fonctionnalités détaillées

### 4.1 Dépôt de document

| Champ | Détail |
|---|---|
| Catégorie | Contrat, CNIB, Diplôme, Certificat, Permis, Document administratif, Bulletin de paie, Autre |
| Employé rattaché | Optionnel (document société non lié à un employé, ex. politique interne) |
| Fichier | Formats acceptés : PDF, JPG, PNG (à confirmer, cf. section 7), taille max à définir |
| Date d'expiration | Optionnelle (CNIB, permis de conduire, habilitation) |
| Confidentialité | Standard / Restreinte (ex. dossier disciplinaire) |
| Tags de recherche | Libres, optionnels |

### 4.2 Classement et recherche

| Fonction | Détail |
|---|---|
| Classement automatique | Par catégorie et par employé/filiale |
| Recherche | Par nom d'employé, catégorie, filiale, date, tag |
| Filtres | Statut (valide/expiré/à renouveler), confidentialité |

### 4.3 Alertes d'expiration

Génère des notifications RH pour tout document à date d'expiration approchante (CNIB, permis de conduire — en lien avec le module Santé et sécurité pour les habilitations), selon les mêmes seuils paramétrables que le module Contrats (30/60/90 jours).

### 4.4 Versionning

Le remplacement d'un document existant crée une nouvelle version ; l'historique des versions précédentes est conservé et consultable (traçabilité).

### 4.5 Corbeille et purge

| Étape | Détail |
|---|---|
| Suppression | Déplacement en corbeille (soft delete), non supprimé physiquement |
| Rétention en corbeille | Durée paramétrable avant purge définitive |
| Purge définitive | Suppression physique du fichier (Supabase Storage) + métadonnées |

## 5. Modèle de données

| Entité | Attributs clés | Relations |
|---|---|---|
| `Document` | id, categorie, employe_id (nullable), filiale_id, fichier_url, nom_original, type_mime, taille, date_upload, uploaded_by, date_expiration, statut, confidentialite, version, document_parent_id (nullable), corbeille (bool), date_purge_prevue | → Employe, Filiale, Utilisateur, Document (version précédente) |
| `TagDocument` | document_id, tag | → Document |

## 6. Exemple concret

**Entrée** : la RH Filiale dépose la CNIB de Fatima Kaboré, date d'expiration 15/03/2027.

**Sortie** : document classé sous catégorie « CNIB », rattaché à l'employée, visible dans son dossier (module Employés) ; une alerte est générée automatiquement à J-90 avant expiration (soit le 15/12/2026).

## 7. Points à clarifier

| Point | Pourquoi c'est bloquant |
|---|---|
| Durée légale de conservation par type de document (droit burkinabè, ex. bulletins de paie, contrats après rupture) | Nécessaire pour paramétrer les règles de rétention/purge |
| Formats de fichiers acceptés et taille maximale par upload | Dimensionnement Supabase Storage et validation formulaire |
| Chiffrement au repos requis pour les documents sensibles (CNIB, dossiers disciplinaires) | Impacte la configuration Supabase Storage |
| Quota de stockage par filiale/groupe | Dimensionnement et coûts d'infrastructure |
| Processus de suppression sur demande (droit à l'effacement, loi n°010-2004/AN) | Impacte le workflow de corbeille/purge |
