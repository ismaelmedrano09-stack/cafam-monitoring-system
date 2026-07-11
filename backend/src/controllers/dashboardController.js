const pool = require('../config/db');
const { ok } = require('../utils/apiResponse');
const { checkDisconnectedSensors } = require('../services/alarmService');

async function summary(req, res) {
  await checkDisconnectedSensors();
  const [[sensorStats]] = await pool.query(`
    SELECT
      SUM(status = 'activo') AS active_sensors,
      SUM(status = 'desconectado') AS disconnected_sensors,
      COUNT(*) AS total_sensors
    FROM sensors
  `);
  const [[readingStats]] = await pool.query(`
    SELECT
      COUNT(*) AS today_readings,
      ROUND(AVG(temperature), 2) AS avg_temperature,
      ROUND(AVG(humidity), 2) AS avg_humidity
    FROM readings
    WHERE DATE(created_at) = CURDATE()
  `);
  const [[lastReading]] = await pool.query(`
    SELECT r.*, s.name AS sensor_name, s.area
    FROM readings r JOIN sensors s ON s.id = r.sensor_id
    ORDER BY r.created_at DESC LIMIT 1
  `);
  const [[alarmStats]] = await pool.query(`
    SELECT
      SUM(status IN ('abierta', 'en_atencion')) AS open_alarms,
      SUM(level = 'critica' AND status IN ('abierta', 'en_atencion')) AS critical_open,
      COUNT(DISTINCT CASE
        WHEN status IN ('abierta', 'en_atencion') THEN sensor_id
      END) AS alert_sensors
    FROM alarms
  `);

  const status = Number(alarmStats.critical_open || 0) > 0
    ? 'critico'
    : Number(alarmStats.open_alarms || 0) > 0
      ? 'advertencia'
      : 'normal';

  return ok(res, 'Resumen del panel principal', {
    ...sensorStats,
    ...readingStats,
    ...alarmStats,
    last_reading: lastReading || null,
    system_status: status
  });
}

async function charts(req, res) {
  const [temperature] = await pool.query(`
    SELECT r.id, s.code, s.name, r.temperature, r.humidity,
      r.calculated_status, r.created_at
    FROM readings r JOIN sensors s ON s.id = r.sensor_id
    ORDER BY r.created_at DESC LIMIT 120
  `);
  const [humidity] = await pool.query(`
    SELECT s.code, s.name, r.humidity, r.created_at
    FROM readings r JOIN sensors s ON s.id = r.sensor_id
    ORDER BY r.created_at DESC LIMIT 120
  `);
  const [alarmsByLevel] = await pool.query(`
    SELECT level, COUNT(*) AS total FROM alarms GROUP BY level
  `);
  const [complianceByArea] = await pool.query(`
    SELECT s.area,
      ROUND(SUM(r.calculated_status = 'normal') / COUNT(*) * 100, 2) AS compliance
    FROM readings r JOIN sensors s ON s.id = r.sensor_id
    GROUP BY s.area
  `);
  return ok(res, 'Datos de gráficas', { temperature, humidity, alarmsByLevel, complianceByArea });
}

async function operations(req, res) {
  const [alarmQueue] = await pool.query(`
    SELECT a.id, a.sensor_id, a.level, a.type, a.description, a.status,
      a.assigned_to, a.started_at, TIMESTAMPDIFF(MINUTE, a.started_at, NOW()) AS age_minutes,
      s.code AS sensor_code, s.name AS sensor_name, s.area,
      st.name AS site_name,
      CASE
        WHEN a.level = 'critica' AND TIMESTAMPDIFF(MINUTE, a.started_at, NOW()) > 15 THEN 'vencida'
        WHEN a.level = 'advertencia' AND TIMESTAMPDIFF(MINUTE, a.started_at, NOW()) > 60 THEN 'vencida'
        ELSE 'en_tiempo'
      END AS sla_status
    FROM alarms a
    JOIN sensors s ON s.id = a.sensor_id
    LEFT JOIN sites st ON st.id = s.site_id
    WHERE a.status IN ('abierta', 'en_atencion')
    ORDER BY
      FIELD(a.level, 'critica', 'advertencia', 'informativa'),
      FIELD(a.status, 'abierta', 'en_atencion'),
      a.started_at
    LIMIT 10
  `);

  const [deviceHealth] = await pool.query(`
    SELECT s.id, s.code, s.name, s.area, s.status, s.power_status,
      s.battery_level, s.last_seen_at, s.reading_frequency,
      st.name AS site_name,
      TIMESTAMPDIFF(MINUTE, COALESCE(s.last_seen_at, s.created_at), NOW()) AS silent_minutes,
      (SELECT COUNT(*) FROM alarms a
       WHERE a.sensor_id = s.id AND a.status IN ('abierta', 'en_atencion')) AS open_alarms
    FROM sensors s
    LEFT JOIN sites st ON st.id = s.site_id
    ORDER BY
      (s.status = 'desconectado') DESC,
      (s.power_status <> 'normal') DESC,
      (s.battery_level < 25) DESC,
      silent_minutes DESC
    LIMIT 10
  `);

  const [siteHealth] = await pool.query(`
    SELECT st.id, st.name, st.city,
      COUNT(DISTINCT s.id) AS total_sensors,
      COUNT(DISTINCT CASE WHEN s.status = 'activo' THEN s.id END) AS active_sensors,
      COUNT(DISTINCT CASE WHEN s.status = 'desconectado' THEN s.id END) AS disconnected_sensors,
      COUNT(DISTINCT CASE WHEN a.status IN ('abierta', 'en_atencion') THEN s.id END) AS alert_sensors,
      ROUND(
        COUNT(DISTINCT CASE WHEN s.status = 'activo' THEN s.id END) / NULLIF(COUNT(DISTINCT s.id), 0) * 100,
        0
      ) AS availability
    FROM sites st
    LEFT JOIN sensors s ON s.site_id = st.id
    LEFT JOIN alarms a ON a.sensor_id = s.id
    GROUP BY st.id
    ORDER BY alert_sensors DESC, disconnected_sensors DESC, st.name
  `);

  const [[indicators]] = await pool.query(`
    SELECT
      SUM(status IN ('abierta', 'en_atencion') AND
        ((level = 'critica' AND TIMESTAMPDIFF(MINUTE, started_at, NOW()) > 15) OR
         (level = 'advertencia' AND TIMESTAMPDIFF(MINUTE, started_at, NOW()) > 60))
      ) AS overdue_alarms,
      ROUND(AVG(CASE WHEN status = 'cerrada'
        THEN TIMESTAMPDIFF(MINUTE, started_at, closed_at) END), 0) AS avg_resolution_minutes,
      SUM(status = 'en_atencion') AS alarms_in_progress
    FROM alarms
  `);

  return ok(res, 'Prioridades operativas consultadas', {
    alarmQueue,
    deviceHealth,
    siteHealth,
    indicators
  });
}

module.exports = { summary, charts, operations };
