# Spécifications fonctionnelles — Module Gestion de la paie

## 1. Objectif et périmètre

Calculer et éditer la paie mensuelle des employés du groupe (salaire, primes, retenues, bulletin), conformément au droit fiscal/social burkinabè et aux règles validées pour AMP Holding.

## 2. Acteurs et droits (RBAC)

| Rôle | Droits sur ce module |
|---|---|
| Employé | Consulter/télécharger ses propres bulletins |
| Chef de service | Aucun accès (module non ouvert à ce rôle) |
| RH Filiale | Saisir/calculer la paie de sa filiale, générer les bulletins, consulter historique |
| DRH Holding | Mêmes droits sur l'ensemble du groupe, validation finale avant clôture de paie |
| Super Admin | Paramétrage des barèmes (IUTS, CNSS, TPA, FSP), grilles salariales, tous droits |

## 3. Composition du salaire

| Élément | Détail |
|---|---|
| Salaire de base | Selon grille par catégorie |
| Sursalaire | Libre, base de l'abattement forfaitaire |
| Indemnité de logement | Exonérée IUTS ≤ 20% du brut, plafond 75 000 F CFA/mois |
| Indemnité de transport | Exonérée ≤ 5% du brut, plafond 30 000 F CFA/mois |
| Indemnité de sujétion/astreinte | Exonérée ≤ 5% du brut, plafond 50 000 F CFA/mois (appréciée indemnité par indemnité, sans cumul) |
| Primes diverses | Configurable (ex. rendement, ancienneté) — imposabilité à définir par prime |

**Règle générale d'exonération** : pour chaque indemnité, le montant exonéré = le plus petit des 3 montants : (1) % du brut, (2) plafond F CFA, (3) montant réellement versé.

## 4. Fonctionnalités détaillées

### 4.1 Saisie / import des éléments variables de paie

| Champ | Détail |
|---|---|
| Employé | Réf. employé |
| Période de paie | Mois/année |
| Éléments fixes | Repris automatiquement du contrat (salaire de base, indemnités contractuelles) |
| Éléments variables | Heures supplémentaires (agrégées depuis le module Pointage, cf. section 4.4), primes ponctuelles, absences injustifiées (jours), avances/acomptes |
| Statut | BROUILLON → CALCULE → VALIDE → CLOTURE |

### 4.2 Calcul du bulletin

**Étapes de calcul (ordre)** :
1. Brut = salaire de base + sursalaire + indemnités + primes
2. Base imposable = brut − indemnités exonérées (dans les limites ci-dessus) − abattement forfaitaire frais professionnels (20 à 25% du (salaire de base + sursalaire + heures sup), taux selon catégorie)
3. IUTS (barème ci-dessous)
4. CNSS part salariale = 5,5% × (salaire de base + éléments assimilés), base plafonnée à 800 000 F CFA
5. FSP = 1% du salaire net
6. Salaire net = Brut − IUTS − CNSS salariale − FSP − autres retenues (avances, absences injustifiées)
7. Coût employeur = Brut + CNSS patronale (~16%, taux à reconfirmer) + TPA (3%)

**Barème IUTS** :

| Tranche (F CFA) | Taux | Cumul |
|---|---|---|
| 0 – 30 000 | 0% | 0 |
| 30 100 – 50 000 | 12,1% | 2 420 |
| 50 100 – 80 000 | 13,9% | 4 170 |
| 80 100 – 120 000 | 15,7% | 6 280 |
| 120 100 – 170 000 | 18,4% | 9 200 |
| 170 100 – 250 000 | 21,7% | 17 360 |
| 250 100 et + | 25% | — |
| Cumul jusqu'à 250 000 | | 39 430 |

Méthode : si base imposable ≤ 250 000 → montant cumulé de la tranche atteinte. Si > 250 000 → IUTS = 39 430 + 25% × (base imposable − 250 000).

### 4.3 Impact des absences injustifiées

`Salaire du mois = Salaire mensuel × (Jours du mois − Jours d'absence injustifiée) / Jours du mois`

Alimenté par le module Absences (hors périmètre du présent lot) — interface à définir (cf. section 7).

### 4.4 Source des heures supplémentaires (module Pointage)

