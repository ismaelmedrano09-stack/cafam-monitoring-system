# Guia de despliegue

Esta guia deja el proyecto listo para produccion. La arquitectura recomendada es:

- Frontend en Vercel.
- Backend en VPS, Railway, Render o servidor Node dedicado.
- MySQL en servicio administrado o servidor privado.
- MQTT en servidor privado o broker administrado.

## Frontend en Vercel

El repositorio ya incluye configuracion para Vercel en dos escenarios:

- Si importas el repositorio completo desde GitHub, Vercel puede usar el `vercel.json` de la raiz. Ese archivo instala dependencias en `frontend`, ejecuta el build y publica `frontend/dist`.
- Si en Vercel configuras `Root Directory` como `frontend`, se usa `frontend/vercel.json`.

Configuracion recomendada en Vercel:

```text
Framework Preset: Vite
Root Directory: frontend
Install Command: npm ci
Build Command: npm run build
Output Directory: dist
```

Variables de entorno para Vercel:

```text
VITE_API_URL=https://api.tu-dominio.com/api
VITE_SOCKET_URL=https://api.tu-dominio.com
```

Importante: Vercel solo hospedara el frontend. El backend debe estar publicado en una URL HTTPS externa y esa URL debe coincidir con `VITE_API_URL`.

En el backend debes configurar:

```text
FRONTEND_URL=https://tu-app.vercel.app
```

Eso permite CORS y hace que los correos de confirmacion apunten al frontend publico.

## 1. Preparar servidor para backend

Instala:

- Docker y Docker Compose.
- Node.js 20 o superior.
- Git.
- Nginx o Caddy para dominio y HTTPS.

## 2. Clonar repositorio

```bash
git clone https://github.com/ismaelmedrano09-stack/cafam-monitoring-system.git
cd cafam-monitoring-system
```

## 3. Crear variables de entorno

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp simulator/.env.example simulator/.env
```

Edita los valores reales:

- `MYSQL_ROOT_PASSWORD`
- `DB_PASSWORD`
- `JWT_SECRET`
- `FRONTEND_URL`
- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

## 4. Base de datos y MQTT

```bash
docker compose up -d
```

Verifica:

```bash
docker compose ps
```

## 5. Backend

```bash
cd backend
npm ci
npm run build
npm start
```

Para produccion se recomienda correrlo con `pm2`, systemd o un contenedor Docker dedicado.

## 6. Frontend en servidor propio

Si no usas Vercel y prefieres un servidor propio:

```bash
cd frontend
npm ci
npm run build
```

Sirve `frontend/dist` con Nginx/Caddy. Configura proxy hacia:

```text
/api -> http://localhost:4000/api
```

## 7. HTTPS

Usa Certbot, Caddy o el panel del proveedor para emitir SSL. En produccion usa siempre HTTPS porque el sistema maneja sesiones, contactos y correos.

## 8. Checklist de produccion

- Cambiar todas las contrasenas de ejemplo.
- Usar `JWT_SECRET` largo y aleatorio.
- Activar SMTP real.
- Configurar dominio en `FRONTEND_URL`.
- Configurar `VITE_API_URL` y `VITE_SOCKET_URL` en Vercel.
- Restringir MySQL al servidor, no exponerlo publicamente si no es necesario.
- Configurar backups de la base de datos.
- Validar reportes PDF/XLSX.
- Validar envio de alertas.
- Configurar monitoreo de logs.
