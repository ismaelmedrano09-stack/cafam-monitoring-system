require('dotenv').config();

const mqtt = require('mqtt');
const axios = require('axios');

const mode = process.argv[2] || 'mixed';
const publishMode = process.env.PUBLISH_MODE || 'mqtt';
const intervalMs = Number(process.env.INTERVAL_MS || 5000);
const sensors = [
  { code: 'NEV-01', temp: [2, 8], hum: [35, 70] },
  { code: 'CF-01', temp: [2, 8], hum: [30, 75] },
  { code: 'FAR-01', temp: [15, 25], hum: [35, 65] },
  { code: 'MA-01', temp: [15, 25], hum: [35, 65] }
];

let client = null;
if (publishMode === 'mqtt') {
  client = mqtt.connect(process.env.MQTT_URL || 'mqtt://localhost:1883');
  client.on('connect', () => console.log('Simulator connected to MQTT'));
  client.on('error', (error) => console.error('MQTT simulator error:', error.message));
}

function random(min, max) {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10;
}

function readingFor(sensor, selectedMode) {
  if (selectedMode === 'normal') {
    return { temperature: random(sensor.temp[0] + .4, sensor.temp[1] - .4), humidity: random(sensor.hum[0] + 2, sensor.hum[1] - 2) };
  }
  if (selectedMode === 'warning') {
    return { temperature: random(sensor.temp[1] - .3, sensor.temp[1] - .05), humidity: random(sensor.hum[1] - 2, sensor.hum[1] - .2) };
  }
  if (selectedMode === 'critical') {
    const high = Math.random() > .5;
    return {
      temperature: high ? random(sensor.temp[1] + .5, sensor.temp[1] + 4) : random(sensor.temp[0] - 4, sensor.temp[0] - .5),
      humidity: high ? random(sensor.hum[1] + 2, sensor.hum[1] + 12) : random(sensor.hum[0] - 12, sensor.hum[0] - 2)
    };
  }
  if (selectedMode === 'disconnected') return null;
  const roll = Math.random();
  if (roll < .7) return readingFor(sensor, 'normal');
  if (roll < .9) return readingFor(sensor, 'warning');
  return readingFor(sensor, 'critical');
}

async function publish(sensor) {
  const selectedMode = mode === 'mixed' ? 'mixed' : mode;
  const data = readingFor(sensor, selectedMode);
  if (!data) {
    console.log(`${sensor.code} disconnected simulation`);
    return;
  }

  const payload = {
    sensorCode: sensor.code,
    temperature: data.temperature,
    humidity: data.humidity,
    batteryLevel: random(55, 100),
    timestamp: new Date().toISOString()
  };

  if (publishMode === 'api') {
    await axios.post(`${process.env.API_URL || 'http://localhost:4000/api'}/readings/manual`, {
      sensorCode: payload.sensorCode,
      temperature: payload.temperature,
      humidity: payload.humidity,
      batteryLevel: payload.batteryLevel,
      timestamp: payload.timestamp
    }, {
      headers: { Authorization: `Bearer ${process.env.API_TOKEN}` }
    });
  } else {
    client.publish(`sensores/${sensor.code}/data`, JSON.stringify(payload));
  }

  console.log(`${payload.sensorCode}: ${payload.temperature} C / ${payload.humidity}%`);
}

setInterval(() => {
  const sensor = sensors[Math.floor(Math.random() * sensors.length)];
  publish(sensor).catch((error) => console.error('Publish error:', error.response?.data || error.message));
}, intervalMs);

console.log(`Simulator running in ${mode} mode via ${publishMode}`);
