/*
 * Cafam Monitoring - Estación por USB (SIN WiFi)
 * ==============================================
 * Tu código original (2x SHT31 + OLED + LEDs + buzzer) + una línea de
 * datos "DATA,..." que el puente en la computadora lee por USB y reenvía
 * a la nube. El ESP32 NO necesita WiFi.
 *
 * Formato de la línea que lee el puente:
 *   DATA,HAB-01,24.10,49.00
 *   DATA,NEV-01,5.30,57.00
 */

#include <Wire.h>
#include <U8g2lib.h>
#include <Adafruit_SHT31.h>

U8G2_SH1106_128X64_NONAME_F_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE);

Adafruit_SHT31 shtHabitacion = Adafruit_SHT31();
Adafruit_SHT31 shtNevera     = Adafruit_SHT31();
#define SHT_HABITACION_ADDR 0x44
#define SHT_NEVERA_ADDR     0x45

// Códigos de sensor (deben existir en la app)
#define CODE_HABITACION "HAB-01"
#define CODE_NEVERA     "NEV-01"

#define LED_VERDE_HAB 18
#define LED_ROJO_HAB  19
#define LED_VERDE_NEV 25
#define LED_ROJO_NEV  26
#define BUZZER_PIN    23
#define SWITCH_MUTE   27

#define TEMP_AMBIENTE_MIN 18.0
#define TEMP_AMBIENTE_MAX 28.0
#define TEMP_NEVERA_MIN    2.0
#define TEMP_NEVERA_MAX    8.0
#define HUM_NEVERA_MAX    85.0

void mostrarTitulo(const char* titulo) {
  oled.setFont(u8g2_font_6x10_tr);
  oled.drawStr(10, 10, titulo);
  oled.drawHLine(0, 12, 128);
}
void mostrarSeccion(const char* nombre, float temp, float hum, bool error, bool alarma, int yBase) {
  oled.setFont(u8g2_font_6x10_tr);
  oled.drawStr(0, yBase, nombre);
  if (error) { oled.drawStr(75, yBase, "ERROR"); oled.drawStr(0, yBase + 12, "No lectura sensor"); return; }
  oled.setCursor(0, yBase + 12); oled.print("T:"); oled.print(temp, 1); oled.print(" C");
  oled.setCursor(70, yBase + 12); oled.print("H:"); oled.print(hum, 0); oled.print(" %");
  oled.setCursor(95, yBase); oled.print(alarma ? "AL" : "OK");
}
void actualizarLEDs(bool alarmaHab, bool alarmaNev) {
  digitalWrite(LED_VERDE_HAB, alarmaHab ? LOW : HIGH);
  digitalWrite(LED_ROJO_HAB,  alarmaHab ? HIGH : LOW);
  digitalWrite(LED_VERDE_NEV, alarmaNev ? LOW : HIGH);
  digitalWrite(LED_ROJO_NEV,  alarmaNev ? HIGH : LOW);
}
void controlarBuzzer(bool alarmaNev, bool mute) {
  if (alarmaNev && !mute) tone(BUZZER_PIN, 2000); else noTone(BUZZER_PIN);
}

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  oled.begin();
  oled.clearBuffer();
  mostrarTitulo("INICIANDO SISTEMA");
  oled.drawStr(0, 30, "OLED + 2 SHT31 (USB)");
  oled.drawStr(0, 45, "Esperando sensores...");
  oled.sendBuffer();
  delay(1500);

  if (!shtHabitacion.begin(SHT_HABITACION_ADDR)) Serial.println("Error: no se detecto SHT31 Habitacion");
  else Serial.println("SHT31 Habitacion OK");
  if (!shtNevera.begin(SHT_NEVERA_ADDR)) Serial.println("Error: no se detecto SHT31 Nevera");
  else Serial.println("SHT31 Nevera OK");

  pinMode(LED_VERDE_HAB, OUTPUT); pinMode(LED_ROJO_HAB, OUTPUT);
  pinMode(LED_VERDE_NEV, OUTPUT); pinMode(LED_ROJO_NEV, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT); pinMode(SWITCH_MUTE, INPUT_PULLUP);
  digitalWrite(LED_VERDE_HAB, LOW); digitalWrite(LED_ROJO_HAB, LOW);
  digitalWrite(LED_VERDE_NEV, LOW); digitalWrite(LED_ROJO_NEV, LOW);
  noTone(BUZZER_PIN);
}

void loop() {
  bool buzzerMute = (digitalRead(SWITCH_MUTE) == LOW);

  float tempHab = shtHabitacion.readTemperature();
  float humHab  = shtHabitacion.readHumidity();
  float tempNev = shtNevera.readTemperature();
  float humNev  = shtNevera.readHumidity();

  bool errorHab = isnan(tempHab) || isnan(humHab);
  bool errorNev = isnan(tempNev) || isnan(humNev);

  bool alarmaHab = errorHab || (tempHab < TEMP_AMBIENTE_MIN || tempHab > TEMP_AMBIENTE_MAX);
  bool alarmaNev = errorNev || (tempNev < TEMP_NEVERA_MIN || tempNev > TEMP_NEVERA_MAX || humNev > HUM_NEVERA_MAX);

  actualizarLEDs(alarmaHab, alarmaNev);
  controlarBuzzer(alarmaNev, buzzerMute);

  // === LÍNEA DE DATOS que lee el puente en la computadora (USB) ===
  if (!errorHab) { Serial.print("DATA,"); Serial.print(CODE_HABITACION); Serial.print(","); Serial.print(tempHab,2); Serial.print(","); Serial.println(humHab,2); }
  if (!errorNev) { Serial.print("DATA,"); Serial.print(CODE_NEVERA);     Serial.print(","); Serial.print(tempNev,2); Serial.print(","); Serial.println(humNev,2); }

  // Info legible (opcional)
  Serial.print("HABITACION T:"); Serial.print(tempHab,1); Serial.print(" H:"); Serial.print(humHab,1);
  Serial.print(" | NEVERA T:"); Serial.print(tempNev,1); Serial.print(" H:"); Serial.println(humNev,1);

  oled.clearBuffer();
  mostrarTitulo("MONITOREO AMBIENTAL");
  mostrarSeccion("HABITACION", tempHab, humHab, errorHab, alarmaHab, 24);
  oled.drawHLine(0, 40, 128);
  mostrarSeccion("NEVERA", tempNev, humNev, errorNev, alarmaNev, 52);
  oled.setFont(u8g2_font_5x7_tr);
  oled.drawStr(112, 10, "USB");
  oled.sendBuffer();

  delay(3000); // envía cada 3 s
}
