const sensors = [
  { id: 1, code: 'NEV-01', name: 'Nevera de vacunas', type: 'SHT35', location: 'Farmacia central', area: 'Nevera de vacunas', status: 'activo', reading_frequency: 5, temp_min: 2, temp_max: 8, humidity_min: 35, humidity_max: 70, responsible: 'Regente Farmacia' },
  { id: 2, code: 'CF-01', name: 'Cuarto frío principal', type: 'SHT85', location: 'Sótano técnico', area: 'Cuarto frío', status: 'activo', reading_frequency: 5, temp_min: 2, temp_max: 8, humidity_min: 30, humidity_max: 75, responsible: 'Mantenimiento' },
  { id: 3, code: 'FAR-01', name: 'Farmacia central', type: 'DHT22', location: 'Piso 1', area: 'Farmacia', status: 'activo', reading_frequency: 10, temp_min: 15, temp_max: 25, humidity_min: 35, humidity_max: 65, responsible: 'Regente Farmacia' },
  { id: 4, code: 'MA-01', name: 'Medicamentos de alto costo', type: 'SHT35', location: 'Piso 1 - Bodega segura', area: 'Medicamentos de alto costo', status: 'activo', reading_frequency: 5, temp_min: 15, temp_max: 25, humidity_min: 35, humidity_max: 65, responsible: 'Calidad' }
];

const readings = Array.from({ length: 36 }, (_, index) => {
  const sensor = sensors[index % sensors.length];
  const critical = index % 11 === 0;
  const warning = index % 7 === 0;
  return {
    id: index + 1,
    sensor_id: sensor.id,
    sensor_code: sensor.code,
    sensor_name: sensor.name,
    area: sensor.area,
    temperature: critical ? sensor.temp_max + 1.2 : warning ? sensor.temp_max - 0.2 : ((sensor.temp_min + sensor.temp_max) / 2 + Math.random()).toFixed(1),
    humidity: critical ? sensor.humidity_max + 4 : warning ? sensor.humidity_max - 1 : ((sensor.humidity_min + sensor.humidity_max) / 2 + Math.random()).toFixed(1),
    calculated_status: critical ? 'critico' : warning ? 'advertencia' : 'normal',
    source: 'simulador',
    created_at: new Date(Date.now() - index * 10 * 60 * 1000).toISOString()
  };
});

const alarms = [
  { id: 1, sensor_id: 1, sensor_code: 'NEV-01', sensor_name: 'Nevera de vacunas', area: 'Nevera de vacunas', level: 'critica', type: 'fuera_de_rango', status: 'abierta', description: 'Temperatura fuera del rango permitido', started_at: new Date(Date.now() - 25 * 60 * 1000).toISOString() },
  { id: 2, sensor_id: 3, sensor_code: 'FAR-01', sensor_name: 'Farmacia central', area: 'Farmacia', level: 'advertencia', type: 'cercano_al_limite', status: 'en_atencion', description: 'Humedad cercana al límite configurado', started_at: new Date(Date.now() - 50 * 60 * 1000).toISOString() }
];

const actions = [
  { id: 1, alarm_id: 2, sensor_id: 3, sensor_code: 'FAR-01', user_name: 'Administrador Cafam', action_taken: 'Se verifico ventilacion y se ajusto el set point.', final_status: 'En observacion', created_at: new Date().toISOString() }
];

const users = [
  { id: 1, name: 'Administrador Cafam', email: 'admin@cafam.test', role: 'administrador', status: 'active' },
  { id: 2, name: 'Regente Farmacia', email: 'regente@cafam.test', role: 'regente_farmacia', status: 'active' },
  { id: 3, name: 'Analista Calidad', email: 'calidad@cafam.test', role: 'calidad', status: 'active' }
];

const sites = [
  { id: 1, name: 'Clínica Cafam Central', city: 'Bogotá', latitude: 4.692394, longitude: -74.075371, sensor_count: 3, sensors_in_alarm: 1 },
  { id: 3, name: 'Centro Médico Cafam Calle 93', city: 'Bogotá', latitude: 4.676012, longitude: -74.049826, sensor_count: 1, sensors_in_alarm: 0 }
];

