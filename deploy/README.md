# Despliegue en el VPS de pruebas

Frontend y API comparten un solo subdominio. Nginx corre en el host y reparte:
`/` va al frontend y `/api/` a la API. Al ser el mismo origen no hay CORS y la
cookie de sesion funciona con `SameSite=Lax`, tal como ya la emite el backend.

```
Navegador --HTTPS--> Nginx (host)
                       |-- /      --> 127.0.0.1:3001  frontend
                       `-- /api/  --> 127.0.0.1:3000  backend --> db (red interna)
```

Las imagenes las construye GitHub Actions y las publica en GHCR. El VPS nunca
compila: solo hace `pull` de la etiqueta `sha-<commit>`.

**Solo `main` despliega.** `develop` es la rama de desarrollo y no dispara nada.

---

## Puesta en marcha (una sola vez)

### 1. Estructura en el VPS

```bash
sudo mkdir -p /opt/amzdesk
sudo chown "$USER":"$USER" /opt/amzdesk
```

Copia `deploy/docker-compose.prod.yml` como `/opt/amzdesk/docker-compose.yml` y
`deploy/.env.example` como `/opt/amzdesk/.env`.

```bash
chmod 600 /opt/amzdesk/.env
```

Rellena el `.env` con credenciales nuevas. El `JWT_SECRET` necesita 32
caracteres como minimo o la aplicacion no arranca:

```bash
openssl rand -hex 32
```

No reutilices el secreto ni la contrasena del entorno de desarrollo.

### 2. Acceso a GHCR

Los paquetes de GHCR nacen privados, asi que el VPS necesita autenticarse. Crea
un token clasico en GitHub con permiso `read:packages` y nada mas:

```bash
echo "TU_TOKEN" | docker login ghcr.io -u ARANO8 --password-stdin
```

### 3. Clave SSH para los despliegues

En el VPS, una clave dedicada (sin passphrase, la usa un proceso automatico):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N "" -C "github-actions"
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/github_deploy    # esta es la que va al secreto VPS_SSH_KEY
```

Registra estos secretos **en ambos repositorios** (Settings > Secrets and
variables > Actions):

| Secreto | Valor |
|---|---|
| `VPS_HOST` | IP o dominio del VPS |
| `VPS_USER` | usuario con acceso a Docker |
| `VPS_SSH_KEY` | contenido de la clave privada `github_deploy` |
| `VPS_PORT` | puerto SSH (normalmente `22`) |
| `APP_URL` | `https://tu-subdominio.tudominio.com`, sin barra final |

### 4. Nginx y certificado

El certificado debe existir antes de habilitar el sitio, o `nginx -t` falla:

```bash
sudo mkdir -p /var/www/certbot
sudo certbot certonly --webroot -w /var/www/certbot -d tu-subdominio.tudominio.com
```

Despues instala `deploy/nginx/amzdesk.conf` siguiendo las instrucciones de su
cabecera.

### 5. Apagar el despliegue manual anterior

Antes del primer arranque hay que liberar los puertos 3000 y 3001 y respaldar
lo que exista:

```bash
pg_dump ... > ~/respaldo-antes-de-migrar.sql   # ajusta segun donde corra hoy Postgres
pm2 delete all    # o el mecanismo que mantenga viva la version manual
```

### 6. Primer arranque

```bash
cd /opt/amzdesk
docker compose pull
docker compose up -d
docker compose ps
curl -fsS https://tu-subdominio.tudominio.com/api/health
```

---

## Operacion diaria

Publicar es fusionar `develop` en `main` y empujar. Cada repositorio despliega
solo su servicio, sin tocar al otro.

```bash
git checkout main && git merge develop && git push
```

### Ver el estado

```bash
cd /opt/amzdesk
docker compose ps
docker compose logs -f backend
```

### Rollback

Las etiquetas `sha-*` quedan en GHCR, asi que volver atras es apuntar a la
anterior:

```bash
cd /opt/amzdesk
sed -i 's|^BACKEND_IMAGE=.*|BACKEND_IMAGE=ghcr.io/arano8/conservacion-amazonica-backend:sha-COMMIT_ANTERIOR|' .env
docker compose up -d backend
```

### Migraciones

Se aplican solas: el entrypoint del contenedor ejecuta `prisma migrate deploy`
en cada arranque. Para revisar el estado sin desplegar:

```bash
docker compose exec backend npx prisma migrate deploy
```

### Respaldo de la base

```bash
docker compose exec db pg_dump -U amzdesk amazonica_db > respaldo-$(date +%F).sql
```

---

## Notas

- **La base no se resetea ni se siembra en cada despliegue.** El seed necesita
  `ts-node` y dependencias de desarrollo que la imagen de produccion no lleva.
- El puerto de PostgreSQL no se publica y los contenedores escuchan solo en
  `127.0.0.1`. Desde fuera del VPS unicamente deben responder el 80 y el 443.
- `NEXT_PUBLIC_API_URL` se hornea en el bundle del frontend durante el build.
  Su valor es la ruta relativa `/api`, lo que hace que la misma imagen sirva
  para cualquier dominio.
