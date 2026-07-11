# Guía de despliegue

Esta guía deja el proyecto listo para llevarlo a un VPS o servidor propio.

## 1. Preparar servidor

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

Para producción se recomienda correrlo con `pm2`, systemd o un contenedor Docker dedicado.

## 6. Frontend

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

Usa Certbot, Caddy o el panel del proveedor para emitir SSL. En producción usa siempre HTTPS porque el sistema maneja sesiones, contactos y correos.

## 8. Checklist de producción

- Cambiar todas las contraseñas de ejemplo.
- Usar `JWT_SECRET` largo y aleatorio.
- Activar SMTP real.
- Configurar dominio en `FRONTEND_URL`.
- Restringir MySQL al servidor, no exponerlo públicamente si no es necesario.
- Configurar backups de la base de datos.
- Validar reportes PDF/XLSX.
- Validar envío de alertas.
- Configurar monitoreo de logs.