function response(data, message = 'Datos demo') {
  return Promise.resolve({ data: { success: true, message, data } });
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function sensorCompliance(sensor) {
  const sensorReadings = readings.filter((reading) => reading.sensor_id === sensor.id);
  const normal = sensorReadings.filter((reading) => reading.calculated_status === 'normal').length;
  return {
    total: sensorReadings.length,
    compliance: sensorReadings.length ? Number(((normal / sensorReadings.length) * 100).toFixed(1)) : 0,
    critical: sensorReadings.filter((reading) => reading.calculated_status === 'critico').length,
    warning: sensorReadings.filter((reading) => reading.calculated_status === 'advertencia').length
  };
}

function buildDemoCsv() {
  const complianceRows = sensors.map((sensor) => ({ ...sensor, metrics: sensorCompliance(sensor) }));
  const avgCompliance = complianceRows.reduce((sum, row) => sum + row.metrics.compliance, 0) / Math.max(complianceRows.length, 1);
  const sections = [
    ['CAFAM MONITORING - REPORTE DEMO'],
    ['Generado', new Date().toLocaleString('es-CO')],
    ['Modo', 'Demostración'],
    [],
    ['RESUMEN EJECUTIVO'],
    ['Indicador', 'Valor'],
    ['Sensores activos', sensors.length],
    ['Lecturas simuladas', readings.length],
    ['Alarmas activas', alarms.length],
    ['Cumplimiento promedio', `${avgCompliance.toFixed(1)} %`],
    [],
    ['DISPOSITIVOS'],
    ['Código', 'Dispositivo', 'Área', 'Ubicación', 'Temp. mín.', 'Temp. máx.', 'Hum. mín.', 'Hum. máx.', 'Lecturas', 'Cumplimiento %', 'Críticas', 'Advertencias'],
    ...complianceRows.map((sensor) => [
      sensor.code,
      sensor.name,
      sensor.area,
      sensor.location,
      sensor.temp_min,
      sensor.temp_max,
      sensor.humidity_min,
      sensor.humidity_max,
      sensor.metrics.total,
      sensor.metrics.compliance,
      sensor.metrics.critical,
      sensor.metrics.warning
    ]),
    [],
    ['ALARMAS'],
    ['Fecha', 'Sensor', 'Área', 'Nivel', 'Estado', 'Descripción'],
    ...alarms.map((alarm) => [
      new Date(alarm.started_at).toLocaleString('es-CO'),
      alarm.sensor_code,
      alarm.area,
      alarm.level,
      alarm.status,
      alarm.description
    ]),
    [],
    ['LECTURAS RECIENTES'],
    ['Fecha', 'Sensor', 'Área', 'Temperatura', 'Humedad', 'Estado', 'Fuente'],
    ...readings.slice(0, 80).map((reading) => [
      new Date(reading.created_at).toLocaleString('es-CO'),
      reading.sensor_code,
      reading.area,
      reading.temperature,
      reading.humidity,
      reading.calculated_status,
      reading.source
    ])
  ];
  const csv = sections.map((row) => row.map(csvCell).join(',')).join('\r\n');
  return new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
}

function buildDemoHtml() {
  const critical = readings.filter((reading) => reading.calculated_status === 'critico').length;
  const warning = readings.filter((reading) => reading.calculated_status === 'advertencia').length;
  const compliance = readings.length ? ((readings.length - critical - warning) / readings.length) * 100 : 0;
  const alarmRows = alarms.map((alarm) => `
    <tr>
      <td>${escapeHtml(new Date(alarm.started_at).toLocaleString('es-CO'))}</td>
      <td>${escapeHtml(alarm.sensor_code)}</td>
      <td>${escapeHtml(alarm.area)}</td>
      <td><span class="badge ${escapeHtml(alarm.level)}">${escapeHtml(alarm.level)}</span></td>
      <td>${escapeHtml(alarm.description)}</td>
    </tr>
  `).join('');
  const readingRows = readings.slice(0, 36).map((reading) => `
    <tr>
      <td>${escapeHtml(new Date(reading.created_at).toLocaleString('es-CO'))}</td>
      <td><strong>${escapeHtml(reading.sensor_code)}</strong><br><small>${escapeHtml(reading.sensor_name)}</small></td>
      <td>${escapeHtml(reading.area)}</td>
      <td>${escapeHtml(reading.temperature)} °C</td>
      <td>${escapeHtml(reading.humidity)} % HR</td>
      <td><span class="badge ${escapeHtml(reading.calculated_status)}">${escapeHtml(reading.calculated_status)}</span></td>
    </tr>
  `).join('');

  return new Blob([`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Cafam Monitoring - Reporte demo</title>
  <style>
    body{margin:0;background:#f4f8fb;color:#1d2b36;font-family:Arial,Helvetica,sans-serif}
    .page{max-width:980px;margin:28px auto;background:#fff;border:1px solid #dce5ec;border-radius:10px;overflow:hidden;box-shadow:0 18px 60px rgba(24,73,108,.12)}
    header{background:#0b4f8a;color:white;padding:28px 34px} header h1{margin:0;font-size:28px} header p{margin:8px 0 0;color:rgba(255,255,255,.82)}
    main{padding:28px 34px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
    .kpi{border:1px solid #dce5ec;border-left:5px solid #1268ad;border-radius:8px;padding:14px;background:#fbfdfe}.kpi.red{border-left-color:#be2e35}.kpi.green{border-left-color:#168a55}
    .kpi span{display:block;color:#647382;font-size:12px;font-weight:700;text-transform:uppercase}.kpi strong{display:block;margin-top:8px;font-size:24px}
    h2{margin:24px 0 12px;font-size:18px}table{width:100%;border-collapse:collapse;margin-bottom:18px}th{background:#eaf3fb;color:#0b4f8a;text-align:left;font-size:12px}th,td{border-bottom:1px solid #dce5ec;padding:9px;font-size:13px;vertical-align:top}
    .badge{display:inline-block;border-radius:999px;padding:4px 8px;background:#edf3f7;color:#647382;font-size:11px;font-weight:800;text-transform:capitalize}.badge.critico,.badge.critica{background:#fae7e9;color:#be2e35}.badge.advertencia{background:#fff4d8;color:#9a6b00}.badge.normal{background:#dff3e9;color:#168a55}
    footer{padding:18px 34px;background:#f8fbfd;color:#647382;font-size:12px}@media print{body{background:white}.page{box-shadow:none;margin:0;border:0}.kpis{grid-template-columns:repeat(2,1fr)}}
  </style>
</head>
<body>
  <section class="page">
    <header><h1>Cafam Monitoring</h1><p>Reporte clínico de demostración · Generado ${escapeHtml(new Date().toLocaleString('es-CO'))}</p></header>
    <main>
      <section class="kpis">
        <div class="kpi"><span>Lecturas</span><strong>${readings.length}</strong></div>
        <div class="kpi green"><span>Cumplimiento</span><strong>${compliance.toFixed(1)} %</strong></div>
        <div class="kpi red"><span>Alarmas</span><strong>${alarms.length}</strong></div>
        <div class="kpi"><span>Dispositivos</span><strong>${sensors.length}</strong></div>
      </section>
      <h2>Alarmas activas</h2>
      <table><thead><tr><th>Fecha</th><th>Sensor</th><th>Área</th><th>Nivel</th><th>Descripción</th></tr></thead><tbody>${alarmRows}</tbody></table>
      <h2>Lecturas recientes</h2>
      <table><thead><tr><th>Fecha</th><th>Sensor</th><th>Área</th><th>Temperatura</th><th>Humedad</th><th>Estado</th></tr></thead><tbody>${readingRows}</tbody></table>
    </main>
    <footer>Archivo demo imprimible. Para guardar como PDF usa Ctrl + P y selecciona “Guardar como PDF”.</footer>
  </section>
</body>
</html>`], { type: 'text/html;charset=utf-8' });
}

export function isDemoMode() {
  if (!import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO !== 'true') return false;
  return localStorage.getItem('cafam_demo') === 'true';
}

export function mockApi(config) {
  const url = config.url || '';
  const method = (config.method || 'get').toLowerCase();

  if (url === '/monitoring/contacts/register' && method === 'post') {
    const token = `demo-${Date.now()}`;
    localStorage.setItem('cafam_demo_confirmation', token);
    return response({ id: Date.now(), email_sent: false, demo: true, confirmation_token: token }, 'Registro guardado en modo demo. Confirma la suscripción desde esta pantalla.');
  }
  if (url.startsWith('/monitoring/contacts/confirm?token=') && method === 'get') {
    const token = new URLSearchParams(url.split('?')[1]).get('token');
    const expected = localStorage.getItem('cafam_demo_confirmation');
    if (token && token === expected) {
      localStorage.removeItem('cafam_demo_confirmation');
      return response(null, '¡Suscripción de demostración confirmada correctamente!');
    }
    return Promise.reject({ response: { status: 404, data: { message: 'El enlace de confirmación no es válido o ya fue usado.' } } });
  }
  if (url === '/auth/public-register' && method === 'post') {
    const token = `demo-user-${Date.now()}`;
    localStorage.setItem('cafam_demo_user_confirmation', token);
    return response({ id: Date.now(), email_sent: false, demo: true, confirmation_token: token }, 'Registro de usuario guardado en modo demo. Confirma la cuenta desde esta pantalla.');
  }
  if (url.startsWith('/auth/confirm-registration?token=') && method === 'get') {
    const token = new URLSearchParams(url.split('?')[1]).get('token');
    const expected = localStorage.getItem('cafam_demo_user_confirmation');
    if (token && token === expected) {
      localStorage.removeItem('cafam_demo_user_confirmation');
      return response(null, 'Cuenta de demostración confirmada correctamente. Ya puedes iniciar sesión.');
    }
    return Promise.reject({ response: { status: 404, data: { message: 'El enlace de confirmación no es válido o ya fue usado.' } } });
  }
  if (url === '/monitoring/simulate-alert' && method === 'post') {
    return response({ skipped: true }, 'Simulación registrada (modo demo). Configure SMTP para enviar correos reales.');
  }
  if (method !== 'get') return response({ id: Date.now() }, 'Operación demo registrada');
  if (url.startsWith('/reports/')) {
    const format = url.endsWith('/pdf') ? 'pdf' : 'excel';
    return Promise.resolve({ data: format === 'pdf' ? buildDemoHtml() : buildDemoCsv() });
  }
  if (url === '/dashboard/summary') {
    return response({
      active_sensors: 4,
      disconnected_sensors: 0,
      total_sensors: 4,
      today_readings: readings.length,
      avg_temperature: 12.8,
      avg_humidity: 58.4,
      open_alarms: 2,
      alert_sensors: 2,
      critical_open: 1,
      system_status: 'critico',
      last_reading: readings[0]
    });
  }
  if (url === '/dashboard/charts') {
    return response({
      temperature: readings,
      humidity: readings,
      alarmsByLevel: [{ level: 'critica', total: 1 }, { level: 'advertencia', total: 1 }],
      complianceByArea: sensors.map((sensor) => ({ area: sensor.area, compliance: sensor.id === 1 ? 82 : 94 }))
    });
  }
  if (url === '/dashboard/operations') {
    return response({
      alarmQueue: alarms.map((alarm, index) => ({
        ...alarm,
        site_name: sites[0].name,
        age_minutes: index ? 50 : 25,
        sla_status: index ? 'en_tiempo' : 'vencida'
      })),
      deviceHealth: sensors.map((sensor, index) => ({
        ...sensor,
        site_name: index < 3 ? sites[0].name : sites[1].name,
        battery_level: index === 0 ? 18 : 80,
        power_status: index === 0 ? 'battery' : 'normal',
        silent_minutes: index === 1 ? 35 : 2,
        open_alarms: alarms.filter((alarm) => alarm.sensor_id === sensor.id).length
      })),
      siteHealth: sites.map((site) => ({
        ...site,
        total_sensors: site.sensor_count,
        active_sensors: site.sensor_count,
        disconnected_sensors: 0,
        alert_sensors: site.sensors_in_alarm,
        availability: 100
      })),
      indicators: { overdue_alarms: 1, avg_resolution_minutes: 42, alarms_in_progress: 1 }
    });
  }
  if (url === '/monitoring/overview') {
    return response({
      sites,
      devices: sensors.map((sensor, index) => ({
        ...sensor,
        site_id: index < 3 ? 1 : 3,
        site_name: index < 3 ? sites[0].name : sites[1].name,
        temperature: readings[index]?.temperature,
        humidity: readings[index]?.humidity,
        calculated_status: readings[index]?.calculated_status,
        battery_level: 76 + index * 5,
        firmware_version: '2.4.0',
        open_alarms: alarms.filter((alarm) => alarm.sensor_id === sensor.id).length
      })),
      alarmedVariables: alarms.map((alarm) => ({ ...alarm, site_name: sites[0].name })),
      notifications: []
    });
  }
  if (url === '/monitoring/sites') return response(sites);
  if (url === '/monitoring/contacts') {
    return response([
      { id: 1, name: 'María García', cargo: 'Regente de farmacia', email: 'mgarcia@cafam.test', phone: '3001234567', channels: ['email'], levels: ['critica','advertencia'], status: 'active', site_name: 'Clínica Cafam Central' },
      { id: 2, name: 'Carlos Herrera', cargo: 'Coordinador calidad', email: 'cherrera@cafam.test', phone: '3109876543', channels: ['email','sms'], levels: ['critica'], status: 'active', site_name: null }
    ]);
  }
  if (url === '/monitoring/areas') {
    const grouped = [...new Set(sensors.map((sensor) => sensor.area))].map((area) => {
      const areaSensors = sensors.filter((sensor) => sensor.area === area);
      const areaReadings = readings.filter((reading) => reading.area === area);
      const tempMin = Math.min(...areaSensors.map((sensor) => sensor.temp_min));
      const tempMax = Math.max(...areaSensors.map((sensor) => sensor.temp_max));
      const tolerance = (tempMax - tempMin) * 0.1;
      return {
        area,
        temp_min: tempMin,
        temp_max: tempMax,
        temp_warning_low: Number((tempMin + tolerance).toFixed(2)),
        temp_warning_high: Number((tempMax - tolerance).toFixed(2)),
        humidity_min: Math.min(...areaSensors.map((sensor) => sensor.humidity_min)),
        humidity_max: Math.max(...areaSensors.map((sensor) => sensor.humidity_max)),
        sensor_count: areaSensors.length,
        sensors_in_alarm: alarms.filter((alarm) => alarm.area === area).length,
        last_reading_at: areaReadings[0]?.created_at,
        sensors: areaSensors.map((sensor) => {
          const latest = areaReadings.find((reading) => reading.sensor_id === sensor.id);
          return { ...sensor, site_name: 'Clínica Cafam Central', ...latest };
        }),
        readings: areaReadings
      };
    });
    return response(grouped);
  }
  if (url.startsWith('/monitoring/extrema')) {
    return response({ days: 30, rows: sensors.map((sensor, index) => ({ id: sensor.id, code: sensor.code, name: sensor.name, site_name: index < 3 ? sites[0].name : sites[1].name, temp_min: sensor.temp_min, temp_max: sensor.temp_max, temp_avg: (sensor.temp_min + sensor.temp_max) / 2, humidity_min: sensor.humidity_min, humidity_max: sensor.humidity_max, compliance: 94 })) });
  }
  if (url === '/sensors/sparklines') {
    const map: Record<number, { temperature: number; humidity: number; status: string }[]> = {};
    sensors.forEach((sensor) => {
      map[sensor.id] = Array.from({ length: 10 }, (_, i) => {
        const base = (sensor.temp_min + sensor.temp_max) / 2;
        const temp = base + (Math.random() - 0.5) * (sensor.temp_max - sensor.temp_min) * 0.6;
        return { temperature: Number(temp.toFixed(1)), humidity: 50, status: temp > sensor.temp_max ? 'critico' : temp > sensor.temp_max - 0.5 ? 'advertencia' : 'normal' };
      });
    });
    return response(map);
  }
  if (url === '/sensors') return response(sensors);
  if (url.startsWith('/sensors/')) {
    const id = Number(url.split('/').pop());
    return response({ sensor: sensors.find((sensor) => sensor.id === id), readings: readings.filter((r) => r.sensor_id === id), alarms: alarms.filter((a) => a.sensor_id === id) });
  }
  if (url.startsWith('/readings')) return response(readings);
  if (url.startsWith('/alarms')) {
    const enriched = alarms.map((alarm) => {
      const age = Math.round((Date.now() - new Date(alarm.started_at).getTime()) / 60000);
      const sla_status = alarm.status !== 'cerrada' && ((alarm.level === 'critica' && age > 15) || (alarm.level === 'advertencia' && age > 60)) ? 'vencida' : 'en_tiempo';
      return { ...alarm, age_minutes: age, sla_status };
    });
    return Promise.resolve({ data: { success: true, message: 'Datos demo', data: enriched, meta: { total: enriched.length, page: 1, limit: 20, pages: 1 } } });
  }
  if (url.startsWith('/corrective-actions')) return response(actions);
  if (url.startsWith('/users')) return response(users);
  if (url.startsWith('/audit-logs')) {
    return response([{ id: 1, user_name: 'Sistema demo', action: 'demo_mode', entity: 'frontend', description: 'Vista cargada sin MySQL activo', created_at: new Date().toISOString() }]);
  }
  return response([]);
}
