# Simulador de sensores

```bash
cd simulator
npm install
cp .env.example .env
npm run simulate:mixed
```

Modos disponibles:

- `npm run simulate:normal`
- `npm run simulate:warning`
- `npm run simulate:critical`
- `npm run simulate:mixed`

Por defecto publica por MQTT en `sensores/<codigo>/data`. Para insertar vía API, cambie `PUBLISH_MODE=api` y agregue un JWT válido en `API_TOKEN`.
