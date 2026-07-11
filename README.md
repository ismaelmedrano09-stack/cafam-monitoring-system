# Sistema de Telemetría Cafam

Plataforma web para monitorear en tiempo real temperatura y humedad relativa en espacios controlados de Clínicas Cafam. Incluye backend Express con TypeScript, frontend Vue 3 con TypeScript, base de datos MySQL, integración MQTT, simulador de sensores y reportes PDF/Excel.

## Estructura

```text
cafam-monitoring-system/
  backend/
  frontend/
  simulator/
```

## 1. Base de datos MySQL

Opción recomendada con Docker:

```bash
docker compose up -d mysql
```

Esto crea MySQL 8.4 en `localhost:3306`, la base `cafam_monitoring`, y carga `schema.sql` + `seed.sql`.

Credenciales locales:

```text
DB_USER=root
DB_PASSWORD=cafam_root_123
DB_NAME=cafam_monitoring
```

Opción con MySQL instalado en Windows:

```bash
cd backend
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

La base creada se llama `cafam_monitoring`.

## 2. Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

API local: `http://localhost:4000/api`

Variables principales:

```text
PORT=4000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=cafam_monitoring
JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=8h
MQTT_URL=mqtt://localhost:1883
FRONTEND_URL=http://localhost:5173
```

## 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Aplicación local: `http://localhost:5173`

## 4. Simulador

```bash
cd simulator
npm install
cp .env.example .env
npm run simulate:mixed
```

Comandos:

```bash
npm run simulate:normal
npm run simulate:warning
npm run simulate:critical
npm run simulate:mixed
```

## Usuarios de prueba

- Administrador: `admin@cafam.test` / `Admin123*`
- Regente: `regente@cafam.test` / `Regente123*`
- Calidad: `calidad@cafam.test` / `Calidad123*`

## Funcionalidades implementadas

- Login con JWT y contraseñas bcrypt.
- Roles y middleware de autorización.
- Dashboard con tarjetas de estado y gráficas Chart.js.
- Gestión de sensores y rangos críticos con auditoría de cambios.
- Registro y consulta de lecturas.
- Motor automático de alarmas por rangos y sensor sin reporte.
- Atención/cierre de alarmas con acción correctiva obligatoria.
- Reportes PDF y Excel.
- Auditoría de acciones importantes.
- Simulador MQTT/API para lecturas normales, advertencia, críticas y mixtas.
- Migración inicial a TypeScript en backend y frontend.
- Centro de monitoreo por sedes con mapa geográfico.
- Estado de batería, energía, firmware y última conexión por dispositivo.
- Contactos de notificación por sede y nivel de alarma.
- Trazabilidad de notificaciones por correo, SMS o llamada.
- Documentos asociados a cada sensor: calibración, certificados, manuales y mantenimiento.
- Reporte de temperaturas y humedades máximas, mínimas y promedio hasta 30 días.
- Módulo de áreas monitoreadas con gráfica histórica de temperatura.
- Visualización del rango permitido, umbrales de tolerancia y puntos de alarma crítica por área.
- Navegación agrupada por General, Operación, Evidencia y Administración.
- Alarmas y acciones correctivas consolidadas en una sola vista con pestañas.
- Menú adaptado automáticamente a los permisos de cada rol.
- Administración unificada de sedes, locaciones, zonas y sensores.
- Registro de nuevas sedes con dirección y coordenadas geográficas.
- Asociación de sensores nuevos con una sede y una zona monitoreada.
- Menú lateral adaptable: fijo en escritorio y desplegable en dispositivos móviles.
- Iconos reconocibles y accesos rápidos para las tareas más frecuentes.
- Avisos visuales de éxito y error después de guardar o actualizar información.
- Estados de carga visibles durante la consulta de datos.

## Migraciones

Para una base existente, ejecute:

```bash
Get-Content backend/database/migrations/002_monitoring_center.sql -Raw |
  docker exec -i cafam-monitoring-mysql mysql -uroot -pcafam_root_123
```

La migración agrega datos sin eliminar lecturas, alarmas, usuarios o sensores existentes.

## Comandos de verificación

```bash
cd backend
npm run build
```

```bash
cd frontend
npm run typecheck
npm run build
```

## Integración física pendiente

- Configurar broker MQTT real con TLS y credenciales.
- Registrar certificados o tokens por dispositivo.
- Añadir inventario físico de calibraciones con documentos adjuntos.
- Validar rangos finales con calidad/regulación antes de producción.
