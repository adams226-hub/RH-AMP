# Build en 2 étapes : l'étape "build" a les devDependencies (tsc, types) nécessaires pour
# compiler, l'image finale ne garde que le résultat compilé (dist/) + les dépendances de
# production — image plus légère, pas de TypeScript ni de code source exposé à l'exécution.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 4000
CMD ["node", "dist/server.js"]
