-- ============================================================================
-- SIRH AMP Holding — Schéma PostgreSQL (Supabase)
-- Périmètre : modules Employés, Contrats, Congés, Pointage, Paie, Postes,
--             Tableaux de bord (vues, non tables), Utilisateurs, Archivage.
-- Hors périmètre (non modélisé ici) : Évaluation du personnel, Santé et sécurité.
-- Voir docs/specifications-fonctionnelles/ pour le détail fonctionnel de chaque table.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE code_role AS ENUM ('super_admin', 'drh_holding', 'rh_filiale', 'chef_service', 'employe', 'responsable_rh_chantier');
CREATE TYPE statut_utilisateur AS ENUM ('actif', 'suspendu', 'supprime');

CREATE TYPE statut_employe AS ENUM ('en_cours_creation', 'actif', 'suspendu', 'sorti');

CREATE TYPE type_contrat AS ENUM ('cdi', 'cdd', 'stage');
CREATE TYPE statut_contrat AS ENUM ('brouillon', 'signe', 'actif', 'renouvele', 'expire', 'rompu', 'termine');

CREATE TYPE statut_demande_conge AS ENUM ('brouillon', 'soumise', 'avis_favorable', 'avis_defavorable', 'validee_rh', 'rejetee_rh', 'annulee');

CREATE TYPE statut_bulletin AS ENUM ('brouillon', 'calcule', 'valide', 'valide_drh', 'cloture');

-- Pilote le mois de paie entier pour une filiale (ADDENDUM_JOURNAL_PAIE_AMP.md) — distinct de
-- statut_bulletin qui reste la trace individuelle par employé, cf. commentaire cycles_paie.
CREATE TYPE statut_cycle_paie AS ENUM ('ouvert', 'calcule', 'verifie', 'exporte', 'cloture');
-- 'panier' distinct de 'prime' générique : la prime de panier est exclue de l'assiette
-- CNSS (cf. moteur de paie "port fidèle Excel"), contrairement aux autres primes.
-- 'heure_sup' (montant forfaitaire global) reste défini mais n'est plus alimenté depuis la
-- refonte du module Pointage — remplacé par 'heure_sup_15/35/50/60/120' (heures, pas F CFA :
-- stockées dans la colonne `montant` par réutilisation de la structure existante), qui
-- correspondent aux 5 paliers du moteur de paie. Seuls 15/35/60 viennent du Pointage
-- (chantier) ; 50/120 restent des cas exceptionnels saisis à la main dans Éléments du mois.
CREATE TYPE type_element_variable AS ENUM (
    'heure_sup', 'prime', 'avance', 'absence_injustifiee', 'panier', 'reliquat', 'trop_percu',
    'heure_sup_15', 'heure_sup_35', 'heure_sup_50', 'heure_sup_60', 'heure_sup_120',
    'prime_salissure', 'prime_lait'
);

CREATE TYPE categorie_document AS ENUM ('contrat', 'cnib', 'diplome', 'certificat', 'permis', 'document_administratif', 'bulletin_paie', 'autre');
CREATE TYPE statut_document AS ENUM ('valide', 'expire', 'a_renouveler');
CREATE TYPE confidentialite_document AS ENUM ('standard', 'restreinte');

CREATE TYPE statut_pointage AS ENUM ('saisi', 'valide');

-- ============================================================================
-- 1. STRUCTURE ORGANISATIONNELLE (module Postes)
-- ============================================================================

-- actif = soft delete (même principe que departements/services/fonctions, cf. module Postes) —
-- gérée depuis Paramètres > Référentiels. adresse/rccm/ifu/telephone/site_web : coordonnées
-- légales affichées en pied de bulletin de paie — une valeur par filiale (entités juridiques
-- distinctes), pas une seule pour le groupe.
CREATE TABLE filiales (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom         TEXT NOT NULL,
    ville       TEXT,
    pays        TEXT NOT NULL DEFAULT 'Burkina Faso',
    adresse     TEXT,
    rccm        TEXT,
    ifu         TEXT,
    telephone   TEXT,
    site_web    TEXT,
    logo_url    TEXT, -- chemin dans le bucket Supabase Storage "logos" (pas d'URL publique — logo
                       -- récupéré côté serveur pour être incorporé dans le PDF du bulletin)
    couleur_accent  TEXT, -- hex ('#RRGGBB'), couleur dominante du logo — bandeau/pied de page des
                           -- attestations (cf. attestations.pdf.ts) ; NULL = gris neutre par défaut
    actif       BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Remplace l'ancien ENUM categorie_professionnelle (figé, non éditable) — table gérée depuis
-- Paramètres > Référentiels. est_cadre pilote directement l'abattement forfaitaire IUTS (20% si
-- true / cadre, 25% si false / non-cadre) : le moteur de paie (paie.ts) lit ce champ au
-- lieu de tester la chaîne "cadre" en dur. employes.categorie_professionnelle référence `code`
-- (pas `id`) pour rester une simple colonne TEXT, sans changer sa nature dans les autres modules
-- qui la lisent déjà (cyclesPaie, tableauxDeBord, pointage.pdf) sans jointure.
CREATE TABLE categories_professionnelles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT NOT NULL UNIQUE,
    libelle     TEXT NOT NULL,
    est_cadre   BOOLEAN NOT NULL,
    actif       BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO categories_professionnelles (code, libelle, est_cadre) VALUES
    ('ouvrier', 'Ouvrier', false),
    ('employe', 'Employé', false),
    ('agent_maitrise', 'Agent de maîtrise', false),
    ('cadre', 'Cadre', true);

