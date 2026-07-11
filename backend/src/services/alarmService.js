const pool = require('../config/db');
const { queueAlarmNotifications } = require('./notificationService');
const { sendAlarmPush } = require('./pushService');

function getIo() {
  try { return require('../app').default?.get?.('io') || require('../app').get?.('io'); } catch { return null; }
}

function classifyReading(sensor, temperature, humidity) {
  const outTemp = temperature < Number(sensor.temp_min) || temperature > Number(sensor.temp_max);
  const outHumidity = humidity < Number(sensor.humidity_min) || humidity > Number(sensor.humidity_max);

  if (outTemp || outHumidity) return 'critico';

  const tempSpan = Number(sensor.temp_max) - Number(sensor.temp_min);
  const humSpan = Number(sensor.humidity_max) - Number(sensor.humidity_min);
  const nearTemp = temperature <= Number(sensor.temp_min) + tempSpan * 0.1 ||
    temperature >= Number(sensor.temp_max) - tempSpan * 0.1;
  const nearHumidity = humidity <= Number(sensor.humidity_min) + humSpan * 0.1 ||
    humidity >= Number(sensor.humidity_max) - humSpan * 0.1;

  if (nearTemp || nearHumidity) return 'advertencia';
  return 'normal';
}

async function createAlarmIfNeeded(sensor, reading) {
  const status = reading.calculated_status;
  if (status === 'normal') return null;

  const level = status === 'critico' ? 'critica' : 'advertencia';
  const type = status === 'critico' ? 'fuera_de_rango' : 'cercano_al_limite';
  const allowedRange = `Temperatura: ${sensor.temp_min}-${sensor.temp_max} °C / Humedad: ${sensor.humidity_min}-${sensor.humidity_max} %`;
  const detectedValue = `Temperatura: ${reading.temperature} °C / Humedad: ${reading.humidity} %`;

  const [open] = await pool.query(
    `SELECT id FROM alarms
     WHERE sensor_id = ? AND status IN ('abierta', 'en_atencion') AND level = ?
     ORDER BY started_at DESC LIMIT 1`,
    [sensor.id, level]
  );
  if (open.length) return open[0];

  const [result] = await pool.query(
    `INSERT INTO alarms
      (sensor_id, level, type, description, detected_value, allowed_range, status, started_at)
     VALUES (?, ?, ?, ?, ?, ?, 'abierta', NOW())`,
    [
      sensor.id,
      level,
      type,
      `${sensor.name} reporta valores ${level === 'critica' ? 'fuera del rango permitido' : 'cercanos al límite'}`,
      detectedValue,
      allowedRange
    ]
  );

  await queueAlarmNotifications(result.insertId, sensor.id, level);
  const newAlarm = { id: result.insertId, sensor_id: sensor.id, sensor_code: sensor.code, sensor_name: sensor.name, level, type, status: 'abierta' };
  try { const io = require('../app').get('io'); if (io) io.emit('new_alarm', newAlarm); } catch {}
  sendAlarmPush(newAlarm, sensor).catch(() => {});
  return newAlarm;
}

async function checkDisconnectedSensors() {
  const [rows] = await pool.query(
    `SELECT s.*, MAX(r.created_at) AS last_reading_at
     FROM sensors s
     LEFT JOIN readings r ON r.sensor_id = s.id
     WHERE s.status = 'activo'
     GROUP BY s.id`
  );

  for (const sensor of rows) {
    const last = sensor.last_reading_at ? new Date(sensor.last_reading_at).getTime() : 0;
    const limitMs = Number(sensor.reading_frequency || 5) * 2 * 60 * 1000;
    if (!last || Date.now() - last > limitMs) {
      const [open] = await pool.query(
        `SELECT id FROM alarms
         WHERE sensor_id = ? AND type = 'sensor_desconectado' AND status IN ('abierta', 'en_atencion') LIMIT 1`,
        [sensor.id]
      );
      if (!open.length) {
        const [result] = await pool.query(
          `INSERT INTO alarms
           (sensor_id, level, type, description, detected_value, allowed_range, status, started_at)
           VALUES (?, 'informativa', 'sensor_desconectado', ?, ?, ?, 'abierta', NOW())`,
          [sensor.id, `${sensor.name} no reporta lecturas en el tiempo esperado`, 'Sin lectura reciente', `Frecuencia ${sensor.reading_frequency} min`]
        );
        await queueAlarmNotifications(result.insertId, sensor.id, 'informativa');
        try {
          const io = require('../app').get('io');
          if (io) io.emit('new_alarm', { id: result.insertId, sensor_id: sensor.id, sensor_code: sensor.code, sensor_name: sensor.name, level: 'informativa', type: 'sensor_desconectado', status: 'abierta' });
        } catch {}
      }
    }
  }
}

module.exports = { classifyReading, createAlarmIfNeeded, checkDisconnectedSensors };
