# Backend Cafam Monitoring

API Express con TypeScript para telemetría IoT de temperatura y humedad.

## Instalación

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Compilar:

```bash
npm run build
```

## Base de datos

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

## Usuarios semilla

- `admin@cafam.test` / `Admin123*`
- `regente@cafam.test` / `Regente123*`
- `calidad@cafam.test` / `Calidad123*`

## API del centro de monitoreo

- `GET /api/monitoring/overview`
- `GET /api/monitoring/contacts`
- `POST /api/monitoring/contacts`
- `GET /api/monitoring/files/sensor/:sensorId`
- `POST /api/monitoring/files`
- `GET /api/monitoring/extrema?days=30`
- `GET /api/monitoring/areas`
- `GET /api/monitoring/sites`
- `POST /api/monitoring/sites`
- `PUT /api/monitoring/sites/:id`
