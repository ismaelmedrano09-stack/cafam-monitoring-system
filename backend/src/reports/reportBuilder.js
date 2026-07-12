const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const pool = require('../config/db');
const { analyzeSensor } = require('./reportAnalytics');

const REPORTS = {
  daily: { label: 'Reporte diario', file: 'diario', rangeSql: 'CURDATE()', rangeText: 'Desde hoy a las 00:00' },
  weekly: { label: 'Reporte semanal', file: 'semanal', rangeSql: 'DATE_SUB(NOW(), INTERVAL 7 DAY)', rangeText: 'Últimos 7 días' },
  monthly: { label: 'Reporte mensual', file: 'mensual', rangeSql: 'DATE_SUB(NOW(), INTERVAL 1 MONTH)', rangeText: 'Último mes' },
  alarms: { label: 'Reporte de alarmas', file: 'alarmas', rangeSql: 'DATE_SUB(NOW(), INTERVAL 30 DAY)', rangeText: 'Últimos 30 días' },
  'audit-dossier': { label: 'Expediente de auditoría', file: 'expediente-auditoria', rangeSql: 'DATE_SUB(NOW(), INTERVAL 1 MONTH)', rangeText: 'Último mes' }
};

const COLORS = {
  blue: '#0b4f8a',
  blue2: '#1268ad',
  green: '#168a55',
  yellow: '#b98105',
  red: '#be2e35',
  gray: '#647382',
  line: '#dce5ec',
  soft: '#f4f8fb',
  ink: '#1d2b36',
  teal: '#2a9d9d',
  tealSoft: '#d4ecec',
  orange: '#e8873a'
};

const XLSX_COLORS = {
  blue: 'FF0B4F8A',
  blue2: 'FF1268AD',
  green: 'FF168A55',
  greenSoft: 'FFDFF3E9',
  yellow: 'FFB98105',
  yellowSoft: 'FFFFF4D8',
  red: 'FFBE2E35',
  redSoft: 'FFFAE7E9',
  gray: 'FF647382',
  line: 'FFDCE5EC',
  soft: 'FFF4F8FB',
  white: 'FFFFFFFF',
  ink: 'FF1D2B36'
};

function getConfig(type) {
  return REPORTS[type] || REPORTS.daily;
}

function number(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Sin datos';
  return Number(value).toFixed(digits);
}

function percent(value) {
  return value === null || value === undefined ? 'Sin datos' : `${number(value, 1)} %`;
}

function dateTime(value) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function titleCase(value) {
  return String(value || 'Sin dato')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-CO', {
    timeZone: 'America/Bogota', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  });
}

function shortDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', month: 'short', day: '2-digit' });
}

function durationText(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h < 24) return rem ? `${h} h ${rem} min` : `${h} h`;
  const d = Math.floor(h / 24);
  const hr = h % 24;
  return hr ? `${d} d ${hr} h` : `${d} d`;
}

// Dibuja una gráfica de líneas de una variable en el tiempo, con la banda de rango
// permitido sombreada y el pico marcado. Inspirada y mejorada sobre el formato CENTEMP.
function drawTimeSeriesChart(doc, opts) {
  const { x, y, w, h, points, rangeMin, rangeMax, color, unit, title, peak } = opts;
  const padL = 34;
  const padR = 12;
  const padT = 20;
  const padB = 24;
  const plotX = x + padL;
  const plotY = y + padT;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  // Marco y título
  doc.roundedRect(x, y, w, h, 6).fillAndStroke('white', COLORS.line);
  doc.fillColor(COLORS.ink).fontSize(10).font('Helvetica-Bold').text(title, x + 12, y + 6);

  const vals = points.map((p) => p.v).filter((v) => Number.isFinite(v));
  if (!vals.length) {
    doc.fillColor(COLORS.gray).fontSize(9).font('Helvetica').text('Sin lecturas en el periodo.', plotX, plotY + plotH / 2 - 6);
    return;
  }

  // Escala Y: incluye el rango permitido y un margen
  let vMin = Math.min(...vals, rangeMin ?? Infinity);
  let vMax = Math.max(...vals, rangeMax ?? -Infinity);
  if (!Number.isFinite(vMin)) vMin = Math.min(...vals);
  if (!Number.isFinite(vMax)) vMax = Math.max(...vals);
  const pad = Math.max((vMax - vMin) * 0.12, 0.5);
  vMin -= pad;
  vMax += pad;
  const vSpan = vMax - vMin || 1;

  const times = points.map((p) => new Date(p.t).getTime());
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const tSpan = tMax - tMin || 1;

  const sx = (t) => plotX + ((new Date(t).getTime() - tMin) / tSpan) * plotW;
  const sy = (v) => plotY + plotH - ((v - vMin) / vSpan) * plotH;

  // Banda de rango permitido (verde translúcido)
  if (rangeMin !== null && rangeMax !== null && rangeMin !== undefined && rangeMax !== undefined) {
    const bandTop = sy(Math.min(rangeMax, vMax));
    const bandBottom = sy(Math.max(rangeMin, vMin));
    doc.save();
    doc.rect(plotX, bandTop, plotW, bandBottom - bandTop).fillColor('#e7f4ec').fillOpacity(0.7).fill();
    doc.restore();
    // Líneas límite
    [rangeMin, rangeMax].forEach((limit) => {
      const ly = sy(limit);
      doc.save().lineWidth(0.7).dash(3, { space: 2 }).strokeColor(COLORS.green)
        .moveTo(plotX, ly).lineTo(plotX + plotW, ly).stroke().undash().restore();
    });
  }

  // Cuadrícula + etiquetas Y (4 líneas)
  doc.fontSize(6.5).font('Helvetica').fillColor(COLORS.gray);
  for (let i = 0; i <= 4; i += 1) {
    const v = vMin + (vSpan * i) / 4;
    const gy = sy(v);
    doc.save().lineWidth(0.4).strokeColor(COLORS.line).moveTo(plotX, gy).lineTo(plotX + plotW, gy).stroke().restore();
    doc.fillColor(COLORS.gray).text(v.toFixed(1), x + 2, gy - 4, { width: padL - 6, align: 'right' });
  }

  // Etiquetas X (inicio, medio, fin)
  [0, 0.5, 1].forEach((frac) => {
    const t = tMin + tSpan * frac;
    const lx = plotX + plotW * frac;
    doc.fillColor(COLORS.gray).fontSize(6.5).text(shortDate(new Date(t)), lx - 18, plotY + plotH + 6, { width: 36, align: 'center' });
  });

  // Línea de datos
  doc.save().lineWidth(0.8).strokeColor(color);
  points.forEach((p, i) => {
    if (!Number.isFinite(p.v)) return;
    const px = sx(p.t);
    const py = sy(p.v);
    if (i === 0) doc.moveTo(px, py); else doc.lineTo(px, py);
  });
  doc.stroke().restore();

  // Marcador del pico
  if (peak && Number.isFinite(peak.value)) {
    const px = sx(peak.at);
    const py = sy(peak.value);
    doc.save().circle(px, py, 2.6).fillColor(COLORS.red).fill().restore();
    const labelX = Math.min(px + 4, plotX + plotW - 90);
    doc.fillColor(COLORS.red).fontSize(6.8).font('Helvetica-Bold')
      .text(`pico ${peak.value.toFixed(1)}${unit} · ${shortDateTime(peak.at)}`, labelX, Math.max(py - 12, plotY), { width: 110 });
  }
}

