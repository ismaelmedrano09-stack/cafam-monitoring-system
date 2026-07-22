/*
 * Cafam Monitoring - Estación completa ESP32
 * ==========================================
 * Monitoreo local (OLED + LEDs + buzzer) para HABITACIÓN y NEVERA
 * con 2 sensores SHT31, MÁS envío a la nube por WiFi + MQTT.
 *
 * El buzzer/LEDs/OLED SIEMPRE funcionan aunque no haya internet
 * (la parte de red es no bloqueante y no congela la alarma local).
 *
 * Cada sensor se publica por separado en su propio código:
 *   HABITACION -> HAB-01
 *   NEVERA     -> NEV-01
 * Esos códigos DEBEN existir en la app (menú Sensores) con esos mismos códigos.
 *
 * Librerías: U8g2, Adafruit SHT31, Adafruit Unified Sensor, PubSubClient.
 */

#include <Wire.h>
#include <U8g2lib.h>
#include <Adafruit_SHT31.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>

// ======================================================
// CONFIGURACIÓN DE RED (EDITA ESTO)
// ======================================================
const char* WIFI_SSID     = "NOMBRE_DEL_WIFI";
const char* WIFI_PASSWORD = "CLAVE_DEL_WIFI";

const char* MQTT_HOST = "xxxxxxxx.s1.eu.hivemq.cloud"; // host de HiveMQ Cloud (sin https ni puerto)
const int   MQTT_PORT = 8883;                          // 8883 = TLS
const char* MQTT_USER = "cafam_sensor";
const char* MQTT_PASS = "TU_CLAVE_MQTT";

// Códigos de sensor (deben existir en la app con estos mismos códigos)
const char* CODE_HABITACION = "HAB-01";
const char* CODE_NEVERA     = "NEV-01";

// Cada cuánto ENVIAR a la nube (ms). El OLED sigue refrescando cada 2 s.
// 10 s = actualización casi en tiempo real. Súbelo a 60000 (1 min) para ahorrar datos.
const unsigned long PUBLISH_MS = 10000; // 10 s
// ======================================================

// ======================================================
// OLED
// ======================================================
U8G2_SH1106_128X64_NONAME_F_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE);

// ======================================================
// SENSORES SHT31
// ======================================================
Adafruit_SHT31 shtHabitacion = Adafruit_SHT31();
Adafruit_SHT31 shtNevera     = Adafruit_SHT31();

#define SHT_HABITACION_ADDR 0x44
#define SHT_NEVERA_ADDR     0x45

// ======================================================
// PINES
// ======================================================
#define LED_VERDE_HAB 18
#define LED_ROJO_HAB  19
#define LED_VERDE_NEV 25
#define LED_ROJO_NEV  26

#define BUZZER_PIN    23
#define SWITCH_MUTE   27   // Switch para silenciar buzzer

// ======================================================
// RANGOS (alarma LOCAL; la nube usa los rangos registrados en la app)
// ======================================================
#define TEMP_AMBIENTE_MIN 18.0
#define TEMP_AMBIENTE_MAX 28.0

#define TEMP_NEVERA_MIN    2.0
#define TEMP_NEVERA_MAX    8.0
#define HUM_NEVERA_MAX    85.0

// ======================================================
// RED (WiFi + MQTT) - no bloqueante
// ======================================================
WiFiClientSecure netClient;
PubSubClient mqtt(netClient);
unsigned long ultimaPublicacion = 0;
unsigned long ultimoIntentoMqtt = 0;
unsigned long ultimoIntentoWifi = 0;
bool netOk = false;

void intentarConectarRed() {
  // WiFi: NO llamar begin() en cada ciclo (interrumpe la conexión).
  // Solo reintenta cada 20 s si sigue sin conectar.
  if (WiFi.status() != WL_CONNECTED) {
    netOk = false;
    if (millis() - ultimoIntentoWifi > 20000) {
      ultimoIntentoWifi = millis();
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
    return;
  }
  // MQTT: reintenta como máximo cada 15 s para no congelar el loop
  if (!mqtt.connected()) {
    if (millis() - ultimoIntentoMqtt < 15000) { netOk = false; return; }
    ultimoIntentoMqtt = millis();
    String clientId = "cafam-estacion-" + String((uint32_t)ESP.getEfuseMac(), HEX);
    netOk = mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS);
  } else {
    netOk = true;
  }
}

void publicarSensor(const char* code, float temp, float hum, bool error) {
  if (!mqtt.connected() || error) return;
  char topic[64];
  snprintf(topic, sizeof(topic), "sensores/%s/data", code);
  char payload[160];
  snprintf(payload, sizeof(payload),
           "{\"sensorCode\":\"%s\",\"temperature\":%.2f,\"humidity\":%.2f}",
           code, temp, hum);
  mqtt.publish(topic, payload);
  Serial.print("MQTT -> "); Serial.println(payload);
}

// ======================================================
// FUNCIONES AUXILIARES (OLED/LEDs/buzzer) - sin cambios
// ======================================================
void mostrarTitulo(const char* titulo) {
  oled.setFont(u8g2_font_6x10_tr);
  oled.drawStr(10, 10, titulo);
  oled.drawHLine(0, 12, 128);
}

