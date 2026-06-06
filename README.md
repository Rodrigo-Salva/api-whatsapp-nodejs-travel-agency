# Travel Agency — Full Stack

Plataforma completa de agencia de viajes con panel de administración, integración de WhatsApp y pagos con Stripe.

## Stack

| Capa | Tecnología |
|------|-----------|
| **Backend** | Django 5, DRF, Django Channels (WebSocket) |
| **Frontend** | Next.js 15 (App Router), Tailwind v4, shadcn/ui |
| **WhatsApp** | WAHA (self-hosted), BullMQ, Node.js microservice |
| **Base de datos** | PostgreSQL 16 |
| **Cola/Caché** | Redis 7 |
| **Pagos** | Stripe |
| **Contenedores** | Docker Compose |

## Estructura del repositorio

```
agency/
├── travel-agency-back/      # Django API + Docker Compose (orquesta todo)
├── travel-agency-front/     # Next.js (corre local en dev, fuera de Docker)
└── whatsapp-service/        # Microservicio Node.js para colas de mensajes
```

---

## Inicio rápido

### Requisitos

- Docker Desktop
- Node.js 20+
- Git

### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd agency
```

### 2. Configurar variables de entorno

```bash
# Backend
cp travel-agency-back/.env.example travel-agency-back/.env
# Editar travel-agency-back/.env con tus credenciales

# Frontend
cp travel-agency-front/.env.example travel-agency-front/.env.local
```

### 3. Levantar el backend (Docker)

```bash
cd travel-agency-back
docker compose up --build -d

# Aplicar migraciones
docker compose exec web python manage.py migrate

# Crear usuario administrador
docker compose exec web python manage.py createsuperuser
```

### 4. Levantar el frontend (local)

```bash
cd travel-agency-front
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## URLs importantes

| Servicio | URL |
|---------|-----|
| Frontend (dev) | http://localhost:3000 |
| Django API | http://localhost:8081/api/ |
| Django Admin | http://localhost:8081/admin/ |
| API Docs (Swagger) | http://localhost:8081/api/docs/ |
| WAHA Dashboard | http://localhost:3100 |
| Bull Board (colas) | http://localhost:3005/admin/queues |

**Credenciales WAHA:** usuario `admin` / contraseña en `.env` del backend

---

## Variables de entorno necesarias

### `travel-agency-back/.env`

```env
SECRET_KEY=django-insecure-cambia-esto-en-produccion
DEBUG=True
ALLOWED_HOSTS=*

# Base de datos
DB_NAME=agencia_turismo
DB_USER=postgres
DB_PASSWORD=tu_password
DB_HOST=localhost
DB_PORT=5432

# CORS
CORS_ALLOW_ALL_ORIGINS=True
CORS_ALLOWED_ORIGINS=http://localhost:3000

# Email (usa console para desarrollo)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=tu@email.com
EMAIL_HOST_PASSWORD=tu_app_password
DEFAULT_FROM_EMAIL=TravelAgency <tu@email.com>

# Stripe (obtener en https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### `travel-agency-front/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8081/api/
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:8081/ws/whatsapp/
```

---

## Flujo de WhatsApp

1. Ir a `/admin/whatsapp` en el panel
2. Escanear el QR con WhatsApp en el teléfono
3. Los mensajes entrantes aparecen en tiempo real vía WebSocket
4. Puedes responder con delay programado (inmediato / 5min / 1h / 24h / personalizado)
5. Las campañas masivas se gestionan en `/admin/whatsapp/campaigns`

---

## Comandos útiles

```bash
# Ver logs del backend
cd travel-agency-back && docker compose logs web -f

# Rebuild después de cambiar código Django
docker compose build --no-cache web && docker compose up -d web

# Acceder al shell de Django
docker compose exec web python manage.py shell

# Ejecutar migraciones
docker compose exec web python manage.py migrate

# Detener todo
docker compose down

# Detener y borrar volúmenes (reset total)
docker compose down -v
```

---

## Producción

Para desplegar en producción:

1. Cambiar `DEBUG=False` y `SECRET_KEY` por una clave segura
2. Configurar `ALLOWED_HOSTS` con tu dominio
3. Usar un servidor de archivos estáticos (S3, Cloudflare R2) para media
4. Configurar Nginx como reverse proxy
5. Usar certificado SSL (Let's Encrypt)
6. Cambiar `CORS_ALLOW_ALL_ORIGINS=False` y listar solo orígenes permitidos
7. Usar variables de entorno del sistema en lugar de archivos `.env`

---

## Autor

[Rodrigo Salva](https://github.com/Rodrigo-Salva)