async function getReportData(type = 'daily') {
  const config = getConfig(type);
  const range = config.rangeSql;

  const [readings] = await pool.query(`
    SELECT r.*, s.code AS sensor_code, s.name AS sensor_name, s.area, s.type AS sensor_type,
      s.firmware_version, s.responsible, st.name AS site_name, st.address AS site_address
    FROM readings r
    JOIN sensors s ON s.id = r.sensor_id
    LEFT JOIN sites st ON st.id = s.site_id
    WHERE r.created_at >= ${range}
    ORDER BY r.created_at DESC
    LIMIT 1500
  `);

  const [alarms] = await pool.query(`
    SELECT a.*, s.code AS sensor_code, s.name AS sensor_name, s.area, st.name AS site_name,
      TIMESTAMPDIFF(MINUTE, a.started_at, COALESCE(a.closed_at, NOW())) AS age_minutes
    FROM alarms a
    JOIN sensors s ON s.id = a.sensor_id
    LEFT JOIN sites st ON st.id = s.site_id
    WHERE a.started_at >= ${range}
    ORDER BY a.started_at DESC
    LIMIT 1000
  `);

  const [actions] = await pool.query(`
    SELECT ca.*, s.code AS sensor_code, s.name AS sensor_name, u.name AS user_name
    FROM corrective_actions ca
    JOIN sensors s ON s.id = ca.sensor_id
    JOIN users u ON u.id = ca.user_id
    WHERE ca.created_at >= ${range}
    ORDER BY ca.created_at DESC
    LIMIT 1000
  `);

  const [[stats]] = await pool.query(`
    SELECT
      COUNT(*) AS total_readings,
      COUNT(DISTINCT sensor_id) AS sensors_with_readings,
      ROUND(MIN(temperature), 2) AS temp_min,
      ROUND(MAX(temperature), 2) AS temp_max,
      ROUND(AVG(temperature), 2) AS temp_avg,
      ROUND(MIN(humidity), 2) AS humidity_min,
      ROUND(MAX(humidity), 2) AS humidity_max,
      ROUND(AVG(humidity), 2) AS humidity_avg,
      ROUND(COALESCE(SUM(calculated_status = 'normal') / NULLIF(COUNT(*), 0) * 100, 0), 2) AS compliance,
      SUM(calculated_status = 'critico') AS critical_events,
      SUM(calculated_status = 'advertencia') AS warning_events
    FROM readings
    WHERE created_at >= ${range}
  `);

  const [[alarmStats]] = await pool.query(`
    SELECT
      COUNT(*) AS total_alarms,
      SUM(level = 'critica') AS critical_alarms,
      SUM(level = 'advertencia') AS warning_alarms,
      SUM(level = 'informativa') AS info_alarms,
      SUM(status IN ('abierta', 'en_atencion')) AS open_alarms,
      ROUND(AVG(TIMESTAMPDIFF(MINUTE, started_at, COALESCE(closed_at, NOW()))), 1) AS avg_age_minutes
    FROM alarms
    WHERE started_at >= ${range}
  `);

  const [byArea] = await pool.query(`
    SELECT s.area,
      COUNT(r.id) AS total_readings,
      ROUND(COALESCE(SUM(r.calculated_status = 'normal') / NULLIF(COUNT(r.id), 0) * 100, 0), 2) AS compliance,
      SUM(r.calculated_status = 'critico') AS critical_events,
      SUM(r.calculated_status = 'advertencia') AS warning_events
    FROM sensors s
    LEFT JOIN readings r ON r.sensor_id = s.id AND r.created_at >= ${range}
    GROUP BY s.area
    ORDER BY compliance ASC, critical_events DESC, s.area
  `);

  const [bySensor] = await pool.query(`
    SELECT s.id, s.code, s.name, s.area, s.type, s.firmware_version, s.responsible,
      st.name AS site_name, st.address AS site_address,
      COUNT(r.id) AS total_readings,
      ROUND(MIN(r.temperature), 2) AS temp_min,
      ROUND(MAX(r.temperature), 2) AS temp_max,
      ROUND(MIN(r.humidity), 2) AS humidity_min,
      ROUND(MAX(r.humidity), 2) AS humidity_max,
      ROUND(COALESCE(SUM(r.calculated_status = 'normal') / NULLIF(COUNT(r.id), 0) * 100, 0), 2) AS compliance,
      SUM(r.calculated_status = 'critico') AS critical_events,
      SUM(r.calculated_status = 'advertencia') AS warning_events
    FROM sensors s
    LEFT JOIN sites st ON st.id = s.site_id
    LEFT JOIN readings r ON r.sensor_id = s.id AND r.created_at >= ${range}
    GROUP BY s.id
    ORDER BY critical_events DESC, warning_events DESC, compliance ASC, s.code
  `);

  const primarySensor = bySensor.find((sensor) => Number(sensor.total_readings) > 0) || bySensor[0] || null;

  // Series cronológicas ascendentes por sensor para las gráficas y el análisis de excursiones.
  const [seriesRows] = await pool.query(`
    SELECT r.sensor_id, r.temperature, r.humidity, r.calculated_status, r.created_at
    FROM readings r
    WHERE r.created_at >= ${range}
    ORDER BY r.created_at ASC
    LIMIT 8000
  `);

  const seriesBySensor = new Map();
  for (const row of seriesRows) {
    if (!seriesBySensor.has(row.sensor_id)) seriesBySensor.set(row.sensor_id, []);
    seriesBySensor.get(row.sensor_id).push(row);
  }

  // Umbrales reales del sensor (la consulta bySensor sobrescribe temp_min/max con extremos de lecturas).
  const [thresholds] = await pool.query('SELECT id, temp_min, temp_max, humidity_min, humidity_max FROM sensors');
  const thresholdMap = new Map(thresholds.map((row) => [row.id, row]));

  // Análisis por equipo (temperatura, humedad, picos, MKT, excursiones) para los que tienen datos.
  const analyses = bySensor
    .filter((sensor) => seriesBySensor.has(sensor.id))
    .map((sensor) => {
      const th = thresholdMap.get(sensor.id) || {};
      const withThresholds = {
        ...sensor,
        temp_min: th.temp_min,
        temp_max: th.temp_max,
        humidity_min: th.humidity_min,
        humidity_max: th.humidity_max
      };
      return analyzeSensor(withThresholds, seriesBySensor.get(sensor.id));
    });

  return {
    type,
    config,
    readings,
    alarms,
    actions,
    byArea,
    bySensor,
    primarySensor,
    analyses,
    stats: stats || {},
    alarmStats: alarmStats || {}
  };
}

