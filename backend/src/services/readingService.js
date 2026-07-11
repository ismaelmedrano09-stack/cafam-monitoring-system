const pool = require('../config/db');
const { classifyReading, createAlarmIfNeeded } = require('./alarmService');

async function createReading({ sensorCode, sensorId, temperature, humidity, batteryLevel = null, source = 'manual', mqttTopic = null, observations = null, timestamp = null }) {
  const [sensors] = sensorCode
    ? await pool.query('SELECT * FROM sensors WHERE code = ? LIMIT 1', [sensorCode])
    : await pool.query('SELECT * FROM sensors WHERE id = ? LIMIT 1', [sensorId]);

  if (!sensors.length) {
    const error = new Error('Sensor no encontrado');
    error.status = 404;
    throw error;
  }

  const sensor = sensors[0];
  const calculatedStatus = classifyReading(sensor, Number(temperature), Number(humidity));
  const createdAt = timestamp ? new Date(timestamp) : new Date();

  const [result] = await pool.query(
    `INSERT INTO readings
      (sensor_id, temperature, humidity, battery_level, calculated_status, source, mqtt_topic, observations, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [sensor.id, temperature, humidity, batteryLevel, calculatedStatus, source, mqttTopic, observations, createdAt]
  );

  await pool.query(
    `UPDATE sensors
     SET last_seen_at = ?, battery_level = COALESCE(?, battery_level),
         power_status = CASE WHEN ? IS NOT NULL AND ? <= 20 THEN 'battery' ELSE 'normal' END,
         status = CASE WHEN status = 'desconectado' THEN 'activo' ELSE status END
     WHERE id = ?`,
    [createdAt, batteryLevel, batteryLevel, batteryLevel, sensor.id]
  );

  const reading = {
    id: result.insertId,
    sensor_id: sensor.id,
    temperature: Number(temperature),
    humidity: Number(humidity),
    battery_level: batteryLevel === null ? null : Number(batteryLevel),
    calculated_status: calculatedStatus,
    source,
    mqtt_topic: mqttTopic,
    created_at: createdAt
  };

  await createAlarmIfNeeded(sensor, reading);
  return reading;
}

module.exports = { createReading };
