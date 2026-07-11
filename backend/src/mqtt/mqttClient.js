const mqtt = require('mqtt');
const env = require('../config/env');
const { createReading } = require('../services/readingService');

const topics = ['farmacia/+/lecturas', 'cafam/+/temperatura', 'cafam/+/humedad', 'sensores/+/data'];

function startMqtt() {
  if (!env.mqtt.url) return;

  const options = { reconnectPeriod: 5000 };
  if (env.mqtt.username) {
    options.username = env.mqtt.username;
    options.password = env.mqtt.password;
  }
  if (process.env.MQTT_CA_FILE) {
    const fs = require('fs');
    options.ca = fs.readFileSync(process.env.MQTT_CA_FILE);
    options.rejectUnauthorized = process.env.MQTT_REJECT_UNAUTHORIZED !== 'false';
  }

  const client = mqtt.connect(env.mqtt.url, options);

  client.on('connect', () => {
    console.log(`MQTT conectado a ${env.mqtt.url}`);
    topics.forEach((topic) => client.subscribe(topic));
  });

  client.on('message', async (topic, payload) => {
    try {
      const data = JSON.parse(payload.toString());
      await createReading({
        sensorCode: data.sensorCode,
        temperature: data.temperature,
        humidity: data.humidity,
        batteryLevel: data.batteryLevel ?? data.battery,
        timestamp: data.timestamp,
        source: 'MQTT',
        mqttTopic: topic
      });
    } catch (error) {
      console.error('Error al procesar el mensaje MQTT:', error.message);
    }
  });

  client.on('error', (error) => {
    console.error('Error de conexión MQTT:', error.message);
  });
}

module.exports = { startMqtt };