-- Données de référence : filiales confirmées du groupe.
-- Libellés exacts (accents, dénomination officielle) à valider avant mise en production.
-- Noms provisoires posés au démarrage du projet, jamais corrigés en masse (chantiers et
-- employés existants restent rattachés dessus) — cf. ADDENDUM_JOURNAL_PAIE_AMP.md qui a
-- révélé les vrais noms juridiques ci-dessous, désormais ajoutés à côté.
INSERT INTO filiales (nom) VALUES
    ('Holding'),
    ('AMP Béton'),
    ('ROMBAT'),
    ('Transport'),
    ('Administration');

-- Vrais noms juridiques du groupe (ADDENDUM_JOURNAL_PAIE_AMP.md §3, colonne "Entreprise" du
-- Journal de Paie réel) — ROMBAT existait déjà en doublon exact, non réinséré.
INSERT INTO filiales (nom) VALUES
    ('AMP'),
    ('AIS'),
    ('AMP_CENTER'),
    ('AMP_TL'),
    ('TIAKANE MINING');

-- actif = soft delete : un département archivé (actif=false) disparaît des listes de sélection
-- pour les nouvelles fiches, mais reste intact pour les employés/documents qui le référencent déjà.
-- Archivage réservé à super_admin (cf. Postes) ; le renommage reste ouvert à gestionnairesStructure.
CREATE TABLE departements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filiale_id      UUID NOT NULL REFERENCES filiales(id) ON DELETE RESTRICT,
    nom             TEXT NOT NULL,
    actif           BOOLEAN NOT NULL DEFAULT true,
    responsable_id  UUID, -- FK vers employes ajoutée après création de la table employes (référence circulaire)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (filiale_id, nom)
);

-- Visibilité en cascade PUREMENT logicielle : un service dont le département parent est archivé
-- doit disparaître des listes de sélection sans que services.actif soit lui-même modifié (cf.
-- décision produit) — le calcul se fait à la lecture (service.actif AND departement.actif), jamais
-- en écrivant sur la ligne enfant.
CREATE TABLE services (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    departement_id  UUID NOT NULL REFERENCES departements(id) ON DELETE RESTRICT,
    nom             TEXT NOT NULL,
    actif           BOOLEAN NOT NULL DEFAULT true,
    responsable_id  UUID, -- FK vers employes ajoutée plus bas
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (departement_id, nom)
);

-- Référentiel PLAT, partagé à l'échelle du groupe (toutes filiales confondues) — un intitulé comme
-- "MANŒUVRE" ou "CHAUFFEUR VL" se répète identique sur plusieurs chantiers/filiales, le dupliquer
-- par filiale compliquerait les statistiques RH transverses. Plus de lien vers services : jamais
-- de cascade de visibilité au-dessus de ce niveau. Le champ "categorie" (texte libre, jamais câblé
-- à aucun calcul de paie) a été retiré pour ne pas laisser croire à un lien avec
-- employes.categorie_professionnelle, qui seul pilote l'abattement forfaitaire IUTS.
CREATE TABLE fonctions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intitule     TEXT NOT NULL,
    actif        BOOLEAN NOT NULL DEFAULT true,
    description  TEXT
);

-- Unicité insensible à la casse : 0 doublon trouvé en base au moment de l'appliquer (revue
-- manuelle demandée avant coup, cf. décision produit — rien à fusionner).
CREATE UNIQUE INDEX idx_fonctions_intitule_unique ON fonctions (lower(intitule));

-- Chantier : site opérationnel (BTP/transport) distinct de la structure services/départements,
-- rattaché à une filiale, où le pointage est saisi par un Responsable RH Chantier.
CREATE TABLE chantiers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filiale_id      UUID NOT NULL REFERENCES filiales(id) ON DELETE RESTRICT,
    nom             TEXT NOT NULL,
    localisation    TEXT,
    responsable_id  UUID, -- Responsable RH Chantier ; FK vers employes ajoutée plus bas
    actif           BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (filiale_id, nom)
);

-- ============================================================================
-- 2. UTILISATEURS ET RÔLES (module Utilisateurs)
-- ============================================================================

CREATE TABLE roles (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code    code_role NOT NULL UNIQUE,
    libelle TEXT NOT NULL
);

INSERT INTO roles (code, libelle) VALUES
    ('super_admin', 'Super Admin'),
    ('drh_holding', 'DRH Holding'),
    ('rh_filiale', 'RH Filiale'),
    ('chef_service', 'Chef de service'),
    ('employe', 'Employé'),
    ('responsable_rh_chantier', 'Responsable RH Chantier');

