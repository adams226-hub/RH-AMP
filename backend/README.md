# Backend RH AMP Holding

API Node.js + Express + TypeScript, connectée à PostgreSQL (Supabase), authentification JWT + RBAC.

## Prérequis

- Node.js 20+
- Une base PostgreSQL Supabase sur laquelle le schéma [`database/schema.sql`](../database/schema.sql) a déjà été appliqué
- Au moins une ligne dans `utilisateurs` avec `mot_de_passe_hash` généré via bcrypt (pas de seed automatique pour l'instant)

## Installation

```
npm install
cp .env.example .env
```

Renseigner dans `.env` : `DATABASE_URL` (chaîne de connexion Supabase) et `JWT_SECRET`.

## Développement

```
npm run dev
```

Vérification : `GET http://localhost:4000/sante` doit répondre `{"statut":"ok"}`.

## Structure

```
src/
  config/       variables d'environnement, pool PostgreSQL
  middleware/   authentification JWT, autorisation RBAC, gestion d'erreurs
  modules/      un dossier par domaine métier (routes/controller/service/types)
  utils/
```

## Modules implémentés

- `auth` — connexion (`POST /api/auth/connexion`), émission du JWT
- `employes` — lecture/création, filtrée par périmètre filiale (`GET/POST /api/employes`)

Les modules restants (contrats, congés, paie, postes, utilisateurs, archivage) suivent le même
découpage et s'appuient sur [`database/schema.sql`](../database/schema.sql) et les specs dans
[`docs/specifications-fonctionnelles/`](../docs/specifications-fonctionnelles/).
