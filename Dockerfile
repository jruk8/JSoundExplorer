# ---- build stage: install deps, bake catalog, build SPA ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
# Best effort: bake the real catalog into the image. If the Mojang
# endpoints are unreachable, the app falls back to offline mock data.
RUN npm run build:catalog || echo "catalog fetch failed; app will use offline mock data"
RUN npm run build

# ---- serve stage: static files via nginx ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