CREATE TABLE utilisateurs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employe_id          UUID, -- nullable (compte technique non lié à un dossier employé) ; FK ajoutée plus bas
    email               TEXT NOT NULL UNIQUE,
    mot_de_passe_hash   TEXT NOT NULL,
    role_id             UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    statut              statut_utilisateur NOT NULL DEFAULT 'actif',
    derniere_connexion  TIMESTAMPTZ,
    mfa_active          BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table de liaison : un utilisateur RH Filiale peut être rattaché à plusieurs filiales
CREATE TABLE utilisateurs_filiales (
    utilisateur_id  UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    filiale_id      UUID NOT NULL REFERENCES filiales(id) ON DELETE CASCADE,
    PRIMARY KEY (utilisateur_id, filiale_id)
);

-- Table de liaison : un Responsable RH Chantier peut être rattaché à plusieurs chantiers
-- (périmètre plus fin que utilisateurs_filiales, qui donnerait accès à toute la filiale)
CREATE TABLE utilisateurs_chantiers (
    utilisateur_id  UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    chantier_id     UUID NOT NULL REFERENCES chantiers(id) ON DELETE CASCADE,
    PRIMARY KEY (utilisateur_id, chantier_id)
);

-- ============================================================================
-- 3. EMPLOYÉS (module Employés)
-- ============================================================================

CREATE TABLE employes (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matricule             TEXT NOT NULL UNIQUE, -- format de génération à confirmer, cf. specs module Employés §7
    nom                   TEXT NOT NULL,
    prenoms               TEXT NOT NULL,
    date_naissance        DATE NOT NULL,
    lieu_naissance        TEXT,
    sexe                  TEXT NOT NULL CHECK (sexe IN ('M', 'F')),
    nationalite           TEXT NOT NULL,
    situation_matrimoniale TEXT,
    nb_enfants            INTEGER NOT NULL DEFAULT 0,
    adresse               TEXT,
    telephone             TEXT NOT NULL,
    email_perso           TEXT,
    contact_urgence_nom   TEXT,
    contact_urgence_lien  TEXT,
    contact_urgence_tel   TEXT,
    num_cnib              TEXT NOT NULL,
    num_cnss              TEXT NOT NULL,
    rib                   TEXT, -- sert aussi de "N° de compte" sur le bulletin de paie
    banque                TEXT,
    mode_paiement         TEXT, -- libre (espèces/virement/chèque...), non contraint : valeurs non confirmées
    personnes_a_charge    INTEGER NOT NULL DEFAULT 0, -- pour l'abattement IUTS charges familiales, cf. moteur de paie
    categorie_professionnelle  TEXT REFERENCES categories_professionnelles(code) ON DELETE SET NULL, -- nullable

    filiale_id      UUID NOT NULL REFERENCES filiales(id) ON DELETE RESTRICT,
    departement_id  UUID REFERENCES departements(id) ON DELETE SET NULL,
    service_id      UUID REFERENCES services(id) ON DELETE SET NULL,
    fonction_id     UUID REFERENCES fonctions(id) ON DELETE SET NULL,
    superieur_id    UUID REFERENCES employes(id) ON DELETE SET NULL, -- auto-référence, un seul supérieur (pas de matriciel — cf. specs Postes §6)
    chantier_id     UUID REFERENCES chantiers(id) ON DELETE SET NULL, -- lieu d'affectation par défaut (Journal de Paie)
    -- Pilote le blocage de paie tant que le pointage du mois n'est pas validé (paie.ts). Indépendant
    -- de chantier_id (qui n'est qu'une localisation) et de la présence d'un contrat : un employé
    -- sans contrat, payé hors SIRH (main à main / Orange Money), peut très bien être pointé quand
    -- même — décision RH explicite par employé, jamais déduite d'un autre champ. Défaut à false
    -- pour ne bloquer personne tant que le RH n'a pas coché la case lui-même.
    soumis_pointage BOOLEAN NOT NULL DEFAULT false,

    date_embauche   DATE NOT NULL,
    statut          statut_employe NOT NULL DEFAULT 'en_cours_creation',
    date_sortie     DATE,
    motif_sortie    TEXT,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (date_sortie IS NULL OR date_sortie >= date_embauche)
);

CREATE INDEX idx_employes_filiale ON employes(filiale_id);
CREATE INDEX idx_employes_statut ON employes(statut);

-- Résolution des références circulaires déclarées plus haut
ALTER TABLE departements ADD CONSTRAINT fk_departement_responsable FOREIGN KEY (responsable_id) REFERENCES employes(id) ON DELETE SET NULL;
ALTER TABLE services ADD CONSTRAINT fk_service_responsable FOREIGN KEY (responsable_id) REFERENCES employes(id) ON DELETE SET NULL;
ALTER TABLE chantiers ADD CONSTRAINT fk_chantier_responsable FOREIGN KEY (responsable_id) REFERENCES employes(id) ON DELETE SET NULL;
ALTER TABLE utilisateurs ADD CONSTRAINT fk_utilisateur_employe FOREIGN KEY (employe_id) REFERENCES employes(id) ON DELETE SET NULL;

