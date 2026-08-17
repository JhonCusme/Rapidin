# Rapidin 🛵

Plataforma de entregas hiperrápida (estilo Uber Eats / Rappi / PedidosYa) con 4 aplicaciones:
cliente, comercio, repartidor y super admin, backend en Express + SQLite y sincronización en
tiempo real con Socket.IO.

## Requisitos

- Node.js 18+
- npm

## Puesta en marcha (desarrollo)

```bash
npm install
cp .env.example .env      # ajusta los valores, ver sección "Variables de entorno"
npm run db:init            # crea db/rapidin.db a partir de shared/schema.sql
npm run db:seed            # carga comercios y productos de ejemplo (db/data.js)
npm start                  # arranca el servidor Express + Socket.IO en el puerto 3000
```

Abre `http://localhost:3000` para ver el panel de demostración con las 4 apps, o entra
directamente a cada una:

- Cliente: `http://localhost:3000/apps/user/index.html`
- Comercio: `http://localhost:3000/apps/store/index.html`
- Repartidor: `http://localhost:3000/apps/driver/index.html`
- Super Admin: `http://localhost:3000/apps/admin/index.html`

## Variables de entorno (`.env`)

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor (por defecto 3000) |
| `NODE_ENV` | `development` o `production` |
| `JWT_SECRET` | Secreto para firmar los tokens de sesión. **Obligatorio en producción.** |
| `ADMIN_SETUP_KEY` | Clave requerida para crear la cuenta de super admin. Sin ella, el registro de admin está deshabilitado. |
| `ALLOWED_ORIGINS` | Orígenes permitidos por CORS, separados por coma |

## Crear la cuenta de Super Admin

No existe un formulario público de registro de administrador (por seguridad). Con el servidor
corriendo y `ADMIN_SETUP_KEY` configurado en `.env`, crea la cuenta una sola vez con:

```bash
curl -X POST http://localhost:3000/api/auth/register-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"tu-correo@rapidin.com","password":"una-contraseña-fuerte","name":"Tu Nombre","setupKey":"EL_VALOR_DE_ADMIN_SETUP_KEY"}'
```

Luego inicia sesión normalmente desde `apps/admin/index.html`.

## Seguridad

- Todas las rutas de pedidos y del panel admin requieren un JWT válido (`Authorization: Bearer <token>`)
  y verifican el rol/propiedad del recurso.
- Las contraseñas se guardan con `bcrypt`.
- CORS restringido a `ALLOWED_ORIGINS`, rate limiting en `/api/auth/*`, cabeceras de seguridad con
  `helmet`.
- El contenido generado por otros usuarios (nombres, direcciones, mensajes) se escapa antes de
  insertarse en el DOM (`escapeHtml`, ver `shared/ui-core.js`) para prevenir XSS.
- `.env` y las bases de datos SQLite nunca se suben al repositorio (ver `.gitignore`).

## Estructura

```
server.js         Backend Express + SQLite + Socket.IO
db/                Inicialización, seed y datos de ejemplo
shared/            Módulos JS compartidos entre las 4 apps (auth, sync, chat, pagos, UI, i18n)
apps/user/         App del cliente
apps/store/        App del comercio
apps/driver/       App del repartidor
apps/admin/        Panel del super admin
```

## Build nativo (Android / iOS) con Capacitor

```bash
npm run cap:add:android
npm run cap:sync
npm run cap:open:android
```
