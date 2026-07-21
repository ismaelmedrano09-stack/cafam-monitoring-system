function validationError(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = 'VALIDATION_ERROR';
  return error;
}

function requiredText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw validationError(`${label} es obligatorio.`);
  return value.trim();
}

function numberInRange(value, label, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw validationError(`${label} debe estar entre ${min} y ${max}.`);
  }
  return number;
}

function optionalCoordinate(value, label, min, max) {
  if (value === null || value === undefined || value === '') return null;
  return numberInRange(value, label, min, max);
}

function validateSite(body) {
  const status = body.status || 'active';
  if (!['active', 'inactive'].includes(status)) throw validationError('El estado de la sede no es válido.');

  return {
    code: requiredText(body.code, 'El código de la sede'),
    name: requiredText(body.name, 'El nombre de la sede'),
    address: typeof body.address === 'string' ? body.address.trim() || null : null,
    city: requiredText(body.city, 'La ciudad'),
    latitude: numberInRange(body.latitude, 'La latitud', -90, 90),
    longitude: numberInRange(body.longitude, 'La longitud', -180, 180),
    status
  };
}

function validateSensor(body) {
  const siteId = Number(body.site_id);
  if (!Number.isInteger(siteId) || siteId < 1) throw validationError('Debe seleccionar una sede válida.');

  const status = body.status || 'activo';
  if (!['activo', 'inactivo', 'mantenimiento', 'desconectado'].includes(status)) {
    throw validationError('El estado del sensor no es válido.');
  }

  const powerStatus = body.power_status || 'normal';
  if (!['normal', 'battery', 'offline'].includes(powerStatus)) {
    throw validationError('El estado de energía del sensor no es válido.');
  }

  const tempMin = numberInRange(body.temp_min, 'La temperatura mínima', -80, 100);
  const tempMax = numberInRange(body.temp_max, 'La temperatura máxima', -80, 100);
  const humidityMin = numberInRange(body.humidity_min, 'La humedad mínima', 0, 100);
  const humidityMax = numberInRange(body.humidity_max, 'La humedad máxima', 0, 100);
  if (tempMin >= tempMax) throw validationError('La temperatura mínima debe ser menor que la máxima.');
  if (humidityMin >= humidityMax) throw validationError('La humedad mínima debe ser menor que la máxima.');

  const readingFrequency = Number(body.reading_frequency);
  if (!Number.isInteger(readingFrequency) || readingFrequency < 1 || readingFrequency > 1440) {
    throw validationError('La frecuencia de lectura debe estar entre 1 y 1440 minutos.');
  }

  return {
    ...body,
    site_id: siteId,
    code: requiredText(body.code, 'El código del sensor'),
    name: requiredText(body.name, 'El nombre del sensor'),
    type: requiredText(body.type, 'El tipo de sensor'),
    location: requiredText(body.location, 'La ubicación interna'),
    area: requiredText(body.area, 'El área'),
    status,
    power_status: powerStatus,
    reading_frequency: readingFrequency,
    temp_min: tempMin,
    temp_max: tempMax,
    humidity_min: humidityMin,
    humidity_max: humidityMax,
    battery_level: body.battery_level == null ? null : numberInRange(body.battery_level, 'El nivel de batería', 0, 100),
    latitude: optionalCoordinate(body.latitude, 'La latitud del sensor', -90, 90),
    longitude: optionalCoordinate(body.longitude, 'La longitud del sensor', -180, 180)
  };
}

module.exports = { validateSensor, validateSite, validationError };