Sur les chantiers, un Responsable RH Chantier saisit le pointage journalier (présence, heures travaillées, heures sup) — cf. module Pointage. En fin de mois, une fois les pointages validés, le total des heures sup par employé est répercuté automatiquement dans `elements_variables_paie` (type `heure_sup`) pour la période de paie correspondante. Pour les employés hors chantier (siège, bureaux), la saisie des heures sup reste manuelle par la RH Filiale (cf. 4.1).

### 4.5 Génération du bulletin de paie (PDF)

| Bloc du bulletin | Contenu |
|---|---|
| En-tête | Filiale, employé, matricule, catégorie, période |
| Gains | Détail brut ligne par ligne |
| Retenues | IUTS, CNSS, FSP, avances, absences |
| Net à payer | Montant final |
| Cumuls | Cumuls annuels (brut, net, IUTS, CNSS) |
| Mentions légales | Selon droit du travail burkinabè |

## 5. Workflow de clôture de paie

| Étape | Statut | Acteur |
|---|---|---|
| Saisie éléments variables | BROUILLON | RH Filiale |
| Calcul automatique | CALCULE | Système |
| Contrôle et validation | VALIDE | RH Filiale |
| Validation finale groupe | VALIDE_DRH | DRH Holding |
| Clôture (verrouillage, génération bulletins) | CLOTURE | DRH Holding |

## 6. Modèle de données

| Entité | Attributs clés | Relations |
|---|---|---|
| `BulletinPaie` | id, employe_id, periode, brut, base_imposable, iuts, cnss_salariale, fsp, autres_retenues, net_a_payer, cout_employeur, statut, pdf_url | → Employe |
| `ElementVariablePaie` | id, employe_id, periode, type (heure_sup, prime, avance, absence_injustifiee), montant_ou_jours | → Employe |
| `GrilleSalariale` | id, categorie, salaire_base_min, salaire_base_max | — |
| `ParametrePaie` | id, cle (taux_cnss_patronale, taux_tpa, taux_fsp, taux_abattement...), valeur, date_effet | — (paramétrable, non codé en dur) |

## 7. Exemple concret

**Entrée** : Employé Ibrahim Ouédraogo, salaire de base 200 000, sursalaire 50 000, indemnité logement 40 000, indemnité transport 25 000, aucune absence.

**Calcul** :
- Brut = 200 000 + 50 000 + 40 000 + 25 000 = 315 000
- Indemnité logement exonérée = min(20% × 315 000 = 63 000 ; 75 000 ; 40 000) = 40 000 (entièrement exonérée)
- Indemnité transport exonérée = min(5% × 315 000 = 15 750 ; 30 000 ; 25 000) = 15 750 → partie imposable = 9 250
- Abattement forfaitaire (ex. 20%) sur (200 000 + 50 000) = 50 000
- Base imposable = 315 000 − 40 000 − 15 750 − 50 000 = 209 250
- IUTS (tranche 170 100–250 000) = 9 200 + 18,4% × (209 250 − 170 000) = 9 200 + 7 222 = 16 422
- CNSS salariale = 5,5% × 200 000 = 11 000
- FSP = 1% × net avant FSP (à préciser, cf. section 8)

**Sortie** : bulletin PDF généré, net à payer calculé, statut CLOTURE après validation DRH.

## 8. Points à clarifier

| Point | Pourquoi c'est bloquant |
|---|---|
| Taux CNSS part patronale (~16%) à reconfirmer officiellement | Impacte le coût employeur, actuellement marqué approximatif |
| Assiette exacte du FSP (net avant ou après quelles retenues ?) | Ordre de calcul du net à payer |
| Taux de majoration des heures supplémentaires et plafond légal (la source des heures — module Pointage — est désormais clarifiée, cf. 4.4) | Nécessaire pour convertir des heures en montant valorisé |
| Nombre de catégories/échelons de la grille salariale AMP Holding | Nécessaire pour modéliser `GrilleSalariale` |
| Gestion des acomptes/avances sur salaire (plafond, remboursement échelonné ?) | Impacte le calcul des retenues |
| Interface exacte avec le module Absences pour les jours d'absence injustifiée | Nécessaire pour automatiser le calcul |
