# Cafam Monitoring System

Aplicación web para monitoreo clínico de temperatura y humedad en áreas controladas. Incluye panel operativo, gestión de sensores, alarmas automáticas, contactos de notificación, reportes PDF/Excel, auditoría, simulador MQTT y base de datos MySQL.

## Módulos principales

- Dashboard operativo con estado general, alarmas y salud de dispositivos.
- Gestión de sedes, áreas, sensores y rangos permitidos.
- Lecturas en tiempo real vía MQTT o API.
- Alarmas automáticas por fuera de rango, advertencia o sensor sin reporte.
- Envío de alertas por correo SMTP a contactos confirmados.
- Reportes diarios, semanales, mensuales y expediente de auditoría.
- Exportación real en PDF/XLSX y exportación demo en HTML/CSV.
- Auditoría de acciones importantes.
- Simulador de sensores para pruebas.

## Estructura

```text
cafam-monitoring-system/
  backend/      API Express, MySQL, MQTT, reportes y notificaciones
  frontend/     Aplicación Vue 3 + TypeScript
  simulator/    Simulador de sensores MQTT/API
  docker/       Configuración de Mosquitto
```

## Requisitos

- Node.js 20 o superior.
- Docker Desktop.
- Git.
- Cuenta SMTP si se desean correos reales.

## Arranque local

1. Copiar variables de entorno:

```bash
copy .env.example .env
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
copy simulator\.env.example simulator\.env
```

2. Levantar MySQL y MQTT:

```bash
docker compose up -d
```

3. Instalar dependencias e iniciar backend:

```bash
cd backend
npm install
npm run dev
```

4. Instalar dependencias e iniciar frontend:

```bash
cd frontend
npm install
npm run dev
```

5. Iniciar simulador opcional:

```bash
cd simulator
npm install
npm run simulate:mixed
```

Aplicación: `http://localhost:5173`  
API: `http://localhost:4000/api/health`

## Usuarios de prueba

- Administrador: `admin@cafam.test` / `Admin123*`
- Regente: `regente@cafam.test` / `Regente123*`
- Calidad: `calidad@cafam.test` / `Calidad123*`

## Variables importantes

No subas archivos `.env` reales al repositorio. Usa los `.env.example` como plantilla.

Backend:

```env
PORT=4000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=change_this_database_password
DB_NAME=cafam_monitoring
JWT_SECRET=change_this_secret
MQTT_URL=mqtt://localhost:1883
FRONTEND_URL=http://localhost:5173
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

## Verificación

Backend:

```bash
cd backend
npm run build
```

Frontend:

```bash
cd frontend
npm run build
```

## Despliegue

Consulta [DEPLOYMENT.md](DEPLOYMENT.md) para preparar un servidor con Docker, variables de entorno, dominio, SSL y SMTP.

## Pruebas reales

Consulta [TESTING.md](TESTING.md) para validar alarmas, correo SMTP, reportes, simulador y flujo operativo antes de publicar.