-- ============================================================================
-- 4. CONTRATS (module Contrats)
-- ============================================================================

CREATE TABLE modeles_contrat (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type        type_contrat NOT NULL,
    contenu_template  TEXT NOT NULL
);

CREATE TABLE contrats (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employe_id            UUID NOT NULL REFERENCES employes(id) ON DELETE RESTRICT,
    type                  type_contrat NOT NULL,
    date_debut            DATE NOT NULL,
    date_fin              DATE, -- obligatoire pour cdd/stage, imposé par contrainte ci-dessous
    duree_essai_jours     INTEGER,
    fin_periode_essai     DATE,
    fonction_id           UUID REFERENCES fonctions(id) ON DELETE SET NULL,
    salaire_base          NUMERIC(12,2) NOT NULL CHECK (salaire_base >= 0),
    -- Composantes de rémunération mensuelles nominales, persistantes (comme salaire_base)
    -- pour que le calcul de paie — y compris en masse — s'applique sans ressaisie mensuelle.
    sursalaire            NUMERIC(12,2) NOT NULL DEFAULT 0,
    indemnite_logement    NUMERIC(12,2) NOT NULL DEFAULT 0,
    indemnite_transport   NUMERIC(12,2) NOT NULL DEFAULT 0,
    indemnite_fonction    NUMERIC(12,2) NOT NULL DEFAULT 0,
    indemnite_sujetion    NUMERIC(12,2) NOT NULL DEFAULT 0,
    indemnite_astreinte   NUMERIC(12,2) NOT NULL DEFAULT 0,
    statut                statut_contrat NOT NULL DEFAULT 'brouillon',
    contrat_precedent_id  UUID REFERENCES contrats(id) ON DELETE SET NULL, -- chaîne d'historique/renouvellement
    nb_renouvellements    INTEGER NOT NULL DEFAULT 0,
    motif_rupture         TEXT,
    date_rupture          DATE,
    pdf_url               TEXT,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (type = 'cdi' OR date_fin IS NOT NULL),
    CHECK (date_fin IS NULL OR date_fin >= date_debut)
);

CREATE INDEX idx_contrats_employe ON contrats(employe_id);
CREATE INDEX idx_contrats_statut_date_fin ON contrats(statut, date_fin); -- alertes d'expiration

-- ============================================================================
-- 5. CONGÉS (module Congés)
-- ============================================================================

CREATE TABLE jours_feries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date        DATE NOT NULL,
    libelle     TEXT NOT NULL,
    filiale_id  UUID REFERENCES filiales(id) ON DELETE CASCADE, -- NULL = férié national applicable à toutes les filiales
    UNIQUE (date, filiale_id)
);

CREATE TABLE soldes_conges (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employe_id        UUID NOT NULL REFERENCES employes(id) ON DELETE CASCADE,
    annee             INTEGER NOT NULL,
    solde_initial     NUMERIC(5,2) NOT NULL DEFAULT 0, -- report de l'année N-1
    jours_acquis      NUMERIC(5,2) NOT NULL DEFAULT 0, -- 30 j/an — méthode d'acquisition à confirmer, cf. specs Congés §7
    jours_consommes   NUMERIC(5,2) NOT NULL DEFAULT 0,
    jours_deduits     NUMERIC(5,2) NOT NULL DEFAULT 0, -- alimenté par le module Absences (hors périmètre)
    solde_disponible  NUMERIC(5,2) GENERATED ALWAYS AS (solde_initial + jours_acquis - jours_consommes - jours_deduits) STORED,
    UNIQUE (employe_id, annee)
);

CREATE TABLE demandes_conges (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employe_id              UUID NOT NULL REFERENCES employes(id) ON DELETE CASCADE,
    date_debut              DATE NOT NULL,
    date_fin                DATE NOT NULL,
    nb_jours                NUMERIC(5,2) NOT NULL, -- calculé côté application (jours ouvrés, hors jours_feries)
    motif                   TEXT,
    statut                  statut_demande_conge NOT NULL DEFAULT 'brouillon',
    avis_hierarchique       TEXT CHECK (avis_hierarchique IN ('favorable', 'defavorable')),
    commentaire_hierarchique TEXT,
    decision_rh             TEXT CHECK (decision_rh IN ('validee', 'rejetee')),
    commentaire_rh           TEXT,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (date_fin >= date_debut)
);

CREATE INDEX idx_demandes_conges_employe ON demandes_conges(employe_id);
CREATE INDEX idx_demandes_conges_statut ON demandes_conges(statut);

-- ============================================================================
-- 5bis. ABSENCES — permissions exceptionnelles et absences hors barème
-- (Note de service N°RH 013/DAF/2026 du 03/08/2026)
-- ============================================================================

CREATE TYPE type_demande_absence AS ENUM ('permission_exceptionnelle', 'absence_hors_bareme');
CREATE TYPE classification_absence AS ENUM ('non_deductible', 'deductible_conge', 'sans_solde');

