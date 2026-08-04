#!/bin/sh
# Punto de entrada de la imagen de la API.
#
# Aplica las migraciones pendientes antes de levantar el servidor. Se usa
# `migrate deploy` (nunca `migrate dev`): no genera migraciones nuevas, no pide
# confirmación y falla en lugar de reescribir el historial si algo no cuadra.
set -e

echo "[entrypoint] Aplicando migraciones pendientes..."
npx prisma migrate deploy

echo "[entrypoint] Migraciones al día. Iniciando la API..."
exec "$@"
