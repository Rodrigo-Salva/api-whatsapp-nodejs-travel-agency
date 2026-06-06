# Project Overview

Full-stack travel agency platform with WhatsApp messaging integration. Three services working together:

- **`travel-agency-back/`** — Django 5 + DRF backend (ASGI via Uvicorn + Channels)
- **`travel-agency-front/`** — Next.js 15 frontend (App Router, Tailwind v4, shadcn)
- **`whatsapp-service/`** — Node.js microservice (Express + BullMQ) for message queuing

## Running the Stack

Everything runs from `travel-agency-back/` via Docker Compose:

```bash
cd travel-agency-back

# First time or after code changes to Django/whatsapp-service:
docker compose build --no-cache web whatsapp-service
docker compose up -d

# Apply migrations (required after any model change):
docker compose exec web python manage.py migrate

# Create superuser (first time):
docker compose exec web python manage.py createsuperuser
```

**Frontend runs outside Docker for fast hot-reload:**
```bash
cd travel-agency-front
npm run dev   # http://localhost:3000
```

**After any change to Django Python files, rebuild is required** — the container bakes code into the image (no volume mount for source code, only for media and DB data):
```bash
cd travel-agency-back && docker compose build --no-cache web && docker compose up -d web
```

## Port Map

| Service | Local Port | Container Port |
|---------|-----------|----------------|
| Django API | 8081 | 8000 |
| Next.js dev | 3000 | — |
| WAHA (WhatsApp) | 3100 | 3000 |
| whatsapp-service | 3005 | 3001 |
| Redis | 6380 | 6379 |
| PostgreSQL | 5432 | 5432 |

## Environment Setup

### `travel-agency-back/.env` (required):
```env
SECRET_KEY=django-insecure-change-this-in-production
DEBUG=True
ALLOWED_HOSTS=*
DB_NAME=agencia_turismo
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
CORS_ALLOW_ALL_ORIGINS=True
CORS_ALLOWED_ORIGINS=http://localhost:3000
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your@email.com
EMAIL_HOST_PASSWORD=your_app_password
DEFAULT_FROM_EMAIL=TravelAgency <your@email.com>
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### `travel-agency-front/.env.local` (required):
```env
NEXT_PUBLIC_API_URL=http://localhost:8081/api/
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:8081/ws/whatsapp/
```

### `whatsapp-service/.env` (only needed for local dev without Docker):
```env
REDIS_URL=redis://localhost:6380
WAHA_URL=http://localhost:3100
WAHA_SESSION=default
WAHA_API_KEY=6f5f7e54c738442788126099e526a113
DJANGO_DELIVERY_URL=http://localhost:8081/api/whatsapp/delivery/
PORT=3001
```

## Django Backend Architecture

Apps live in `applications/`:

| App | Responsibility |
|-----|---------------|
| `authentication` | JWT auth, user profiles, notifications |
| `packages` | Travel packages, categories, itineraries |
| `destinations` | Destinations and geographic data |
| `hotels` / `flights` / `activities` | Inventory models |
| `bookings` | Booking lifecycle, Stripe payments |
| `promotions` | Coupons, wishlists |
| `inquiries` | Contact form submissions |
| `whatsapp` | WhatsApp integration (see below) |

Config lives in `config/` (settings, urls, asgi, wsgi).

**Authentication:** JWT via SimpleJWT. Token stored in frontend localStorage as `ta_access`. All admin endpoints require `IsAdminUser`.

**ASGI:** The server runs Uvicorn with Django Channels for WebSocket support (`ws://host/ws/whatsapp/`). The channel layer uses Redis.

## WhatsApp Integration Architecture

```
[Next.js Admin] ←WebSocket→ [Django Channels]
       ↓                           ↑
   REST API              webhook + delivery callback
       ↓                           ↑
[whatsapp-service]────────────[WAHA Docker]
 BullMQ + Redis                    ↓
                             [WhatsApp]
```

**Outgoing message flow:**
1. Frontend → `POST /api/whatsapp/send/` → Django creates `WhatsAppMessage(status=queued)`
2. Django → `POST whatsapp-service:3001/api/queue/message` with `delay_ms`
3. BullMQ worker waits `delay_ms` → calls WAHA `sendText`
4. WAHA returns message ID (object `{_serialized, id, ...}`) → worker extracts `_serialized`
5. Worker → `POST /api/whatsapp/delivery/` → Django updates `waha_message_id` and `status=sent`
6. WAHA sends `message.ack` webhook → Django `_handle_ack` updates status (sent/delivered/read)

**Incoming message flow:**
1. WAHA → `POST /api/whatsapp/webhook/` (AllowAny) with `event: "message"`
2. Django `_handle_incoming`: deduplicates by `waha_message_id` before saving
3. Django broadcasts via WebSocket → frontend invalidates React Query cache

**Account isolation:** `WhatsAppAccount` stores the connected phone number. `WhatsAppConversation.owner_phone` scopes conversations to that account. Connecting with a different number hides previous conversations.

**WAHA quirks to know:**
- Message ID comes as object `{fromMe, remote, id, _serialized}` — always extract `_serialized`
- Webhook fires twice for some messages — deduplicated in `_handle_incoming` by checking existing `waha_message_id`
- Session `GET /api/sessions/{name}` returns 404 immediately after creation — fallback to list all sessions
- WAHA dashboard: `http://localhost:3100` (admin / b20be94640fd4d05a776c82926b5d0ee)

## Frontend Architecture

App Router with `(admin)` route group at `src/app/(admin)/admin/`. Admin layout has a sidebar only (no top navbar) — the page fills `h-screen`.

**Key conventions:**
- API calls via `src/lib/api/client.ts` (axios instance with JWT interceptor) using endpoints from `src/lib/api/endpoints.ts`
- WhatsApp API helpers in `src/lib/api/whatsapp.ts`
- Real-time updates via `src/hooks/useWhatsApp.ts` (WebSocket) — only calls `queryClient.invalidateQueries`, does not manually update cache
- Brand colors: `brand-wine=#622347`, `brand-darkest=#0E1D21`, `brand-dark=#122E34`, `brand-steel=#677E8A`, `brand-rose=#E0B4B2`
- Access token: `localStorage.getItem('ta_access')` via `getAccessToken()` from `@/lib/api/client`

**WhatsApp pages:**
- `/admin/whatsapp` — main chat panel (`page.tsx` manages all state, passes modal open/close props down to `ConversationList`)
- `/admin/whatsapp/campaigns` — campaign management

## Common Development Tasks

**Run Django shell:**
```bash
docker compose exec web python manage.py shell
```

**Check Django logs:**
```bash
docker compose logs web -f --tail=50
```

**Rebuild only whatsapp-service after JS changes:**
```bash
docker compose build --no-cache whatsapp-service && docker compose up -d whatsapp-service
```

**Bull Board (queue monitor):** `http://localhost:3005/admin/queues`

**WAHA API docs:** `http://localhost:3100`
