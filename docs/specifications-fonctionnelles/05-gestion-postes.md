# Spécifications fonctionnelles — Module Gestion des postes

## 1. Objectif et périmètre

Gérer la structure organisationnelle du groupe (filiales, départements, services, fonctions) et produire l'organigramme dynamique utilisé par les autres modules (Employés, Contrats, Congés, Tableaux de bord).

## 2. Acteurs et droits (RBAC)

| Rôle | Droits sur ce module |
|---|---|
| Employé | Consulter l'organigramme de son périmètre |
| Chef de service | Consulter l'organigramme de son service |
| RH Filiale | Créer/modifier départements, services, fonctions de sa filiale |
| DRH Holding | Créer/modifier la structure de l'ensemble du groupe (filiales incluses) |
| Super Admin | Tous droits |

## 3. Fonctionnalités détaillées

### 3.1 Départements

| Champ | Détail |
|---|---|
| Nom | Obligatoire |
| Filiale de rattachement | Obligatoire, un département appartient à une seule filiale |
| Responsable | Réf. employé, optionnel |

### 3.2 Services

| Champ | Détail |
|---|---|
| Nom | Obligatoire |
| Département de rattachement | Obligatoire, un service appartient à un seul département |
| Responsable (Chef de service) | Réf. employé |

### 3.3 Fonctions

| Champ | Détail |
|---|---|
| Intitulé | Obligatoire |
| Service de rattachement | Optionnel (une fonction peut être transverse) |
| Catégorie / grille | Lien module Paie |
| Description | Optionnelle |

### 3.4 Organigramme

| Fonction | Détail |
|---|---|
| Construction | Générée dynamiquement : Filiale > Département > Service > Fonction > Employé titulaire |
| Lien hiérarchique | Basé sur le champ `superieur_id` du dossier employé (module Employés) |
| Postes vacants | Affichés distinctement (fonction sans titulaire) — cf. section 5 |
| Export | PDF / image |
| Niveau d'accès | Filtré selon le rôle (service pour Chef de service, filiale pour RH Filiale, groupe pour DRH) |

## 4. Modèle de données

| Entité | Attributs clés | Relations |
|---|---|---|
| `Filiale` | id, nom, ville, pays | — |
| `Departement` | id, filiale_id, nom, responsable_id | → Filiale, Employe |
| `Service` | id, departement_id, nom, responsable_id | → Departement, Employe |
| `Fonction` | id, service_id (nullable), intitule, categorie, description | → Service |

## 5. Exemple concret

**Entrée** : Filiale « AMP Logistique » > Département « Exploitation » > Service « Transport » > Fonction « Chef de parc », occupée par l'employé Ibrahim Ouédraogo.

**Sortie** : l'organigramme affiche la chaîne complète ; si le poste « Chef de parc » devient vacant après le départ d'Ibrahim, il apparaît en surbrillance « poste vacant » jusqu'à réaffectation.

## 6. Points à clarifier

| Point | Pourquoi c'est bloquant |
|---|---|
| Faut-il afficher les postes vacants dans l'organigramme, et avec quel indicateur visuel ? | Impacte l'UX de l'organigramme |
| Rattachement matriciel possible (un employé avec deux lignes hiérarchiques, ex. fonctionnelle + opérationnelle) ? | Impacte le modèle relationnel `Employe.superieur_id` (actuellement 1 seul supérieur) |
| Une fonction peut-elle exister sans service (fonctions transverses groupe, ex. « DRH Holding ») ? | Impacte la contrainte `service_id` nullable déjà proposée — à confirmer |