function drawHeader(doc, data, user) {
  doc.rect(0, 0, doc.page.width, 92).fill(COLORS.blue);
  doc.fillColor('white').fontSize(20).font('Helvetica-Bold').text('Cafam Monitoring', 40, 28);
  doc.fontSize(11).font('Helvetica').text('Sistema de telemetría clínica y cadena de frío', 40, 55);
  doc.fontSize(10).text(data.config.label, 390, 30, { width: 160, align: 'right' });
  doc.text(data.config.rangeText, 390, 50, { width: 160, align: 'right' });
  doc.fillColor(COLORS.ink).fontSize(9).text(`Generado: ${dateTime(new Date())}`, 40, 110);
  doc.text(`Usuario: ${user.name} (${user.role})`, 40, 124);
}

function card(doc, x, y, w, title, value, subtitle, color = COLORS.blue) {
  doc.roundedRect(x, y, w, 72, 6).fillAndStroke('white', COLORS.line);
  doc.rect(x, y, 5, 72).fill(color);
  doc.fillColor(COLORS.gray).fontSize(8).font('Helvetica-Bold').text(title.toUpperCase(), x + 14, y + 12, { width: w - 22 });
  doc.fillColor(COLORS.ink).fontSize(18).font('Helvetica-Bold').text(String(value), x + 14, y + 29, { width: w - 22 });
  doc.fillColor(COLORS.gray).fontSize(8).font('Helvetica').text(subtitle, x + 14, y + 53, { width: w - 22 });
}

function drawComplianceBar(doc, x, y, w, value) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  const color = safeValue >= 90 ? COLORS.green : safeValue >= 75 ? COLORS.yellow : COLORS.red;
  doc.fillColor(COLORS.gray).fontSize(9).font('Helvetica-Bold').text('Cumplimiento general', x, y);
  doc.roundedRect(x, y + 17, w, 14, 7).fill('#e8eef3');
  doc.roundedRect(x, y + 17, (w * safeValue) / 100, 14, 7).fill(color);
  doc.fillColor(COLORS.ink).fontSize(9).text(`${number(safeValue, 1)} %`, x + w + 8, y + 18);
}

function drawAlarmChart(doc, x, y, stats) {
  const values = [
    { label: 'Críticas', value: Number(stats.critical_alarms || 0), color: COLORS.red },
    { label: 'Advertencias', value: Number(stats.warning_alarms || 0), color: COLORS.yellow },
    { label: 'Informativas', value: Number(stats.info_alarms || 0), color: COLORS.blue2 }
  ];
  const max = Math.max(1, ...values.map((item) => item.value));
  doc.fillColor(COLORS.gray).fontSize(9).font('Helvetica-Bold').text('Alarmas por nivel', x, y);
  values.forEach((item, index) => {
    const top = y + 22 + index * 24;
    doc.fillColor(COLORS.ink).fontSize(8).font('Helvetica').text(item.label, x, top, { width: 85 });
    doc.roundedRect(x + 92, top, 150, 9, 4).fill('#e8eef3');
    doc.roundedRect(x + 92, top, (150 * item.value) / max, 9, 4).fill(item.color);
    doc.fillColor(COLORS.ink).text(String(item.value), x + 250, top - 1);
  });
}

function drawUnitDataSummary(doc, data, y) {
  const sensor = data.primarySensor;
  if (!sensor) return y;
  const sensorReadings = data.readings.filter((reading) => reading.sensor_id === sensor.id);
  const first = sensorReadings[sensorReadings.length - 1];
  const last = sensorReadings[0];

  doc.roundedRect(40, y, 515, 138, 6).fillAndStroke('white', COLORS.line);
  doc.fillColor(COLORS.blue).fontSize(18).font('Helvetica-Bold').text('Informe de datos por equipo', 60, y + 18);
  doc.fillColor(COLORS.gray).fontSize(9).font('Helvetica').text('Resumen inspirado en el formato histórico de unidad.', 60, y + 42);

  doc.fillColor(COLORS.ink).fontSize(9).font('Helvetica-Bold').text('Institución', 60, y + 70);
  doc.font('Helvetica').text(sensor.site_name || 'Cafam', 130, y + 70, { width: 150 });
  doc.font('Helvetica-Bold').text('Equipo', 315, y + 70);
  doc.font('Helvetica').text(sensor.name || sensor.code, 370, y + 70, { width: 150 });

  doc.font('Helvetica-Bold').text('Dirección', 60, y + 88);
  doc.font('Helvetica').text(sensor.site_address || 'No registrada', 130, y + 88, { width: 150 });
  doc.font('Helvetica-Bold').text('Código', 315, y + 88);
  doc.font('Helvetica').text(sensor.code, 370, y + 88);

  doc.font('Helvetica-Bold').text('Fecha inicial', 60, y + 106);
  doc.font('Helvetica').text(first ? dateTime(first.created_at) : 'Sin datos', 130, y + 106, { width: 150 });
  doc.font('Helvetica-Bold').text('Fecha final', 315, y + 106);
  doc.font('Helvetica').text(last ? dateTime(last.created_at) : 'Sin datos', 370, y + 106, { width: 150 });

  doc.fillColor(COLORS.soft).roundedRect(60, y + 154, 475, 52, 6).fill();
  const boxW = 118;
  [
    ['Promedio', `${number(sensor.temp_min === null && sensor.temp_max === null ? null : data.stats.temp_avg)} °C`],
    ['Valor máximo', `${number(sensor.temp_max)} °C`],
    ['Valor mínimo', `${number(sensor.temp_min)} °C`],
    ['Cumplimiento', percent(sensor.compliance)]
  ].forEach(([label, value], index) => {
    const x = 68 + index * boxW;
    doc.fillColor(COLORS.gray).fontSize(8).font('Helvetica-Bold').text(label.toUpperCase(), x, y + 164, { width: boxW - 8, align: 'center' });
    doc.fillColor(COLORS.ink).fontSize(15).font('Helvetica-Bold').text(value, x, y + 181, { width: boxW - 8, align: 'center' });
  });

  return y + 228;
}

function miniCard(doc, x, y, w, label, value, sub, color = COLORS.blue) {
  doc.roundedRect(x, y, w, 58, 5).fillAndStroke('white', COLORS.line);
  doc.rect(x, y, w, 3).fill(color);
  doc.fillColor(COLORS.gray).fontSize(7).font('Helvetica-Bold').text(label.toUpperCase(), x + 8, y + 9, { width: w - 14 });
  doc.fillColor(COLORS.ink).fontSize(13).font('Helvetica-Bold').text(String(value), x + 8, y + 22, { width: w - 14 });
  if (sub) doc.fillColor(COLORS.gray).fontSize(6.5).font('Helvetica').text(sub, x + 8, y + 42, { width: w - 14 });
}

// Encabezado de sección estilo INVIMA (título con subrayado naranja).
function sectionHeader(doc, y, text) {
  doc.fillColor(COLORS.ink).fontSize(11).font('Helvetica-Bold').text(text.toUpperCase(), 40, y);
  doc.rect(40, y + 15, 515, 1.5).fill(COLORS.orange);
  return y + 24;
}

