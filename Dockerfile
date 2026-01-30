# Usamos una versión ligera de Node
FROM node:20-alpine

# Instalamos pnpm (gestor de paquetes)
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

# Exponemos el puerto 3000
EXPOSE 3000

# Comando para iniciar
CMD ["node", "dist/main"]