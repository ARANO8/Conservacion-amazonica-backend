# Despliegue en el VPS

Guia de los pasos que se ejecutan **a mano en el VPS**. Todo lo demas esta
automatizado: cada push a `main` construye la imagen en GitHub Actions, la
publica en GHCR y actualiza el servidor por SSH.

`develop` es la rama de desarrollo y **no despliega nada**. Publicar es fusionar
`develop` en `main`.

---

## Como queda organizado el servidor

El dominio se reparte por prefijos, con un proxy compartido al frente:

```
Internet --HTTPS--> proxy anterior al VPS --HTTP:80--> stack `edge` (nginx)
                                                        |-- /              -> portfolio
                                                        |-- /amzdesk/      -> amzdesk_frontend:3001
                                                        `-- /amzdesk/api/  -> amzdesk_backend:3000
                                                                                `-> amzdesk_db (red interna)
```

Son **dos stacks de compose independientes** unidos por una red externa llamada
`edge`:

| Ruta en el VPS | Que contiene |
|---|---|
| `/opt/edge` | El nginx compartido. Unico contenedor que publica un puerto |
| `/opt/amzdesk` | La aplicacion: base de datos, API y frontend. Sin puertos publicados |

El proxy va aparte a proposito: reparte el dominio entre el portfolio, `/amzdesk`
y los sistemas que agregues despues. Si viviera dentro del stack de la
aplicacion, cada despliegue reiniciaria el proxy de todos los demas sitios.

El HTTPS lo termina el proxy que esta delante del VPS. Aqui solo se sirve HTTP
en el puerto 80.

---

## Paso 1 — Limpiar el servidor

> **Esto destruye datos y no tiene vuelta atras.** Elimina los cuatro stacks
> actuales con sus volumenes: `sige`, `ssih` (incluido su almacenamiento MinIO),
> `ssda` y el `amzdesk` viejo. Si algo de eso te importa, respaldalo antes.

Primero mira que hay, para saber que estas borrando:

```bash
docker ps -a
docker volume ls
docker system df
```

Si quieres guardar alguna base antes de borrarla:

```bash
docker exec amazonica_db pg_dump -U admin amazonica_db > ~/respaldo-amzdesk-$(date +%F).sql
```

Y ahora la limpieza:

```bash
docker ps -aq | xargs -r docker rm -f
docker system prune -a --volumes -f
sudo rm -rf /var/www/Conservacion-amazonica-frontend /var/www/Conservacion-amazonica-backend
sudo rm -rf /root/AMZdesk
df -h /
```

El disco estaba al 88%. Tras esto deberia bajar bastante; el backend nuevo pesa
1,66 GB porque incluye Chromium para generar los PDF.

---

## Paso 2 — Acceso a GHCR

Los paquetes de GHCR nacen privados, asi que el VPS necesita autenticarse. Crea
un token clasico en GitHub (Settings > Developer settings > Personal access
tokens > Tokens classic) con permiso **`read:packages`** y nada mas:

```bash
echo "TU_TOKEN" | docker login ghcr.io -u ARANO8 --password-stdin
```

---

## Paso 3 — Clave SSH para los despliegues

En el VPS, una clave dedicada y sin passphrase, porque la usa un proceso
automatico:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N "" -C "github-actions"
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
cat ~/.ssh/github_deploy     # esta es la que va al secreto VPS_SSH_KEY
```

Registra estos secretos **en los dos repositorios** (Settings > Secrets and
variables > Actions > New repository secret):

| Secreto | Valor |
|---|---|
| `VPS_HOST` | IP o dominio del VPS |
| `VPS_USER` | usuario con acceso a Docker (`root` segun el diagnostico) |
| `VPS_SSH_KEY` | contenido completo de `~/.ssh/github_deploy`, incluidas las lineas BEGIN y END |
| `VPS_PORT` | puerto SSH del VPS |

> El proxy que esta delante del VPS responde **403 a las peticiones que llegan
> desde GitHub Actions** (bloquea IPs de centro de datos), aunque las de un
> navegador pasen sin problema. Por eso la comprobacion posterior al despliegue
> se ejecuta **dentro del VPS**, por la misma sesion SSH, contra
> `http://127.0.0.1/amzdesk/...`. Atraviesa igualmente el proxy `edge`, asi que
> prueba el mismo camino que un navegador, pero sin depender de un intermediario
> que no controlamos. No hace falta ningun secreto con la URL publica.

---

## Paso 4 — Levantar el proxy compartido

```bash
sudo mkdir -p /opt/edge
```

Copia a `/opt/edge/` estos tres archivos del repositorio, respetando la
estructura:

- `deploy/edge/docker-compose.yml` -> `/opt/edge/docker-compose.yml`
- `deploy/edge/nginx.conf` -> `/opt/edge/nginx.conf`
- `deploy/edge/html/index.html` -> `/opt/edge/html/index.html`

Desde tu maquina, con el repo clonado:

```bash
scp -r deploy/edge/* usuario@TU_VPS:/opt/edge/
```

Y arrancalo. **Debe ir primero**, porque es quien crea la red `edge` que el otro
stack referencia:

```bash
cd /opt/edge
docker compose up -d
docker compose ps
curl -I http://127.0.0.1/          # debe devolver 200: el marcador del portfolio
```

---

## Paso 5 — Configurar la aplicacion

```bash
sudo mkdir -p /opt/amzdesk
```

Copia `deploy/docker-compose.prod.yml` como `/opt/amzdesk/docker-compose.yml` y
`deploy/.env.example` como `/opt/amzdesk/.env`.

```bash
chmod 600 /opt/amzdesk/.env
```

Edita el `.env` con valores reales. Dos cosas que importan:

- **`JWT_SECRET` necesita 32 caracteres como minimo** o la aplicacion no
  arranca. Generalo con `openssl rand -hex 32`.
- La contrasena de PostgreSQL aparece **dos veces**: en `POSTGRES_PASSWORD` y
  dentro de `DATABASE_URL`. Deben coincidir.

No reutilices el secreto ni la contrasena del entorno de desarrollo.

---

## Paso 6 — Primer arranque

```bash
cd /opt/amzdesk
docker compose pull
docker compose up -d
docker compose ps
docker compose logs -f backend
```

En los logs deberias ver el entrypoint aplicando las 41 migraciones sobre la
base vacia y despues el arranque de la API. Comprueba:

```bash
curl -fsS http://127.0.0.1/amzdesk/api/health    # {"status":"ok",...}
curl -I  http://127.0.0.1/amzdesk/login          # 200
```

---

## Paso 7 — Sembrar los datos iniciales

La base esta vacia: sin este paso **no hay usuarios y nadie puede entrar**.

Define primero `SEED_PASSWORD` en `/opt/amzdesk/.env` si quieres una contrasena
fija para todos los usuarios de prueba; si la dejas vacia, el seed genera una
distinta por usuario y la imprime.

```bash
cd /opt/amzdesk
docker compose run --rm backend node dist/prisma/seed.js
```

Esto es puntual: **no** se ejecuta en cada despliegue.

---

## Operacion diaria

Publicar es fusionar `develop` en `main` y empujar. Cada repositorio despliega
solo su servicio, sin tocar al otro:

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
docker compose exec backend npx prisma migrate status
```

### Respaldo de la base

```bash
cd /opt/amzdesk
docker compose exec db pg_dump -U amzdesk amazonica_db > ~/respaldo-$(date +%F).sql
```

### Agregar otro sistema al dominio

Edita `/opt/edge/nginx.conf`, copia los bloques `location` de `/amzdesk`
cambiando el prefijo y los nombres de contenedor, y recarga:

```bash
cd /opt/edge
docker compose exec nginx nginx -t && docker compose exec nginx nginx -s reload
```

El stack nuevo debe unirse a la red `edge` igual que lo hace el de amzdesk.

### Publicar el portfolio

Reemplaza el contenido de `/opt/edge/html/` por los archivos del sitio. Nginx los
sirve directamente, sin reiniciar nada.

---

## Notas

- **Ningun contenedor de la aplicacion publica puertos.** Solo el nginx del
  `edge` escucha en el host. Comprueba desde fuera del VPS que los puertos 3000,
  3001 y 5432 estan cerrados y que solo responde el 80.
- **El proxy resuelve los nombres en cada peticion** (`resolver 127.0.0.11`).
  Es imprescindible: cada despliegue recrea los contenedores con otra IP y, sin
  eso, nginx serviria 502 hasta que alguien lo reiniciara a mano.
- **La base no se resetea ni se siembra en cada despliegue.** Solo migraciones.
- `NEXT_PUBLIC_BASE_PATH` y `NEXT_PUBLIC_API_URL` se hornean en el bundle del
  frontend al construir la imagen. Cambiar el prefijo `/amzdesk` exige
  reconstruir, no basta con tocar el `.env`.
- El VPS tiene 2 GB de RAM y aloja el proxy y la aplicacion. `shm_size` del
  backend esta en 512 MB porque Chromium necesita mas de los 64 MB que Docker
  asigna por defecto, pero 1 GB seria excesivo aqui.