// Tabla compacta estilo normativa (encabezado teal), usada dentro de la página de equipo.
function invimaTable(doc, y, columns, rows, emptyText) {
  const x = 40;
  const width = 515;
  doc.rect(x, y, width, 20).fill(COLORS.teal);
  let cursor = x;
  columns.forEach((col) => {
    doc.fillColor('white').fontSize(7.5).font('Helvetica-Bold').text(col.label.toUpperCase(), cursor + 5, y + 6, { width: col.width - 8 });
    cursor += col.width;
  });
  y += 20;
  const list = rows.length ? rows : [null];
  list.forEach((row, index) => {
    if (y > 770) { doc.addPage(); y = 40; }
    const rowH = 20;
    if (index % 2 === 1) doc.rect(x, y, width, rowH).fill('#f5fafa');
    doc.rect(x, y, width, rowH).stroke(COLORS.line);
    cursor = x;
    columns.forEach((col) => {
      const raw = row ? (typeof col.value === 'function' ? col.value(row) : row[col.key]) : (col === columns[0] ? (emptyText || 'Sin registros') : '');
      doc.fillColor(COLORS.ink).fontSize(7.5).font('Helvetica').text(String(raw ?? '—'), cursor + 5, y + 6, { width: col.width - 8, ellipsis: true });
      cursor += col.width;
    });
    y += rowH;
  });
  return y + 14;
}

// Página de informe por nevera siguiendo la estructura normativa INVIMA/Cafam,
// con diseño mejorado, gráficas de temperatura y humedad y análisis de excursiones.
function drawEquipmentDetail(doc, analysis, data, user) {
  const s = analysis.sensor;
  const t = analysis.temperature;
  const hum = analysis.humidity;
  const critical = (t?.excursions.length || 0) > 0;
  const periodMin = analysis.first && analysis.last
    ? Math.max(1, (new Date(analysis.last.created_at) - new Date(analysis.first.created_at)) / 60000) : 1;
  doc.addPage();

  // Encabezado institucional (INVIMA — Cafam)
  doc.rect(0, 0, doc.page.width, 70).fill(COLORS.blue);
  doc.roundedRect(40, 18, 74, 34, 4).fill('white');
  doc.fillColor(COLORS.blue).fontSize(13).font('Helvetica-Bold').text('INVIMA', 48, 30);
  doc.roundedRect(481, 18, 74, 34, 4).fill('white');
  doc.fillColor(COLORS.blue).fontSize(13).font('Helvetica-Bold').text('CAFAM', 490, 30);
  doc.fillColor('white').fontSize(13).font('Helvetica-Bold').text('CONTROL DE TEMPERATURA Y HUMEDAD', 0, 24, { width: doc.page.width, align: 'center' });
  doc.fontSize(8).font('Helvetica').text('Cadena de frío · Refrigeración de medicamentos y biológicos', 0, 44, { width: doc.page.width, align: 'center' });

  // ESTADO DE LA NEVERA
  let y = sectionHeader(doc, 86, 'Estado de la nevera');
  y = invimaTable(doc, y, [
    { label: 'Fecha del reporte', value: () => shortDateTime(new Date()), width: 130 },
    { label: 'Nombre de la clínica', value: () => s.site_name || 'Cafam', width: 200 },
    { label: 'Responsable', value: () => s.responsible || user.name, width: 185 }
  ], [s], null);

  // RESUMEN DEL ESTADO
  y = sectionHeader(doc, y, 'Resumen del estado');
  const estadoTexto = critical
    ? `La nevera ${s.code} presentó ${t.excursions.length} desviación(es) de temperatura fuera del rango permitido (${number(s.temp_min)}–${number(s.temp_max)} °C). Tiempo total fuera de rango: ${durationText(t.time.outMinutes)}. Requiere revisión y acción correctiva.`
    : `La nevera ${s.code} se mantuvo dentro del rango permitido (${number(s.temp_min)}–${number(s.temp_max)} °C) durante el periodo evaluado, con ${percent(t?.time.inPercent)} del tiempo en cumplimiento. Estado conforme.`;
  doc.fillColor(critical ? COLORS.red : COLORS.green).fontSize(9).font('Helvetica-Bold')
    .text(critical ? 'ESTADO: CRÍTICO' : 'ESTADO: CONFORME', 40, y);
  doc.fillColor(COLORS.ink).fontSize(8.5).font('Helvetica').text(estadoTexto, 40, y + 14, { width: 515 });
  y += 48;

  // INFORMACIÓN GENERAL
  y = sectionHeader(doc, y, 'Información general');
  y = invimaTable(doc, y, [
    { label: 'Nevera código', value: () => s.code, width: 90 },
    { label: '% Humedad', value: () => `${number(hum?.avg)} % (${number(hum?.min?.value)}–${number(hum?.max?.value)})`, width: 130 },
    { label: 'Temperatura', value: () => `${number(t?.avg)} °C (${number(t?.min?.value)}–${number(t?.max?.value)})`, width: 130 },
    { label: 'Estado crítico', value: () => critical ? 'SÍ' : 'NO', width: 70 },
    { label: 'Indicaciones', value: () => critical ? 'Verificar y corregir' : 'Sin novedad', width: 95 }
  ], [s], null);

  // Gráficas
  drawTimeSeriesChart(doc, {
    x: 40, y, w: 515, h: 138,
    points: analysis.readings.map((r) => ({ t: r.created_at, v: Number(r.temperature) })),
    rangeMin: t?.range.min ?? null, rangeMax: t?.range.max ?? null,
    color: COLORS.red, unit: '°C', title: 'Temperatura (°C) en el tiempo', peak: t?.max || null
  });
  y += 148;
  drawTimeSeriesChart(doc, {
    x: 40, y, w: 515, h: 138,
    points: analysis.readings.map((r) => ({ t: r.created_at, v: Number(r.humidity) })),
    rangeMin: hum?.range.min ?? null, rangeMax: hum?.range.max ?? null,
    color: COLORS.blue2, unit: '%', title: 'Humedad relativa (%) en el tiempo', peak: hum?.max || null
  });
  y += 148;

  // Tarjetas de métricas
  const cardW = (515 - 5 * 8) / 6;
  [
    ['Promedio', `${number(t?.avg)} °C`, `Desv. ${number(t?.stdDev)}`, COLORS.blue],
    ['Máximo', `${number(t?.max?.value)} °C`, t?.max ? shortDateTime(t.max.at) : '—', COLORS.red],
    ['Mínimo', `${number(t?.min?.value)} °C`, t?.min ? shortDateTime(t.min.at) : '—', COLORS.blue2],
    ['MKT', `${number(analysis.mkt)} °C`, 'Temp. cinetica media', COLORS.green],
    ['Tiempo en rango', percent(t?.time.inPercent), durationText(t?.time.inMinutes), Number(t?.time.inPercent || 0) >= 90 ? COLORS.green : COLORS.yellow],
    ['Fuera de rango', durationText(t?.time.outMinutes), `${t?.excursions.length || 0} excursiones`, (t?.excursions.length || 0) ? COLORS.red : COLORS.green]
  ].forEach(([label, value, sub, color], i) => miniCard(doc, 40 + i * (cardW + 8), y, cardW, label, value, sub, color));
  y += 70;

  // INDICACIONES PARA SEGUIR (desviaciones / excursiones)
  const excursions = [
    ...(t?.excursions || []).map((e) => ({ ...e, variable: 'Temperatura' })),
    ...(hum?.excursions || []).map((e) => ({ ...e, variable: 'Humedad' }))
  ].sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  if (y > 640) { doc.addPage(); y = 40; }
  y = sectionHeader(doc, y, 'Indicaciones para seguir');
  y = invimaTable(doc, y, [
    { label: 'Tipo de desviación', value: (e) => `${e.variable} ${e.type === 'alta' ? 'sobre rango' : 'bajo rango'}`, width: 130 },
    { label: 'Tipo de reporte', value: (e) => e.type === 'alta' ? 'Crítico' : 'Advertencia', width: 90 },
    { label: '% del periodo', value: (e) => `${number((e.durationMin / periodMin) * 100)} %`, width: 85 },
    { label: 'Duración', value: (e) => durationText(e.durationMin), width: 90 },
    { label: 'Pico', value: (e) => `${number(e.peak)} ${e.variable === 'Temperatura' ? '°C' : '%'}`, width: 120 }
  ], excursions.slice(0, 12), 'Sin desviaciones en el periodo');

  // RIESGO E HISTORIAL DE PROBLEMAS (alarmas del equipo)
  const sensorAlarms = (data.alarms || []).filter((a) => a.sensor_code === s.code || a.sensor_id === s.id);
  if (y > 680) { doc.addPage(); y = 40; }
  y = sectionHeader(doc, y, 'Riesgo e historial de problemas');
  invimaTable(doc, y, [
    { label: 'Problema', value: (a) => a.description || titleCase(a.level), width: 260 },
    { label: 'Asignado a', value: (a) => a.assigned_to || s.responsible || 'Sin asignar', width: 130 },
    { label: 'Fecha', value: (a) => shortDateTime(a.started_at), width: 125 }
  ], sensorAlarms.slice(0, 10), 'Sin problemas registrados');

  // Pie institucional
  doc.fillColor(COLORS.gray).fontSize(7).font('Helvetica')
    .text('Avenida Carrera 68 90 88, Barrio Floresta, Bogotá D.C., Colombia · NIT: 860013570', 40, 812, { width: 515, align: 'center', lineBreak: false });
}

