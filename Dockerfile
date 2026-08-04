# syntax=docker/dockerfile:1

# Imagen de producción de la API.
#
# Se usa Debian (bookworm-slim) y no Alpine a propósito: `bcrypt` es un módulo
# nativo cuyos binarios precompilados para musl son poco fiables, y el Chromium
# de Debian está mejor alineado con la versión de puppeteer que usamos.

##############################################################################
# Etapa 1 — dependencias completas y compilación
##############################################################################
FROM node:20-bookworm-slim AS builder

# HUSKY=0: el script `prepare` falla sin .git, que está en .dockerignore.
# PUPPETEER_SKIP_DOWNLOAD: en runtime usamos el Chromium del sistema.
ENV HUSKY=0 \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Solo el generador `client`. El generador `erd` del schema arrastra
# @mermaid-js/mermaid-cli con un segundo Chromium y no aporta nada a la imagen.
RUN npx prisma generate --generator client

RUN pnpm build

##############################################################################
# Etapa 2 — imagen de ejecución
##############################################################################
FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production \
    PORT=3000 \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# chromium: generación de PDFs. tini: init como PID 1, sin él los procesos de
# Chromium quedan como zombies. openssl: lo requieren los motores de Prisma.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        chromium \
        tini \
        openssl \
        ca-certificates \
        fonts-liberation \
        fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app

# Las dependencias se instalan ANTES de copiar prisma/ de forma deliberada: así
# el postinstall de @prisma/client no encuentra schema y no intenta generar por
# su cuenta (lo haría incluyendo el generador `erd`, ausente en esta imagen).
COPY package.json pnpm-lock.yaml ./

# El script `prepare` invoca husky, que es una dependencia de desarrollo y no
# existe en una instalacion de produccion. HUSKY=0 no basta: el binario ni
# siquiera esta, asi que se elimina el script antes de instalar. No se usa
# --ignore-scripts porque bcrypt necesita el suyo para resolver su binario nativo.
RUN npm pkg delete scripts.prepare \
    && pnpm install --prod --frozen-lockfile \
    && rm -rf "$(pnpm store path)"

# El schema y las migraciones se necesitan en runtime: el entrypoint ejecuta
# `prisma migrate deploy` en cada arranque.
COPY prisma ./prisma
RUN npx prisma generate --generator client

# Artefactos de la aplicación. Las plantillas .hbs viajan dentro de dist/ (las
# copia nest-cli). Tanto ellas como logo.png se resuelven contra process.cwd(),
# por lo que el proceso debe arrancar con /app como directorio de trabajo.
COPY --from=builder /app/dist ./dist
COPY logo.png ./logo.png

# El seed compilado resuelve sus datos con path.join(__dirname, 'seeds', ...),
# es decir dist/prisma/seeds. Los CSV viven en prisma/seeds, asi que se copian
# a esa ruta para poder sembrar una base nueva sin devDependencies ni ts-node:
#   docker compose run --rm backend node dist/prisma/seed.js
COPY prisma/seeds ./dist/prisma/seeds

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Sin `chown -R /app`: reasignar el dueño de todo el arbol duplicaria unos
# 250 MB en una capa nueva. La aplicacion solo necesita leer sus archivos, y de
# hecho es preferible que no pueda modificarlos.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/src/main"]