void mostrarSeccion(const char* nombre, float temp, float hum, bool error, bool alarma, int yBase) {
  oled.setFont(u8g2_font_6x10_tr);
  oled.drawStr(0, yBase, nombre);
  if (error) {
    oled.drawStr(75, yBase, "ERROR");
    oled.drawStr(0, yBase + 12, "No lectura sensor");
    return;
  }
  oled.setCursor(0, yBase + 12);
  oled.print("T:"); oled.print(temp, 1); oled.print(" C");
  oled.setCursor(70, yBase + 12);
  oled.print("H:"); oled.print(hum, 0); oled.print(" %");
  oled.setCursor(95, yBase);
  oled.print(alarma ? "AL" : "OK");
}

void actualizarLEDs(bool alarmaHab, bool alarmaNev) {
  digitalWrite(LED_VERDE_HAB, alarmaHab ? LOW : HIGH);
  digitalWrite(LED_ROJO_HAB,  alarmaHab ? HIGH : LOW);
  digitalWrite(LED_VERDE_NEV, alarmaNev ? LOW : HIGH);
  digitalWrite(LED_ROJO_NEV,  alarmaNev ? HIGH : LOW);
}

void controlarBuzzer(bool alarmaNev, bool mute) {
  if (alarmaNev && !mute) tone(BUZZER_PIN, 2000);
  else noTone(BUZZER_PIN);
}

// ======================================================
// SETUP
// ======================================================
void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);

  oled.begin();
  oled.clearBuffer();
  mostrarTitulo("INICIANDO SISTEMA");
  oled.drawStr(0, 30, "OLED + 2 SHT31 + WiFi");
  oled.drawStr(0, 45, "Esperando sensores...");
  oled.sendBuffer();
  delay(1500);

  if (!shtHabitacion.begin(SHT_HABITACION_ADDR)) Serial.println("Error: no se detecto SHT31 Habitacion");
  else Serial.println("SHT31 Habitacion OK");
  if (!shtNevera.begin(SHT_NEVERA_ADDR)) Serial.println("Error: no se detecto SHT31 Nevera");
  else Serial.println("SHT31 Nevera OK");

  pinMode(LED_VERDE_HAB, OUTPUT); pinMode(LED_ROJO_HAB, OUTPUT);
  pinMode(LED_VERDE_NEV, OUTPUT); pinMode(LED_ROJO_NEV, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(SWITCH_MUTE, INPUT_PULLUP);
  digitalWrite(LED_VERDE_HAB, LOW); digitalWrite(LED_ROJO_HAB, LOW);
  digitalWrite(LED_VERDE_NEV, LOW); digitalWrite(LED_ROJO_NEV, LOW);
  noTone(BUZZER_PIN);

  // Red
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  netClient.setInsecure();            // prototipo: no valida el certificado del broker
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
}

// ======================================================
// LOOP
// ======================================================
void loop() {
  // --- Red (no bloqueante) ---
  intentarConectarRed();
  mqtt.loop();

  bool buzzerMute = (digitalRead(SWITCH_MUTE) == LOW);

  // --- Lecturas ---
  float tempHab = shtHabitacion.readTemperature();
  float humHab  = shtHabitacion.readHumidity();
  float tempNev = shtNevera.readTemperature();
  float humNev  = shtNevera.readHumidity();

  bool errorHab = isnan(tempHab) || isnan(humHab);
  bool errorNev = isnan(tempNev) || isnan(humNev);

  // --- Alarmas locales ---
  bool alarmaHab = errorHab || (tempHab < TEMP_AMBIENTE_MIN || tempHab > TEMP_AMBIENTE_MAX);
  bool alarmaNev = errorNev || (tempNev < TEMP_NEVERA_MIN || tempNev > TEMP_NEVERA_MAX || humNev > HUM_NEVERA_MAX);

  actualizarLEDs(alarmaHab, alarmaNev);
  controlarBuzzer(alarmaNev, buzzerMute);

  // --- Envío a la nube (cada PUBLISH_MS) ---
  if (millis() - ultimaPublicacion >= PUBLISH_MS) {
    ultimaPublicacion = millis();
    publicarSensor(CODE_HABITACION, tempHab, humHab, errorHab);
    publicarSensor(CODE_NEVERA, tempNev, humNev, errorNev);
  }

  // --- Serial ---
  Serial.println("==================================");
  Serial.print("Red: "); Serial.print(WiFi.status()==WL_CONNECTED ? "WiFi OK" : "sin WiFi");
  Serial.print(" | MQTT: "); Serial.println(mqtt.connected() ? "conectado" : "desconectado");
  Serial.print("HABITACION -> T: "); Serial.print(tempHab,1); Serial.print(" C | H: "); Serial.print(humHab,1); Serial.print(" % | "); Serial.println(alarmaHab?"ALERTA":"OK");
  Serial.print("NEVERA -> T: "); Serial.print(tempNev,1); Serial.print(" C | H: "); Serial.print(humNev,1); Serial.print(" % | "); Serial.println(alarmaNev?"ALERTA":"OK");

  // --- OLED ---
  oled.clearBuffer();
  mostrarTitulo("MONITOREO AMBIENTAL");
  mostrarSeccion("HABITACION", tempHab, humHab, errorHab, alarmaHab, 24);
  oled.drawHLine(0, 40, 128);
  mostrarSeccion("NEVERA", tempNev, humNev, errorNev, alarmaNev, 52);
  // indicador de conexión en la esquina
  oled.setFont(u8g2_font_5x7_tr);
  oled.drawStr(112, 10, netOk ? "NET" : "---");
  oled.sendBuffer();

  delay(2000);
}