function table(doc, title, columns, rows, startY, options = {}) {
  let y = startY;
  const x = 40;
  const width = 515;
  doc.fillColor(COLORS.ink).fontSize(12).font('Helvetica-Bold').text(title, x, y);
  y += 22;
  doc.rect(x, y, width, 22).fill(COLORS.soft);
  let cursor = x;
  columns.forEach((col) => {
    doc.fillColor(COLORS.blue).fontSize(8).font('Helvetica-Bold').text(col.label, cursor + 5, y + 7, { width: col.width - 8 });
    cursor += col.width;
  });
  y += 22;

  const limit = options.limit || 12;
  rows.slice(0, limit).forEach((row, index) => {
    if (y > 750) {
      doc.addPage();
      y = 40;
    }
    if (index % 2 === 0) doc.rect(x, y, width, 24).fill('#fbfdfe');
    cursor = x;
    columns.forEach((col) => {
      const raw = typeof col.value === 'function' ? col.value(row) : row[col.key];
      doc.fillColor(COLORS.ink).fontSize(7.5).font('Helvetica').text(String(raw ?? 'Sin datos'), cursor + 5, y + 7, { width: col.width - 8, ellipsis: true });
      cursor += col.width;
    });
    y += 24;
  });

  if (!rows.length) {
    doc.fillColor(COLORS.gray).fontSize(9).text('Sin registros para este periodo.', x, y + 8);
    y += 28;
  }
  return y + 16;
}

async function buildPdf({ type, user }) {
  const data = await getReportData(type);
  const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  drawHeader(doc, data, user);
  card(doc, 40, 156, 120, 'Lecturas', data.stats.total_readings || 0, 'Registros del periodo', COLORS.blue);
  card(doc, 172, 156, 120, 'Cumplimiento', percent(data.stats.compliance), 'Lecturas dentro de rango', Number(data.stats.compliance || 0) >= 90 ? COLORS.green : COLORS.yellow);
  card(doc, 304, 156, 120, 'Alarmas', data.alarmStats.total_alarms || 0, 'Eventos generados', COLORS.red);
  card(doc, 436, 156, 120, 'Acciones', data.actions.length, 'Correctivas registradas', COLORS.green);

  drawComplianceBar(doc, 40, 260, 300, data.stats.compliance);
  drawAlarmChart(doc, 40, 310, data.alarmStats);

  doc.fillColor(COLORS.ink).fontSize(12).font('Helvetica-Bold').text('Resumen operativo', 330, 260);
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.gray)
    .text(`Temperatura mínima: ${number(data.stats.temp_min)} °C`, 330, 286)
    .text(`Temperatura máxima: ${number(data.stats.temp_max)} °C`, 330, 304)
    .text(`Humedad mínima: ${number(data.stats.humidity_min)} % HR`, 330, 322)
    .text(`Humedad máxima: ${number(data.stats.humidity_max)} % HR`, 330, 340)
    .text(`Alarmas abiertas/en atención: ${data.alarmStats.open_alarms || 0}`, 330, 358)
    .text(`Tiempo promedio de alarma: ${number(data.alarmStats.avg_age_minutes, 1)} min`, 330, 376);

  let y = drawUnitDataSummary(doc, data, 420);
  y = table(doc, 'Áreas con mayor riesgo', [
    { label: 'Área', key: 'area', width: 170 },
    { label: 'Cumplimiento', value: (row) => percent(row.compliance), width: 90 },
    { label: 'Críticas', key: 'critical_events', width: 75 },
    { label: 'Advertencias', key: 'warning_events', width: 90 },
    { label: 'Lecturas', key: 'total_readings', width: 90 }
  ], data.byArea, y, { limit: 8 });

  y = table(doc, 'Dispositivos prioritarios', [
    { label: 'Sensor', value: (row) => `${row.code} - ${row.name}`, width: 145 },
    { label: 'Sede', key: 'site_name', width: 110 },
    { label: 'Área', key: 'area', width: 105 },
    { label: 'Cumplimiento', value: (row) => percent(row.compliance), width: 85 },
    { label: 'Críticas', key: 'critical_events', width: 70 }
  ], data.bySensor, y, { limit: 10 });

  doc.addPage();
  table(doc, 'Alarmas del periodo', [
    { label: 'Inicio', value: (row) => dateTime(row.started_at), width: 95 },
    { label: 'Sensor', key: 'sensor_code', width: 70 },
    { label: 'Nivel', value: (row) => titleCase(row.level), width: 75 },
    { label: 'Estado', value: (row) => titleCase(row.status), width: 80 },
    { label: 'Descripción', key: 'description', width: 195 }
  ], data.alarms, 40, { limit: 24 });

  doc.addPage();
  table(doc, 'Últimas lecturas registradas', [
    { label: 'Fecha', value: (row) => dateTime(row.created_at), width: 100 },
    { label: 'Sensor', key: 'sensor_code', width: 70 },
    { label: 'Área', key: 'area', width: 120 },
    { label: 'Temp.', value: (row) => `${number(row.temperature)} °C`, width: 65 },
    { label: 'Humedad', value: (row) => `${number(row.humidity)} %`, width: 70 },
    { label: 'Estado', value: (row) => titleCase(row.calculated_status), width: 90 }
  ], data.readings, 40, { limit: 28 });

  // Páginas de análisis detallado por equipo (gráficas + excursiones).
  (data.analyses || []).slice(0, 6).forEach((analysis) => drawEquipmentDetail(doc, analysis, data, user));

  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i += 1) {
    doc.switchToPage(i);
    doc.fillColor(COLORS.gray).fontSize(8).text(`Página ${i + 1} de ${pages.count}`, 480, 812, { lineBreak: false });
    doc.text('Documento generado automáticamente por Cafam Monitoring', 40, 812, { lineBreak: false });
  }

  doc.end();
  await new Promise((resolve) => doc.on('end', resolve));
  return Buffer.concat(chunks);
}