-- Pool annuel des permissions exceptionnelles : 20 j/an, non cumulable (remis à 20 chaque
-- année, aucun report du reliquat non consommé) — cf. note de service, distinct de soldes_conges.
CREATE TABLE soldes_permissions_exceptionnelles (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employe_id        UUID NOT NULL REFERENCES employes(id) ON DELETE CASCADE,
    annee             INTEGER NOT NULL,
    quota             NUMERIC(5,2) NOT NULL DEFAULT 20,
    jours_consommes   NUMERIC(5,2) NOT NULL DEFAULT 0,
    solde_disponible  NUMERIC(5,2) GENERATED ALWAYS AS (quota - jours_consommes) STORED,
    UNIQUE (employe_id, annee)
);

CREATE TABLE demandes_absences (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employe_id               UUID NOT NULL REFERENCES employes(id) ON DELETE CASCADE,
    type                     type_demande_absence NOT NULL,
    motif_bareme             TEXT, -- clé de l'événement du barème (permission_exceptionnelle uniquement)
    motif                    TEXT NOT NULL,
    date_debut               DATE NOT NULL,
    date_fin                 DATE NOT NULL,
    nb_jours                 NUMERIC(5,2) NOT NULL, -- jours calendaires demandés (application du barème)
    nb_jours_bareme          NUMERIC(5,2) NOT NULL DEFAULT 0, -- portion couverte par le barème, non déductible
    nb_jours_hors_bareme     NUMERIC(5,2) NOT NULL DEFAULT 0, -- excédent/déplacement, candidat à déduction
    justificatif_fourni      BOOLEAN NOT NULL DEFAULT false, -- pièce d'état-civil / attestation administrative
    statut                   statut_demande_conge NOT NULL DEFAULT 'brouillon',
    avis_hierarchique        TEXT CHECK (avis_hierarchique IN ('favorable', 'defavorable')),
    commentaire_hierarchique TEXT,
    decision_rh              TEXT CHECK (decision_rh IN ('validee', 'rejetee')),
    commentaire_rh           TEXT,
    classification            classification_absence, -- fixée par la RH à la décision (case cochée sur la fiche)

    -- Snapshot au moment de la création (même principe que bulletins_paie.fonction_intitule) : la
    -- fiche PDF (absences.pdf.ts) lisait ces noms en direct via employes.departement_id/service_id/
    -- fonction_id, donc un renommage ultérieur changeait rétroactivement une fiche déjà déposée.
    departement_nom  TEXT,
    service_nom      TEXT,
    fonction_intitule TEXT,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (date_fin >= date_debut),
    CHECK (type = 'permission_exceptionnelle' OR motif_bareme IS NULL)
);

CREATE INDEX idx_demandes_absences_employe ON demandes_absences(employe_id);
CREATE INDEX idx_demandes_absences_statut ON demandes_absences(statut);

-- ============================================================================
-- 5ter. MISSIONS — outil de suivi (pas la procédure officielle avec ordre de
-- mission/validations/indemnités, restée hors SIRH). Aucun statut stocké : il est
-- toujours déduit de date_depart/date_retour_prevue/date_retour_reelle à la lecture.
-- ============================================================================

CREATE TABLE missions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employe_id            UUID NOT NULL REFERENCES employes(id) ON DELETE CASCADE,
    destination           TEXT NOT NULL,
    motif                 TEXT NOT NULL,
    date_depart           DATE NOT NULL,
    date_retour_prevue    DATE NOT NULL,
    date_retour_reelle    DATE,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (date_retour_prevue >= date_depart),
    CHECK (date_retour_reelle IS NULL OR date_retour_reelle >= date_depart)
);

CREATE INDEX idx_missions_employe ON missions(employe_id);
CREATE INDEX idx_missions_date_retour_prevue ON missions(date_retour_prevue);

-- ============================================================================
-- 6. POINTAGE (module Pointage) — SPEC_MODULE_POINTAGE_AMP.md
-- ============================================================================

CREATE TYPE statut_pointage_mensuel AS ENUM ('brouillon', 'soumis', 'valide', 'rejete');
CREATE TYPE code_absence_pointage AS ENUM (
    'absence_injustifiee', 'repos_medical', 'permission_non_payee', 'permission_payee', 'conge_annuel', 'ferie'
);

