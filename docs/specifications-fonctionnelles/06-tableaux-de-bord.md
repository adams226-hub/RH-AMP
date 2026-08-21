# Spécifications fonctionnelles — Module Tableaux de bord

## 1. Objectif et périmètre

Fournir une vue synthétique et filtrable des indicateurs RH clés du groupe, à partir des données des autres modules (Employés, Contrats, Congés, Paie, Postes).

## 2. Acteurs et droits (RBAC)

| Rôle | Accès |
|---|---|
| Employé | Aucun accès (module réservé à l'encadrement) |
| Chef de service | Tableau de bord restreint à son équipe (effectif, congés) |
| RH Filiale | Tous les tableaux de bord filtrés sur sa filiale |
| DRH Holding | Tous les tableaux de bord en vue consolidée groupe, avec filtre par filiale |
| Super Admin | Idem DRH + configuration des indicateurs |

## 3. Tableaux de bord détaillés

| Tableau de bord | Indicateurs affichés | Filtres disponibles | Source de données |
|---|---|---|---|
| Effectif | Total actifs, répartition par filiale/sexe/tranche d'âge/ancienneté, entrées/sorties du mois | Période, filiale, département | Module Employés |
| Répartition par société | Effectif et masse salariale par filiale, graphique comparatif | Période | Modules Employés, Paie |
| Congés | Solde moyen, taux de prise, congés en cours, alertes soldes bientôt expirés | Période, filiale, service | Module Congés |
| Contrats | Répartition CDI/CDD/Stage, contrats arrivant à expiration (30/60/90j), taux de renouvellement | Filiale, type de contrat | Module Contrats |
| Masse salariale | Total mensuel/annuel, évolution, répartition par filiale/catégorie | Période, filiale | Module Paie |
| Statistiques RH | Turnover, ancienneté moyenne, pyramide des âges | Période, filiale | Modules Employés, Contrats |

## 4. Fonctionnalités transverses

| Fonction | Détail |
|---|---|
| Export | PDF et Excel pour chaque tableau de bord |
| Comparaison temporelle | N vs N-1 (à confirmer, cf. section 6) |
| Rafraîchissement des données | Temps réel vs calcul batch nocturne — à trancher selon volumétrie (cf. section 6) |
| Filtrage par périmètre RBAC | Automatique selon le rôle connecté (le DRH voit tout, la RH Filiale ne voit que sa filiale) |

## 5. Exemple concret

**Entrée** : DRH Holding consulte le tableau de bord « Masse salariale » filtré sur le 2ᵉ trimestre 2026, toutes filiales.

**Sortie** : graphique empilé par filiale, total groupe affiché, export Excel disponible en un clic, drill-down possible vers le détail par filiale.

## 6. Points à clarifier

| Point | Pourquoi c'est bloquant |
|---|---|
| Fréquence de rafraîchissement attendue (temps réel ou calcul nocturne) | Impacte l'architecture (vues matérialisées vs requêtes directes) |
| Besoin de comparaison N vs N-1 sur les indicateurs | Impacte le modèle de requêtage et l'historisation |
| Existence d'un budget masse salariale à suivre en écart | Nécessiterait une entité budgétaire non encore définie |
| Granularité de la pyramide des âges (tranches de 5 ans ? 10 ans ?) | Paramètre d'affichage à fixer |