function columnLetter(index) {
  let letter = '';
  let value = index;
  while (value > 0) {
    const mod = (value - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    value = Math.floor((value - mod) / 26);
  }
  return letter;
}

function thinBorder(color = XLSX_COLORS.line) {
  return {
    top: { style: 'thin', color: { argb: color } },
    left: { style: 'thin', color: { argb: color } },
    bottom: { style: 'thin', color: { argb: color } },
    right: { style: 'thin', color: { argb: color } }
  };
}

function fill(color) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
}

function styleStatusCell(cell, value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('critic') || text.includes('vencida') || text.includes('abierta')) {
    cell.fill = fill(XLSX_COLORS.redSoft);
    cell.font = { bold: true, color: { argb: XLSX_COLORS.red } };
  } else if (text.includes('advertencia') || text.includes('atencion') || text.includes('atención')) {
    cell.fill = fill(XLSX_COLORS.yellowSoft);
    cell.font = { bold: true, color: { argb: XLSX_COLORS.yellow } };
  } else if (text.includes('normal') || text.includes('cerrada') || text.includes('adecuado')) {
    cell.fill = fill(XLSX_COLORS.greenSoft);
    cell.font = { bold: true, color: { argb: XLSX_COLORS.green } };
  }
}

function styleSheet(sheet, options = {}) {
  const headerRow = options.headerRow || 1;
  const lastColumn = columnLetter(sheet.columnCount || 1);
  sheet.views = [{ state: 'frozen', ySplit: headerRow }];
  sheet.autoFilter = `${options.autoFilterFrom || `A${headerRow}`}:${lastColumn}${headerRow}`;
  sheet.properties.defaultRowHeight = 22;
  sheet.getRow(headerRow).height = 26;
  sheet.getRow(headerRow).font = { bold: true, color: { argb: XLSX_COLORS.white } };
  sheet.getRow(headerRow).fill = fill(options.headerColor || XLSX_COLORS.blue);
  sheet.getRow(headerRow).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  sheet.columns.forEach((column) => {
    column.alignment = { vertical: 'middle', wrapText: true };
  });
  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      cell.border = thinBorder();
      if (rowNumber > headerRow && rowNumber % 2 === 0) {
        cell.fill = fill('FFFBFDFE');
      }
      const header = String(sheet.getRow(headerRow).getCell(colNumber).value || '').toLowerCase();
      if (header.includes('cumplimiento')) {
        cell.numFmt = '0.0';
        const value = Number(cell.value || 0);
        if (rowNumber > headerRow) {
          cell.fill = fill(value >= 90 ? XLSX_COLORS.greenSoft : value >= 75 ? XLSX_COLORS.yellowSoft : XLSX_COLORS.redSoft);
          cell.font = { bold: true, color: { argb: value >= 90 ? XLSX_COLORS.green : value >= 75 ? XLSX_COLORS.yellow : XLSX_COLORS.red } };
        }
      }
      if (header.includes('temp') || header.includes('humedad')) cell.numFmt = '0.0';
      if (header.includes('estado') || header.includes('nivel')) styleStatusCell(cell, cell.value);
    });
  });
  if (options.tabColor) sheet.properties.tabColor = { argb: options.tabColor };
}