-- Une fiche par (employé, mois de paie). periode_debut/fin = cycle réel du chantier
-- (ex. 16 juin → 15 juillet), mois_paie = mois calendaire de rattachement en paie
-- (le mois dans lequel tombe periode_fin) — les deux ne coïncident pas forcément.
-- Répartition hebdomadaire 15/35/60% saisie en totaux mensuels : la formule exacte de
-- répartition depuis le détail journalier n'est pas spécifiée (renvoyée à un fichier
-- externe non fourni) — non inventée ici, cf. mémoire projet.
CREATE TABLE pointages_mensuels (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employe_id         UUID NOT NULL REFERENCES employes(id) ON DELETE CASCADE,
    chantier_id        UUID NOT NULL REFERENCES chantiers(id) ON DELETE RESTRICT,
    periode_debut      DATE NOT NULL,
    periode_fin        DATE NOT NULL,
    mois_paie          DATE NOT NULL,

    heures_hs_15       NUMERIC(6,2) NOT NULL DEFAULT 0,
    heures_hs_35       NUMERIC(6,2) NOT NULL DEFAULT 0,
    heures_hs_60       NUMERIC(6,2) NOT NULL DEFAULT 0,
    jours_panier       NUMERIC(5,2) NOT NULL DEFAULT 0,

    nb_jours_absence_injustifiee   NUMERIC(5,2) NOT NULL DEFAULT 0,
    nb_jours_repos_medical         NUMERIC(5,2) NOT NULL DEFAULT 0,
    nb_jours_permission_non_payee  NUMERIC(5,2) NOT NULL DEFAULT 0,
    nb_jours_permission_payee      NUMERIC(5,2) NOT NULL DEFAULT 0,
    nb_jours_conge_annuel          NUMERIC(5,2) NOT NULL DEFAULT 0,

    statut             statut_pointage_mensuel NOT NULL DEFAULT 'brouillon',
    soumis_par         UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
    soumis_le          TIMESTAMPTZ,
    valide_par         UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
    valide_le          TIMESTAMPTZ,
    commentaire_rejet  TEXT,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (periode_fin >= periode_debut),
    UNIQUE (employe_id, mois_paie)
);

CREATE INDEX idx_pointages_mensuels_chantier ON pointages_mensuels(chantier_id);
CREATE INDEX idx_pointages_mensuels_statut ON pointages_mensuels(statut);

-- Détail journalier — alimente la fiche imprimable (grille jour par jour) et les totaux
-- d'absence par type. Soit des heures travaillées, soit un code d'absence, jamais les deux.
CREATE TABLE pointages_jours (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pointage_mensuel_id   UUID NOT NULL REFERENCES pointages_mensuels(id) ON DELETE CASCADE,
    date                  DATE NOT NULL,
    heures                NUMERIC(4,2),
    code_absence          code_absence_pointage,

    UNIQUE (pointage_mensuel_id, date),
    CHECK (
        (heures IS NOT NULL AND code_absence IS NULL) OR
        (heures IS NULL AND code_absence IS NOT NULL)
    )
);

CREATE INDEX idx_pointages_jours_mensuel ON pointages_jours(pointage_mensuel_id);

-- ============================================================================
-- 7. PAIE (module Paie)
-- ============================================================================

CREATE TABLE grilles_salariales (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categorie        TEXT NOT NULL UNIQUE,
    salaire_base_min NUMERIC(12,2) NOT NULL,
    salaire_base_max NUMERIC(12,2) NOT NULL,
    CHECK (salaire_base_max >= salaire_base_min)
);

-- Paramètres de paie non codés en dur (taux CNSS patronale à reconfirmer, etc.) — cf. specs Paie §8
CREATE TABLE parametres_paie (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cle         TEXT NOT NULL, -- ex. 'taux_cnss_patronale', 'taux_tpa', 'taux_fsp', 'taux_abattement'
    valeur      NUMERIC(8,4) NOT NULL,
    date_effet  DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE (cle, date_effet)
);

-- Une ligne par (employé, mois, type) — l'upsert (saisie manuelle "Éléments du mois", validation
-- Pointage) remplace la valeur plutôt que d'empiler des lignes qui se seraient sommées en double.
CREATE TABLE elements_variables_paie (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employe_id  UUID NOT NULL REFERENCES employes(id) ON DELETE CASCADE,
    periode     DATE NOT NULL, -- convention : premier jour du mois concerné
    type        type_element_variable NOT NULL,
    montant     NUMERIC(12,2), -- pour heure_sup/prime/avance/panier/reliquat
    jours       NUMERIC(5,2),  -- pour absence_injustifiee
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (
        (type = 'absence_injustifiee' AND jours IS NOT NULL) OR
        (type != 'absence_injustifiee' AND montant IS NOT NULL)
    ),
    UNIQUE (employe_id, periode, type)
);

-- Un cycle par (mois, filiale) — chaque filiale est une entité juridique distincte (IFU/CNSS
-- propres) et doit produire sa déclaration séparément, cf. ADDENDUM_JOURNAL_PAIE_AMP.md §2.
-- Une fois 'cloture', plus aucune écriture de paie n'est possible pour ce mois+filiale
-- (Éléments du mois, calcul, individuel ou en masse) sans réouverture explicite (super_admin/
-- drh_holding). bulletins_paie.statut reste la trace individuelle, indépendante de ce verrou.
CREATE TABLE cycles_paie (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mois_paie     DATE NOT NULL,
    filiale_id    UUID NOT NULL REFERENCES filiales(id) ON DELETE RESTRICT,
    statut        statut_cycle_paie NOT NULL DEFAULT 'ouvert',
    calcule_le    TIMESTAMPTZ,
    verifie_par   UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
    verifie_le    TIMESTAMPTZ,
    exporte_le    TIMESTAMPTZ,
    cloture_par   UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
    cloture_le    TIMESTAMPTZ,
    reouvert_par  UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
    reouvert_le   TIMESTAMPTZ,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (mois_paie, filiale_id)
);

