# ============================================================
# STAGE: development — nodemon + devDependencies para HMR
# ============================================================
FROM node:20-alpine AS development

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Crear carpeta uploads por si no existe en el código fuente
RUN mkdir -p uploads

EXPOSE 3000
CMD ["npm", "run", "dev"]

# ============================================================
# STAGE: production — solo dependencias de producción
# ============================================================
FROM node:20-alpine AS production

WORKDIR /app

COPY package.json package-lock.json ./
# Instalar SOLO dependencias de producción (sin nodemon, etc.)
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p uploads

# Usuario no-root con UID fijo 1001 — debe coincidir con el propietario del
# directorio montado en el host: chown -R 1001:1001 /var/www/Tecnocell_storage/uploads
RUN addgroup -S -g 1001 appgroup && adduser -S -u 1001 -G appgroup appuser \
    && chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000
CMD ["node", "server.js"]
