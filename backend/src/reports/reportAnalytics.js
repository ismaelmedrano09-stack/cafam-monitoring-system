// Análisis estadístico y de excursiones para los informes por equipo.
// Toma una serie de lecturas (cronológica ascendente) y los umbrales del sensor
// y produce métricas de cadena de frío: picos con marca de tiempo, MKT,
// tiempo dentro/fuera de rango y la lista de excursiones (desviaciones).

const R_GAS = 0.0083144; // kJ/mol·K
const DEFAULT_DELTA_H = 83.144; // kJ/mol — valor estándar farmacéutico para MKT

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// Temperatura Cinética Media (Mean Kinetic Temperature) en °C.
function meanKineticTemperature(tempsC, deltaH = DEFAULT_DELTA_H) {
  const kelvins = tempsC.map((t) => t + 273.15).filter((k) => k > 0);
  if (!kelvins.length) return null;
  const factor = deltaH / R_GAS;
  const avgExp = kelvins.reduce((sum, k) => sum + Math.exp(-factor / k), 0) / kelvins.length;
  if (avgExp <= 0) return null;
  const mktK = factor / -Math.log(avgExp);
  return mktK - 273.15;
}

// Extremo (máximo o mínimo) junto con la marca de tiempo en que ocurrió.
function extremeWithTime(readings, key, mode) {
  let best = null;
  for (const r of readings) {
    const v = toNum(r[key]);
    if (v === null) continue;
    if (!best || (mode === 'max' ? v > best.value : v < best.value)) {
      best = { value: v, at: r.created_at };
    }
  }
  return best;
}

// Minutos entre dos lecturas (acota valores anómalos para no inflar duraciones).
function minutesBetween(a, b, cap = 120) {
  const diff = Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 60000;
  return Math.min(diff, cap);
}

// Detecta excursiones: tramos consecutivos fuera del rango [min, max].
// Devuelve inicio, fin, duración en minutos, valor pico y el tipo (alta/baja).
function detectExcursions(readings, key, min, max) {
  if (min === null || max === null) return [];
  const excursions = [];
  let current = null;

  for (let i = 0; i < readings.length; i += 1) {
    const v = toNum(readings[i][key]);
    if (v === null) continue;
    const out = v > max ? 'alta' : v < min ? 'baja' : null;

    if (out) {
      if (!current || current.type !== out) {
        if (current) excursions.push(finishExcursion(current, readings));
        current = { type: out, startIdx: i, startAt: readings[i].created_at, peak: v, peakAt: readings[i].created_at, endIdx: i };
      } else {
        current.endIdx = i;
        if ((out === 'alta' && v > current.peak) || (out === 'baja' && v < current.peak)) {
          current.peak = v;
          current.peakAt = readings[i].created_at;
        }
      }
    } else if (current) {
      excursions.push(finishExcursion(current, readings));
      current = null;
    }
  }
  if (current) excursions.push(finishExcursion(current, readings));
  return excursions;
}

function finishExcursion(current, readings) {
  const startAt = current.startAt;
  // el fin real se extiende hasta la siguiente lectura dentro de rango (o la última)
  const endReading = readings[Math.min(current.endIdx + 1, readings.length - 1)];
  const endAt = endReading ? endReading.created_at : readings[current.endIdx].created_at;
  const durationMin = Math.round(minutesBetween(startAt, endAt, 1440));
  return {
    type: current.type,
    startAt,
    endAt,
    durationMin,
    peak: Number(current.peak.toFixed(2)),
    peakAt: current.peakAt,
    samples: current.endIdx - current.startIdx + 1
  };
}

// Tiempo total (min) dentro y fuera de rango, ponderado por el intervalo entre lecturas.
function timeInRange(readings, key, min, max) {
  let inMin = 0;
  let outMin = 0;
  for (let i = 0; i < readings.length - 1; i += 1) {
    const v = toNum(readings[i][key]);
    if (v === null) continue;
    const span = minutesBetween(readings[i].created_at, readings[i + 1].created_at);
    const inRange = min === null || max === null ? true : v >= min && v <= max;
    if (inRange) inMin += span; else outMin += span;
  }
  const total = inMin + outMin;
  return {
    inMinutes: Math.round(inMin),
    outMinutes: Math.round(outMin),
    inPercent: total > 0 ? Number(((inMin / total) * 100).toFixed(1)) : null
  };
}

// Análisis completo de una variable (temperatura o humedad).
function analyzeVariable(readings, key, min, max) {
  const values = readings.map((r) => toNum(r[key])).filter((v) => v !== null);
  if (!values.length) return null;
  return {
    count: values.length,
    avg: Number(mean(values).toFixed(2)),
    stdDev: Number(stdDev(values).toFixed(2)),
    max: extremeWithTime(readings, key, 'max'),
    min: extremeWithTime(readings, key, 'min'),
    range: { min, max },
    excursions: detectExcursions(readings, key, min, max),
    time: timeInRange(readings, key, min, max)
  };
}

// Análisis integral de un sensor: temperatura, humedad y MKT.
function analyzeSensor(sensor, readings) {
  const asc = [...readings].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const temp = analyzeVariable(asc, 'temperature', toNum(sensor.temp_min), toNum(sensor.temp_max));
  const humidity = analyzeVariable(asc, 'humidity', toNum(sensor.humidity_min), toNum(sensor.humidity_max));
  const tempsC = asc.map((r) => toNum(r.temperature)).filter((v) => v !== null);
  return {
    sensor,
    readings: asc,
    first: asc[0] || null,
    last: asc[asc.length - 1] || null,
    temperature: temp,
    humidity,
    mkt: tempsC.length ? Number((meanKineticTemperature(tempsC) ?? 0).toFixed(2)) : null,
    totalExcursions: (temp?.excursions.length || 0) + (humidity?.excursions.length || 0)
  };
}

module.exports = { analyzeSensor, analyzeVariable, meanKineticTemperature, detectExcursions };