CREATE INDEX idx_cycles_paie_filiale ON cycles_paie(filiale_id);

-- Depuis le passage au moteur "port fidèle Excel" (calculerBulletinPaie.ts), le bulletin
-- stocke chaque ligne du calcul (pas que les totaux), pour permettre la génération fidèle
-- du PDF et garder chaque bulletin "calculé" immuable même si le contrat change ensuite.
CREATE TABLE bulletins_paie (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employe_id               UUID NOT NULL REFERENCES employes(id) ON DELETE RESTRICT,
    periode                  DATE NOT NULL, -- premier jour du mois

    jours_pris_en_compte     NUMERIC(5,2) NOT NULL DEFAULT 30,
    personnes_a_charge       INTEGER NOT NULL DEFAULT 0, -- snapshot au moment du calcul
    fonction_intitule        TEXT, -- snapshot de fonctions.intitule au moment du calcul (employes.fonction_id) —
                                    -- un renommage/archivage ultérieur de la fonction ne doit jamais changer un
                                    -- bulletin déjà généré, même régénéré en PDF plus tard

    salaire_base             NUMERIC(12,2) NOT NULL, -- proratisé
    sursalaire               NUMERIC(12,2) NOT NULL DEFAULT 0,
    indemnite_logement       NUMERIC(12,2) NOT NULL DEFAULT 0,
    indemnite_transport      NUMERIC(12,2) NOT NULL DEFAULT 0,
    indemnite_fonction       NUMERIC(12,2) NOT NULL DEFAULT 0,
    indemnite_sujetion       NUMERIC(12,2) NOT NULL DEFAULT 0,
    indemnite_astreinte      NUMERIC(12,2) NOT NULL DEFAULT 0,
    anciennete_annees        INTEGER NOT NULL DEFAULT 0,
    prime_anciennete         NUMERIC(12,2) NOT NULL DEFAULT 0,
    heures_supplementaires   NUMERIC(12,2) NOT NULL DEFAULT 0, -- montant forfaitaire, cf. ElementsVariables.heuresSupplementairesForfaitaires
    hs_15                    NUMERIC(12,2) NOT NULL DEFAULT 0, -- détail par taux, pour l'affichage fidèle du nouveau modèle de bulletin
    hs_35                    NUMERIC(12,2) NOT NULL DEFAULT 0,
    hs_50                    NUMERIC(12,2) NOT NULL DEFAULT 0,
    hs_60                    NUMERIC(12,2) NOT NULL DEFAULT 0,
    hs_120                   NUMERIC(12,2) NOT NULL DEFAULT 0,
    prime_panier             NUMERIC(12,2) NOT NULL DEFAULT 0,
    prime_salissure          NUMERIC(12,2) NOT NULL DEFAULT 0, -- même traitement fiscal/social que prime_panier (exclue de l'assiette CNSS, soumise à l'IUTS)
    prime_lait               NUMERIC(12,2) NOT NULL DEFAULT 0, -- idem prime_salissure
    autres_indemnites        NUMERIC(12,2) NOT NULL DEFAULT 0,
    avance_acompte           NUMERIC(12,2) NOT NULL DEFAULT 0,
    reliquat                 NUMERIC(12,2) NOT NULL DEFAULT 0,
    reversement_trop_percu   NUMERIC(12,2) NOT NULL DEFAULT 0, -- jamais calculé automatiquement, cf. limite connue

    brut                     NUMERIC(12,2) NOT NULL, -- rémunération totale = somme des avoirs
    exonerations_indemnites  NUMERIC(12,2) NOT NULL DEFAULT 0,
    abattement_forfaitaire   NUMERIC(12,2) NOT NULL DEFAULT 0,
    salaire_net_imposable    NUMERIC(12,2) NOT NULL DEFAULT 0,
    base_imposable           NUMERIC(12,2) NOT NULL,
    iuts                     NUMERIC(12,2) NOT NULL, -- IUTS net (après abattement charges familiales)
    cnss_salariale           NUMERIC(12,2) NOT NULL,
    salaire_net              NUMERIC(12,2) NOT NULL DEFAULT 0,
    fsp                      NUMERIC(12,2) NOT NULL,
    autres_retenues          NUMERIC(12,2) NOT NULL DEFAULT 0, -- retenue manuelle résiduelle, hors modèle
    net_a_payer              NUMERIC(12,2) NOT NULL,
    cout_employeur           NUMERIC(12,2) NOT NULL,
    statut                   statut_bulletin NOT NULL DEFAULT 'brouillon',
    pdf_url                  TEXT,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (employe_id, periode)
);

CREATE INDEX idx_bulletins_periode ON bulletins_paie(periode);

-- ============================================================================
-- 8. ARCHIVAGE DOCUMENTAIRE (module Archivage)
-- ============================================================================

