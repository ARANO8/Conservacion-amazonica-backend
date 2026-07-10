# Usamos una versión ligera de Node
FROM node:20-alpine

# Instalamos dependencias del sistema necesarias para Puppeteer/Chromium
RUN apk add --no-cache \
    openssl \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji

# Configuramos Puppeteer para usar Chromium del sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN npm install -g pnpm

# Creamos la carpeta de trabajo
WORKDIR /app

# Copiamos los archivos de configuración primero (para aprovechar la caché)
COPY package.json pnpm-lock.yaml ./

# Instalamos dependencias
RUN pnpm install

# Copiamos el resto del código
COPY . .

# Generamos el cliente de Prisma (IMPORTANTE)
RUN npx prisma generate

# Construimos la aplicación
RUN pnpm build

COPY prisma/seed.ts ./dist/prisma/seeds

# Exponemos el puerto 3000
EXPOSE 3000

# Comando para iniciar
CMD ["node", "dist/src/main"]