function safeSheetName(value, fallback) {
  return String(value || fallback).replace(/[\\/*?:[\]]/g, '-').slice(0, 31);
}

function addUnitHistorySheet(workbook, sensor, readings, data) {
  const sheet = workbook.addWorksheet(safeSheetName(sensor.code, 'Unidad'));
  sheet.properties.tabColor = { argb: XLSX_COLORS.blue2 };
  sheet.columns = [{ width: 34 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 4 }, { width: 18 }, { width: 30 }, { width: 18 }];
  const ordered = readings
    .filter((reading) => reading.sensor_id === sensor.id)
    .slice()
    .reverse();
  const first = ordered[0];
  const last = ordered[ordered.length - 1];

  sheet.addRows([
    ['', '', '', '', 'Fecha inicial', first ? dateTime(first.created_at) : 'Sin datos'],
    ['', '', '', '', 'Fecha final', last ? dateTime(last.created_at) : 'Sin datos'],
    ['', '', '', '', 'Equipo', sensor.name],
    ['REPORTE HISTÓRICO DE DATOS', '', '', '', 'Tipo', sensor.type || 'N/R'],
    [sensor.site_name || 'Cafam', '', '', '', 'Modelo', sensor.firmware_version || 'N/R'],
    ['Dirección', sensor.site_address || 'No registrada', '', '', 'Serie', sensor.code],
    ['Responsable', sensor.responsible || 'No registrado', '', '', 'Inventario', `ID ${sensor.id}`],
    [],
    ['Fecha y hora', 'Temperatura', 'Humedad', 'Estado']
  ]);

  sheet.mergeCells('A4:C4');
  sheet.getCell('A4').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A4').fill = fill(XLSX_COLORS.blue);
  sheet.getCell('A5').font = { bold: true };
  sheet.getRow(9).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(9).fill = fill(XLSX_COLORS.blue2);

  ordered.forEach((reading) => {
    sheet.addRow([
      dateTime(reading.created_at),
      Number(reading.temperature),
      Number(reading.humidity),
      titleCase(reading.calculated_status)
    ]);
  });

  const summaryStart = 2;
  sheet.getCell(`H${summaryStart}`).value = 'Resumen';
  sheet.getCell(`H${summaryStart}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell(`H${summaryStart}`).fill = fill(XLSX_COLORS.green);
  sheet.getCell(`G${summaryStart + 1}`).value = 'Promedio';
  sheet.getCell(`H${summaryStart + 1}`).value = Number(data.stats.temp_avg || 0);
  sheet.getCell(`G${summaryStart + 2}`).value = 'Valor máximo';
  sheet.getCell(`H${summaryStart + 2}`).value = Number(sensor.temp_max || 0);
  sheet.getCell(`G${summaryStart + 3}`).value = 'Valor mínimo';
  sheet.getCell(`H${summaryStart + 3}`).value = Number(sensor.temp_min || 0);
  sheet.getCell(`G${summaryStart + 4}`).value = 'Cumplimiento';
  sheet.getCell(`H${summaryStart + 4}`).value = Number(sensor.compliance || 0);
  sheet.getCell(`H${summaryStart + 4}`).numFmt = '0.0" %"';

  sheet.views = [{ state: 'frozen', ySplit: 9 }];
  sheet.autoFilter = 'A9:D9';
  sheet.eachRow((row, rowNumber) => {
    row.alignment = { vertical: 'middle', wrapText: true };
    row.eachCell((cell, colNumber) => {
      cell.border = thinBorder();
      if (rowNumber > 9 && rowNumber % 2 === 0 && colNumber <= 4) cell.fill = fill('FFFBFDFE');
      if (rowNumber > 9 && colNumber === 4) styleStatusCell(cell, cell.value);
      if (rowNumber > 9 && (colNumber === 2 || colNumber === 3)) cell.numFmt = '0.0';
    });
  });
  ['G3', 'G4', 'G5', 'G6'].forEach((cellRef) => {
    sheet.getCell(cellRef).font = { bold: true, color: { argb: XLSX_COLORS.gray } };
    sheet.getCell(cellRef).border = thinBorder();
  });
  ['H3', 'H4', 'H5', 'H6'].forEach((cellRef) => {
    sheet.getCell(cellRef).border = thinBorder();
    sheet.getCell(cellRef).fill = fill(XLSX_COLORS.soft);
  });
  styleStatusCell(sheet.getCell('H6'), Number(sensor.compliance || 0) >= 90 ? 'normal' : Number(sensor.compliance || 0) >= 75 ? 'advertencia' : 'critico');
}

async function buildExcel({ type, user }) {
  const data = await getReportData(type);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = user.name;
  workbook.created = new Date();
  workbook.subject = data.config.label;
  workbook.title = `Cafam Monitoring - ${data.config.label}`;
  workbook.company = 'Cafam Monitoring';

  const summary = workbook.addWorksheet('Resumen ejecutivo');
  summary.columns = [{ width: 32 }, { width: 28 }, { width: 22 }, { width: 22 }];
  summary.addRows([
    ['Cafam Monitoring', data.config.label, '', ''],
    ['Periodo', data.config.rangeText, 'Generado', dateTime(new Date())],
    ['Usuario', user.name, 'Rol', user.role],
    [],
    ['Indicador', 'Valor', 'Detalle', 'Estado'],
    ['Lecturas', data.stats.total_readings || 0, 'Registros del periodo', ''],
    ['Cumplimiento', percent(data.stats.compliance), 'Lecturas dentro de rango', Number(data.stats.compliance || 0) >= 90 ? 'Adecuado' : 'Revisar'],
    ['Alarmas', data.alarmStats.total_alarms || 0, 'Total de eventos', ''],
    ['Críticas', data.alarmStats.critical_alarms || 0, 'Nivel crítico', ''],
    ['Acciones correctivas', data.actions.length, 'Registros asociados', '']
  ]);
  summary.mergeCells('A1:D1');
  summary.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  summary.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B4F8A' } };
  summary.getRow(5).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  summary.getRow(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1268AD' } };
  summary.properties.tabColor = { argb: XLSX_COLORS.green };
  summary.columns = [{ width: 28 }, { width: 22 }, { width: 36 }, { width: 18 }, { width: 22 }, { width: 18 }];
  summary.getRow(1).height = 30;
  summary.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  summary.getRow(2).font = { bold: true, color: { argb: XLSX_COLORS.ink } };
  summary.getRow(3).font = { bold: true, color: { argb: XLSX_COLORS.ink } };
  summary.getColumn(2).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  summary.getCell('B7').numFmt = '0.0" %"';
  summary.addRow([]);
  summary.addRow(['Interpretación operativa', '', '', '', '', '']);
  summary.addRow(['Indicador', 'Valor', 'Criterio', 'Lectura', 'Responsable', 'Prioridad']);
  summary.addRow(['Cumplimiento general', Number(data.stats.compliance || 0), '>= 90 adecuado / 75-89 vigilancia / <75 crítico', Number(data.stats.compliance || 0) >= 90 ? 'Adecuado' : Number(data.stats.compliance || 0) >= 75 ? 'Vigilancia' : 'Crítico', 'Calidad', Number(data.stats.compliance || 0) >= 90 ? 'Normal' : 'Alta']);
  summary.addRow(['Alarmas abiertas', data.alarmStats.open_alarms || 0, 'Debe tender a cero', Number(data.alarmStats.open_alarms || 0) ? 'Revisar atención' : 'Sin pendientes', 'Operación', Number(data.alarmStats.open_alarms || 0) ? 'Alta' : 'Normal']);
  summary.addRow(['Eventos críticos', data.stats.critical_events || 0, 'Requiere análisis de causa', Number(data.stats.critical_events || 0) ? 'Hubo desviaciones' : 'Sin desviaciones', 'Regente / Calidad', Number(data.stats.critical_events || 0) ? 'Alta' : 'Normal']);
  summary.addRow(['Acciones correctivas', data.actions.length, 'Debe existir evidencia para cierres', data.actions.length ? 'Con trazabilidad' : 'Sin registros', 'Responsables de área', data.actions.length ? 'Normal' : 'Media']);
  summary.mergeCells('A12:F12');
  summary.getCell('A12').font = { bold: true, size: 13, color: { argb: XLSX_COLORS.white } };
  summary.getCell('A12').fill = fill(XLSX_COLORS.blue2);
  summary.getRow(13).font = { bold: true, color: { argb: XLSX_COLORS.white } };
  summary.getRow(13).fill = fill(XLSX_COLORS.blue);
  summary.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = thinBorder();
      cell.alignment = { vertical: 'middle', wrapText: true };
      if (rowNumber >= 14) styleStatusCell(cell, cell.value);
    });
  });
  summary.views = [{ state: 'frozen', ySplit: 13 }];

  const areas = workbook.addWorksheet('Cumplimiento por área');
  areas.columns = [
    { header: 'Área', key: 'area', width: 30 },
    { header: 'Lecturas', key: 'total_readings', width: 14 },
    { header: 'Cumplimiento %', key: 'compliance', width: 18 },
    { header: 'Eventos críticos', key: 'critical_events', width: 18 },
    { header: 'Advertencias', key: 'warning_events', width: 16 }
  ];
  areas.addRows(data.byArea);
  styleSheet(areas, { tabColor: XLSX_COLORS.green, headerColor: XLSX_COLORS.green });

  const sensors = workbook.addWorksheet('Dispositivos');
  sensors.columns = [
    { header: 'Código', key: 'code', width: 14 },
    { header: 'Dispositivo', key: 'name', width: 32 },
    { header: 'Sede', key: 'site_name', width: 28 },
    { header: 'Área', key: 'area', width: 26 },
    { header: 'Lecturas', key: 'total_readings', width: 12 },
    { header: 'Temp. mín.', key: 'temp_min', width: 12 },
    { header: 'Temp. máx.', key: 'temp_max', width: 12 },
    { header: 'Humedad mín.', key: 'humidity_min', width: 14 },
    { header: 'Humedad máx.', key: 'humidity_max', width: 14 },
    { header: 'Cumplimiento %', key: 'compliance', width: 16 },
    { header: 'Críticas', key: 'critical_events', width: 12 },
    { header: 'Advertencias', key: 'warning_events', width: 14 }
  ];
  sensors.addRows(data.bySensor);
  styleSheet(sensors, { tabColor: XLSX_COLORS.blue2, headerColor: XLSX_COLORS.blue2 });

  const alarms = workbook.addWorksheet('Alarmas');
  alarms.columns = [
    { header: 'Inicio', key: 'started_at', width: 24 },
    { header: 'Sensor', key: 'sensor_code', width: 14 },
    { header: 'Sede', key: 'site_name', width: 28 },
    { header: 'Área', key: 'area', width: 24 },
    { header: 'Nivel', key: 'level', width: 14 },
    { header: 'Estado', key: 'status', width: 16 },
    { header: 'Valor detectado', key: 'detected_value', width: 32 },
    { header: 'Rango permitido', key: 'allowed_range', width: 32 },
    { header: 'Descripción', key: 'description', width: 56 }
  ];
  alarms.addRows(data.alarms.map((alarm) => ({ ...alarm, started_at: dateTime(alarm.started_at) })));
  styleSheet(alarms, { tabColor: XLSX_COLORS.red, headerColor: XLSX_COLORS.red });

  const readings = workbook.addWorksheet('Lecturas');
  readings.columns = [
    { header: 'Fecha', key: 'created_at', width: 24 },
    { header: 'Sensor', key: 'sensor_code', width: 14 },
    { header: 'Sede', key: 'site_name', width: 28 },
    { header: 'Área', key: 'area', width: 24 },
    { header: 'Temperatura', key: 'temperature', width: 14 },
    { header: 'Humedad', key: 'humidity', width: 14 },
    { header: 'Estado', key: 'calculated_status', width: 16 },
    { header: 'Fuente', key: 'source', width: 16 }
  ];
  readings.addRows(data.readings.map((reading) => ({ ...reading, created_at: dateTime(reading.created_at), calculated_status: titleCase(reading.calculated_status) })));
  styleSheet(readings, { tabColor: XLSX_COLORS.blue, headerColor: XLSX_COLORS.blue });

  const actions = workbook.addWorksheet('Acciones correctivas');
  actions.columns = [
    { header: 'Fecha', key: 'created_at', width: 24 },
    { header: 'Sensor', key: 'sensor_code', width: 14 },
    { header: 'Dispositivo', key: 'sensor_name', width: 30 },
    { header: 'Usuario', key: 'user_name', width: 24 },
    { header: 'Acción', key: 'action_taken', width: 60 },
    { header: 'Resultado', key: 'final_status', width: 24 }
  ];
  actions.addRows(data.actions.map((action) => ({ ...action, created_at: dateTime(action.created_at) })));
  styleSheet(actions, { tabColor: XLSX_COLORS.yellow, headerColor: XLSX_COLORS.yellow });

  // Hoja de análisis por equipo: picos con marca de tiempo, MKT y tiempo fuera de rango.
  const analysisSheet = workbook.addWorksheet('Análisis por equipo');
  analysisSheet.columns = [
    { header: 'Equipo', key: 'equipo', width: 30 },
    { header: 'Temp. prom.', key: 'tavg', width: 12 },
    { header: 'Temp. máx.', key: 'tmax', width: 12 },
    { header: 'Máx. en', key: 'tmaxat', width: 20 },
    { header: 'Temp. mín.', key: 'tmin', width: 12 },
    { header: 'Mín. en', key: 'tminat', width: 20 },
    { header: 'MKT', key: 'mkt', width: 10 },
    { header: '% tiempo en rango', key: 'inrange', width: 16 },
    { header: 'Tiempo fuera', key: 'outtime', width: 16 },
    { header: 'Excursiones', key: 'exc', width: 12 }
  ];
  (data.analyses || []).forEach((a) => {
    analysisSheet.addRow({
      equipo: `${a.sensor.code} - ${a.sensor.name}`,
      tavg: a.temperature?.avg ?? null,
      tmax: a.temperature?.max?.value ?? null,
      tmaxat: a.temperature?.max ? dateTime(a.temperature.max.at) : '—',
      tmin: a.temperature?.min?.value ?? null,
      tminat: a.temperature?.min ? dateTime(a.temperature.min.at) : '—',
      mkt: a.mkt,
      inrange: a.temperature?.time.inPercent ?? null,
      outtime: durationText(a.temperature?.time.outMinutes || 0),
      exc: (a.temperature?.excursions.length || 0) + (a.humidity?.excursions.length || 0)
    });
  });
  styleSheet(analysisSheet, { tabColor: XLSX_COLORS.blue, headerColor: XLSX_COLORS.blue });

  // Hoja de excursiones detalladas (desviaciones fuera de rango).
  const excSheet = workbook.addWorksheet('Excursiones');
  excSheet.columns = [
    { header: 'Equipo', key: 'equipo', width: 30 },
    { header: 'Variable', key: 'variable', width: 14 },
    { header: 'Tipo', key: 'tipo', width: 14 },
    { header: 'Inicio', key: 'inicio', width: 22 },
    { header: 'Fin', key: 'fin', width: 22 },
    { header: 'Duración', key: 'duracion', width: 16 },
    { header: 'Valor pico', key: 'pico', width: 12 },
    { header: 'Pico en', key: 'picoat', width: 22 }
  ];
  (data.analyses || []).forEach((a) => {
    const rows = [
      ...(a.temperature?.excursions || []).map((e) => ({ ...e, variable: 'Temperatura', unit: '°C' })),
      ...(a.humidity?.excursions || []).map((e) => ({ ...e, variable: 'Humedad', unit: '%' }))
    ];
    rows.forEach((e) => excSheet.addRow({
      equipo: `${a.sensor.code} - ${a.sensor.name}`,
      variable: e.variable,
      tipo: e.type === 'alta' ? 'Sobre rango' : 'Bajo rango',
      inicio: dateTime(e.startAt),
      fin: dateTime(e.endAt),
      duracion: durationText(e.durationMin),
      pico: e.peak,
      picoat: dateTime(e.peakAt)
    }));
  });
  styleSheet(excSheet, { tabColor: XLSX_COLORS.red, headerColor: XLSX_COLORS.red });

  data.bySensor
    .filter((sensor) => Number(sensor.total_readings) > 0)
    .slice(0, 8)
    .forEach((sensor) => addUnitHistorySheet(workbook, sensor, data.readings, data));

  return workbook.xlsx.writeBuffer();
}

module.exports = { buildPdf, buildExcel, getReportData, getConfig };