CREATE TABLE documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categorie           categorie_document NOT NULL,
    employe_id          UUID REFERENCES employes(id) ON DELETE CASCADE, -- NULL = document société, non lié à un employé
    filiale_id          UUID REFERENCES filiales(id) ON DELETE CASCADE,
    fichier_url         TEXT NOT NULL, -- chemin Supabase Storage
    nom_original         TEXT NOT NULL,
    type_mime           TEXT NOT NULL,
    taille_octets        BIGINT NOT NULL,
    uploaded_by          UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE RESTRICT,
    date_expiration      DATE,
    statut               statut_document NOT NULL DEFAULT 'valide',
    confidentialite      confidentialite_document NOT NULL DEFAULT 'standard',
    version              INTEGER NOT NULL DEFAULT 1,
    document_parent_id   UUID REFERENCES documents(id) ON DELETE SET NULL, -- version précédente
    corbeille            BOOLEAN NOT NULL DEFAULT false,
    date_purge_prevue    DATE,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_employe ON documents(employe_id);
CREATE INDEX idx_documents_expiration ON documents(date_expiration) WHERE date_expiration IS NOT NULL;

CREATE TABLE tags_documents (
    document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tag          TEXT NOT NULL,
    PRIMARY KEY (document_id, tag)
);

-- ============================================================================
-- 9. JOURNAL D'AUDIT (transverse, exigence architecture)
-- ============================================================================

CREATE TABLE journal_audit (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utilisateur_id  UUID REFERENCES utilisateurs(id) ON DELETE SET NULL, -- Qui
    action          TEXT NOT NULL, -- ex. 'creation', 'modification', 'suppression', 'connexion'
    module          TEXT NOT NULL, -- ex. 'employes', 'contrats', 'conges', 'paie'
    entite_id       UUID,          -- id de l'enregistrement concerné, si applicable
    valeur_avant    JSONB,         -- Ancienne valeur : NULL pour une création
    valeur_apres    JSONB,         -- Nouvelle valeur : NULL pour une suppression
    adresse_ip      INET,          -- Adresse IP
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now() -- Quand
);

CREATE INDEX idx_journal_audit_utilisateur ON journal_audit(utilisateur_id);
CREATE INDEX idx_journal_audit_module ON journal_audit(module, created_at);

-- ============================================================================
-- 10. ATTESTATIONS (module Attestations) — SPEC_MODULE_ATTESTATIONS_AMP.md
-- ============================================================================

-- Champs nécessaires à l'Attestation de travail déjà présents sur employes : date_naissance,
-- lieu_naissance, num_cnib (réutilisé comme numéro de pièce d'identité) — aucune migration
-- employes nécessaire (vérifié avant construction de ce module).

-- Extension employes pour les stagiaires (contrat actif de type 'stage') — pas de référentiel
-- "Stagiaires" séparé côté LOGICIEL_SALAIRES.xlsm repris ici : filière/établissement/superviseur
-- sont propres au stage, mais dates de stage et service d'affectation ne sont PAS dupliqués ici —
-- réutilisés depuis le contrat actif (contrats.date_debut/date_fin) et employes.service_id.
CREATE TABLE stagiaires (
    employe_id       UUID PRIMARY KEY REFERENCES employes(id) ON DELETE CASCADE,
    filiere_etudes   TEXT,
    etablissement    TEXT,
    superviseur_id   UUID REFERENCES employes(id) ON DELETE SET NULL,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE type_attestation AS ENUM ('att_trav', 'cert_trav', 'att_stage');

-- Contrairement aux documents uploadés (section 8, table `documents` / Supabase Storage), une
-- attestation est générée depuis des données structurées et régénérée à la demande en PDF (même
-- principe que bulletins_paie / pointages_mensuels) — pas de fichier stocké. `donnees` fige tout
-- ce qui a été effectivement affiché sur le document au moment de la génération, y compris les
-- personnalisations faites dans l'aperçu (ex. description des missions de stage, motif de
-- départ) — jamais recalculé depuis la fiche employé après coup, non modifiable ensuite.
CREATE TABLE attestations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type            type_attestation NOT NULL,
    numero          INT NOT NULL,
    filiale_id      UUID NOT NULL REFERENCES filiales(id) ON DELETE RESTRICT,
    annee           INT NOT NULL,
    employe_id      UUID NOT NULL REFERENCES employes(id) ON DELETE RESTRICT,
    date_emission   DATE NOT NULL DEFAULT CURRENT_DATE,
    emis_par        UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
    donnees         JSONB NOT NULL,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (type, filiale_id, annee, numero)
);

CREATE INDEX idx_attestations_employe ON attestations(employe_id);

-- Compteur atomique par (type, filiale, année), remis à 1 chaque année civile — un simple
-- MAX(numero)+1 sur `attestations` serait sujet à collision sous accès concurrent (deux RH qui
-- génèrent au même instant pour la même filiale) ; l'UPSERT sur ce compteur est atomique.
CREATE TABLE compteurs_attestations (
    type            type_attestation NOT NULL,
    filiale_id      UUID NOT NULL REFERENCES filiales(id) ON DELETE CASCADE,
    annee           INT NOT NULL,
    dernier_numero  INT NOT NULL DEFAULT 0,

    PRIMARY KEY (type, filiale_id, annee)
);
