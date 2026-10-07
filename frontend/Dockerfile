# VITE_API_URL doit être fourni en argument de build (pas en variable d'environnement runtime) :
# Vite inscrit import.meta.env.VITE_API_URL en dur dans le bundle au moment du build, il ne peut
# plus être changé une fois l'image construite.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
