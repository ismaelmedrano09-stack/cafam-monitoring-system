# Plan de pruebas reales

Usa este checklist antes de desplegar o después de subir cambios importantes.

## 1. Salud del sistema

```bash
docker compose ps
curl http://localhost:4000/api/health
```

Resultado esperado:

- MySQL healthy.
- MQTT healthy.
- API responde `200`.
- Frontend carga en `http://localhost:5173`.

## 2. Inicio de sesión

- Entrar con `admin@cafam.test` / `Admin123*`.
- Cerrar sesión.
- Probar credenciales incorrectas.
- Validar que el modo demo no rompa la navegación.

## 3. Lecturas y simulador

Ejecutar:

```bash
cd simulator
npm run simulate:mixed
```

Validar:

- Se crean lecturas nuevas.
- Dashboard se actualiza.
- Sensores muestran última lectura.

## 4. Alarmas automáticas

Generar una lectura crítica desde el simulador o API.

Resultado esperado:

- Se crea alarma abierta.
- Se registra en la cola priorizada.
- No se duplican alarmas abiertas del mismo nivel para el mismo sensor.

## 5. Correos de alerta

Preparar SMTP real en `backend/.env`.

Validar:

- Registro público de contacto.
- Correo de confirmación.
- Confirmación por enlace.
- Contacto queda activo.
- Alarma crítica envía correo al contacto.

## 6. Reportes

Modo real:

- Descargar PDF diario.
- Descargar Excel técnico.
- Abrir ambos archivos.
- Validar hojas históricas por sensor.

Modo demo:

- Descargar reporte ejecutivo.
- Debe bajar `.html`.
- Descargar Excel técnico.
- Debe bajar `.csv`.

## 7. Seguridad mínima

- Confirmar que `.env` no está en Git.
- Confirmar que SMTP_PASS no aparece en GitHub.
- Confirmar que usuarios no administradores no acceden a módulos restringidos.

## 8. Prueba de despliegue

En servidor:

- Clonar repo.
- Crear `.env`.
- Levantar Docker.
- Construir backend y frontend.
- Probar dominio con HTTPS.
