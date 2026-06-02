# ============================================================
# STAGE 1: development — Vite dev server con HMR
# ============================================================
FROM node:20-alpine AS development

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173
# vite.config.ts ya tiene host:0.0.0.0, watch.usePolling y hmr.clientPort
CMD ["npx", "vite"]

# ============================================================
# STAGE 2: builder — Compila el frontend para producción
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# VITE_API_URL se inyecta como build-arg en producción
# En Docker: /api  (Nginx proxea internamente al backend)
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ============================================================
# STAGE 3: production — Nginx sirve el build estático
# ============================================================
FROM nginx:1.25-alpine AS production

# Copiar build del frontend
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar config Nginx personalizada
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
