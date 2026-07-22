# Nodo sensor ESP32 + SHT31 (SEN0334) — Cafam Monitoring

Guía para conectar sensores físicos de temperatura y humedad al sistema.

## 1. Cableado: SHT31 (SEN0334) → ESP32

El SEN0334 usa I²C (4 pines). Conexión al ESP32:

| SEN0334 | ESP32 |
|---------|-------|
| VCC (rojo)    | 3V3 |
| GND (negro)   | GND |
| SDA (verde/azul) | GPIO 21 |
| SCL (amarillo)   | GPIO 22 |

> Si usas el conector Gravity de DFRobot, respeta el color del cable. La dirección I²C por defecto del SEN0334 es **0x45** (si no responde, prueba 0x44 en el código).

## 2. Broker MQTT gratis (HiveMQ Cloud)

1. Crea una cuenta en https://www.hivemq.com/mqtt-cloud-broker/ (plan gratuito, hasta 100 conexiones)
2. Crea un **cluster** gratuito → te da un **host** tipo `xxxx.s1.eu.hivemq.cloud`
3. En **Access Management → Credentials**, crea un usuario/clave (ej. `cafam_sensor` / una clave)
4. Anota: host, puerto **8883** (TLS), usuario y clave

## 3. Configurar el backend (Render)

En Render → servicio del backend → **Environment**, agrega:

```
MQTT_URL=mqtts://xxxx.s1.eu.hivemq.cloud:8883
MQTT_USERNAME=cafam_sensor
MQTT_PASSWORD=tu_clave_mqtt
```

Guarda y deja que Render redepliegue. En los logs debe aparecer `MQTT conectado a ...`.

## 4. Programar el ESP32

1. Instala el **Arduino IDE** y el soporte de placas **esp32** (Gestor de tarjetas)
2. Instala las librerías (Gestor de librerías):
   - `Adafruit SHT31 Library` (+ `Adafruit Unified Sensor`)
   - `PubSubClient`
3. Abre `esp32_sht31_mqtt/esp32_sht31_mqtt.ino`
4. Edita el bloque **CONFIGURACIÓN**: WiFi, datos del broker HiveMQ y el `SENSOR_CODE`
5. Selecciona placa **ESP32 Dev Module**, conecta el ESP32 por USB y sube el código
6. Abre el **Monitor Serie** (115200 baudios) para ver los mensajes publicados

## 5. Registrar el sensor en la app (¡importante!)

El `SENSOR_CODE` del código **debe coincidir** con el **código** de un sensor registrado en la app.

- Entra a la app → **Sensores → Nuevo sensor**
- Pon el mismo código (ej. `NEV-01`), su sede, área y los rangos permitidos (ej. 2–8 °C)
- Guarda

## 6. Verificar

Cuando el ESP32 publique, el sistema:
- Guarda la lectura en la base de datos
- La muestra en el panel en tiempo real
- Genera alarma automática si sale del rango, con notificación por correo/WhatsApp/push

## Formato del mensaje MQTT

- **Tópico:** `sensores/<SENSOR_CODE>/data`
- **Payload:** `{"sensorCode":"NEV-01","temperature":4.5,"humidity":55.2,"battery":100}`

(El backend también escucha: `farmacia/+/lecturas`, `cafam/+/temperatura`, `cafam/+/humedad`.)
