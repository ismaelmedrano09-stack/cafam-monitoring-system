/*
 * Puente Serial (USB) -> MQTT -> Cafam Monitoring
 * ================================================
 * Lee las lecturas del ESP32 por el puerto USB (COM) y las reenvía al
 * broker MQTT en la nube. El ESP32 NO necesita WiFi: usa el internet
 * de esta computadora.
 *
 * Uso:  node index.js [PUERTO_COM]
 *   ej: node index.js COM7
 */

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const mqtt = require('mqtt');

// ================= CONFIGURACIÓN =================
const COM_PORT  = process.argv[2] || 'COM7';   // puerto del ESP32
const BAUD_RATE = 115200;

const MQTT_URL  = 'mqtts://b21b997613ee44c5ac3426592bfddd89.s1.eu.hivemq.cloud:8883';
const MQTT_USER = 'cafam_sensor';
const MQTT_PASS = 'joni091830';
// ================================================

console.log(`[puente] Puerto USB: ${COM_PORT} @ ${BAUD_RATE}`);
const client = mqtt.connect(MQTT_URL, { username: MQTT_USER, password: MQTT_PASS, reconnectPeriod: 3000 });
let mqttOk = false;

client.on('connect', () => { mqttOk = true; console.log('[puente] Conectado al broker MQTT en la nube ✓'); });
client.on('reconnect', () => console.log('[puente] Reconectando al broker...'));
client.on('error', (e) => console.error('[puente] Error MQTT:', e.message));

const port = new SerialPort({ path: COM_PORT, baudRate: BAUD_RATE }, (err) => {
  if (err) {
    console.error(`[puente] No se pudo abrir ${COM_PORT}: ${err.message}`);
    console.error('         ¿Está cerrado el Monitor Serie de Arduino? (no puede estar abierto a la vez)');
    process.exit(1);
  }
  console.log(`[puente] Puerto ${COM_PORT} abierto ✓`);
});

const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

parser.on('data', (line) => {
  line = line.trim();
  if (!line.startsWith('DATA,')) return; // ignorar el resto del texto

  const parts = line.split(',');            // DATA,code,temp,hum
  if (parts.length < 4) return;
  const code = parts[1].trim();
  const temperature = parseFloat(parts[2]);
  const humidity = parseFloat(parts[3]);
  if (!code || Number.isNaN(temperature) || Number.isNaN(humidity)) return;

  if (!mqttOk) { console.log('[puente] (esperando broker) ', code, temperature, humidity); return; }

  const topic = `sensores/${code}/data`;
  const payload = JSON.stringify({ sensorCode: code, temperature, humidity });
  client.publish(topic, payload);
  console.log(`[puente] ${new Date().toLocaleTimeString()}  ${code} -> ${temperature.toFixed(1)} C, ${humidity.toFixed(1)} % (enviado a la nube)`);
});

port.on('close', () => { console.log('[puente] Puerto cerrado.'); process.exit(1); });
process.on('SIGINT', () => { console.log('\n[puente] Cerrando...'); client.end(); port.close(); process.exit(0); });
