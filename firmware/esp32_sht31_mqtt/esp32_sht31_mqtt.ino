/*
 * Cafam Monitoring - Nodo sensor ESP32 + SHT31 (DFRobot SEN0334)
 * ----------------------------------------------------------------
 * Lee temperatura y humedad del sensor SHT31 por I2C y las publica
 * por MQTT en el formato que espera el backend Cafam Monitoring:
 *
 *   Topico:  sensores/<SENSOR_CODE>/data
 *   Payload: {"sensorCode":"NEV-01","temperature":4.5,"humidity":55.2,"battery":100}
 *
 * IMPORTANTE: SENSOR_CODE debe coincidir EXACTAMENTE con el "código"
 * de un sensor ya registrado en la aplicación (menú Sensores).
 *
 * Librerias necesarias (Arduino IDE -> Gestor de librerias):
 *   - Adafruit SHT31 Library   (funciona con el SHT31 del SEN0334)
 *   - Adafruit Unified Sensor  (dependencia de la anterior)
 *   - PubSubClient             (MQTT)
 * Placa: "ESP32 Dev Module" (instalar el soporte de placas esp32)
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_SHT31.h>

// ====================== CONFIGURACIÓN (EDITA ESTO) ======================
// --- WiFi de la clínica ---
const char* WIFI_SSID     = "NOMBRE_DEL_WIFI";
const char* WIFI_PASSWORD = "CLAVE_DEL_WIFI";

// --- Broker MQTT (HiveMQ Cloud). Usa el host que te da HiveMQ ---
const char* MQTT_HOST = "xxxxxxxx.s1.eu.hivemq.cloud"; // sin https:// ni puerto
const int   MQTT_PORT = 8883;                          // 8883 = TLS (HiveMQ Cloud)
const char* MQTT_USER = "cafam_sensor";                // usuario que creaste en HiveMQ
const char* MQTT_PASS = "TU_CLAVE_MQTT";

// --- Identidad de ESTE sensor (debe existir en la app con este código) ---
const char* SENSOR_CODE = "NEV-01";

// --- Cada cuánto enviar una lectura (milisegundos). 60000 = 1 min ---
const unsigned long INTERVALO_MS = 60000;
// =======================================================================

// Dirección I2C del SHT31: el SEN0334 suele ser 0x45. Si no responde, prueba 0x44.
#define SHT31_ADDR 0x45

Adafruit_SHT31 sht31 = Adafruit_SHT31();
WiFiClientSecure netClient;
PubSubClient mqtt(netClient);

char topic[64];
unsigned long ultimaLectura = 0;

void conectarWiFi() {
  Serial.print("Conectando a WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.print("\nWiFi OK. IP: ");
  Serial.println(WiFi.localIP());
}

void conectarMQTT() {
  while (!mqtt.connected()) {
    Serial.print("Conectando a MQTT...");
    String clientId = "cafam-" + String(SENSOR_CODE) + "-" + String((uint32_t)ESP.getEfuseMac(), HEX);
    if (mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
      Serial.println(" conectado.");
    } else {
      Serial.print(" fallo, rc=");
      Serial.print(mqtt.state());
      Serial.println(" reintento en 5s");
      delay(5000);
    }
  }
}

void publicarLectura() {
  float t = sht31.readTemperature();
  float h = sht31.readHumidity();

  if (isnan(t) || isnan(h)) {
    Serial.println("Error leyendo el SHT31 (revisa cableado/dirección I2C).");
    return;
  }

  // Construir el JSON exacto que espera el backend
  char payload[160];
  snprintf(payload, sizeof(payload),
           "{\"sensorCode\":\"%s\",\"temperature\":%.2f,\"humidity\":%.2f,\"battery\":100}",
           SENSOR_CODE, t, h);

  if (mqtt.publish(topic, payload)) {
    Serial.print("Publicado -> ");
    Serial.println(payload);
  } else {
    Serial.println("Fallo al publicar.");
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Wire.begin(); // ESP32: SDA=21, SCL=22 por defecto

  if (!sht31.begin(SHT31_ADDR)) {
    Serial.println("No se encontró el SHT31. Prueba cambiando SHT31_ADDR a 0x44.");
  }

  snprintf(topic, sizeof(topic), "sensores/%s/data", SENSOR_CODE);

  conectarWiFi();
  // Para prototipo: no valida el certificado del broker (más simple).
  // En producción, carga el certificado raíz del broker con netClient.setCACert(...).
  netClient.setInsecure();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) conectarWiFi();
  if (!mqtt.connected()) conectarMQTT();
  mqtt.loop();

  if (millis() - ultimaLectura >= INTERVALO_MS) {
    ultimaLectura = millis();
    publicarLectura();
  }
}
