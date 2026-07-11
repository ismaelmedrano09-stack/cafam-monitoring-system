<template>
  <AppLayout title="Sedes y sensores">
    <div class="view-tabs" role="tablist" aria-label="Administración de sedes y sensores">
      <button :class="{ active: activeTab === 'sensors' }" @click="activeTab = 'sensors'">
        Sensores y zonas <span>{{ sensors.length }}</span>
      </button>
      <button :class="{ active: activeTab === 'sites' }" @click="activeTab = 'sites'">
        Sedes / locaciones <span>{{ sites.length }}</span>
      </button>
    </div>

    <section v-if="activeTab === 'sensors'" class="grid infrastructure-layout">
      <article class="panel">
        <div class="panel-heading">
          <div>
            <h2>Sensores registrados</h2>
            <p class="muted">Cada sensor está asociado a una sede y a una zona monitoreada.</p>
          </div>
          <button v-if="canManageSensors" class="secondary" @click="resetSensorForm">Nuevo sensor</button>
        </div>
        <div class="toolbar">
          <input v-model="sensorSearch" class="search-input" placeholder="Buscar sensor, sede o zona" />
          <select v-model="siteFilter" class="compact-select">
            <option value="">Todas las sedes</option>
            <option v-for="site in sites" :key="site.id" :value="String(site.id)">{{ site.name }}</option>
          </select>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Código</th><th>Sensor</th><th>Sede</th><th>Zona / área</th><th>Estado</th><th>Rango</th><th>Tendencia</th><th></th></tr></thead>
            <tbody>
              <tr v-for="sensor in filteredSensors" :key="sensor.id">
                <td><strong>{{ sensor.code }}</strong></td>
                <td>{{ sensor.name }}<br><small>{{ sensor.type }} · {{ sensor.technology || 'Tecnología no registrada' }}</small></td>
                <td>{{ sensor.site_name || 'Sin sede' }}</td>
                <td>{{ sensor.area }}<br><small>{{ sensor.location }}</small></td>
                <td><StatusBadge :status="sensor.status" /></td>
                <td>{{ sensor.temp_min }}–{{ sensor.temp_max }} °C<br><small>{{ sensor.humidity_min }}–{{ sensor.humidity_max }} % HR</small></td>
                <td>
                  <Sparkline v-if="sparklines[sensor.id]" :values="sparklines[sensor.id].map(r => r.temperature)" :color="sparklineColor(sensor.id)" />
                  <span v-else class="empty-state" style="font-size:11px">Sin datos</span>
                </td>
                <td class="actions">
                  <RouterLink class="secondary" :to="`/sensors/${sensor.id}`">Detalle</RouterLink>
                  <button v-if="canManageSensors" class="ghost" @click="editSensor(sensor)">Editar</button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!filteredSensors.length" class="empty-state">No se encontraron sensores con estos filtros.</p>
        </div>
      </article>

      <form v-if="canManageSensors" class="panel form-grid infrastructure-form" @submit.prevent="saveSensor">
        <div>
          <h2>{{ sensorForm.id ? 'Editar sensor' : 'Registrar nuevo sensor' }}</h2>
          <p class="muted">Seleccione una sede existente y escriba la nueva zona o área que será monitoreada.</p>
        </div>
        <label class="field">
          <span>Sede / locación</span>
          <select v-model.number="sensorForm.site_id" required>
            <option :value="null" disabled>Seleccione una sede</option>
            <option v-for="site in sites" :key="site.id" :value="site.id">{{ site.name }} · {{ site.city }}</option>
          </select>
        </label>
        <div class="form-columns">
          <label class="field"><span>Código interno</span><input v-model.trim="sensorForm.code" required placeholder="Ej. FAR-02" /></label>
          <label class="field"><span>Nombre del sensor</span><input v-model.trim="sensorForm.name" required placeholder="Ej. Farmacia norte" /></label>
        </div>
        <div class="form-columns">
          <label class="field"><span>Zona o área nueva</span><input v-model.trim="sensorForm.area" list="area-suggestions" required placeholder="Ej. Vacunación pediátrica" /></label>
          <label class="field"><span>Ubicación interna</span><input v-model.trim="sensorForm.location" required placeholder="Ej. Piso 2, consultorio 205" /></label>
        </div>
        <datalist id="area-suggestions"><option v-for="area in knownAreas" :key="area" :value="area" /></datalist>
        <div class="form-columns">
          <label class="field"><span>Tipo de sensor</span><select v-model="sensorForm.type"><option>SHT35</option><option>SHT85</option><option>DHT22</option><option>DS18B20</option><option>Otro</option></select></label>
          <label class="field"><span>Tecnología</span><select v-model="sensorForm.technology"><option>WiFi</option><option>LoRa / WiFi</option><option>Ethernet</option><option>Celular</option><option>Otra</option></select></label>
        </div>
        <div class="form-columns">
          <label class="field"><span>Firmware</span><input v-model.trim="sensorForm.firmware_version" placeholder="Ej. 2.4.1" /></label>
          <label class="field"><span>Estado</span><select v-model="sensorForm.status"><option value="activo">Activo</option><option value="inactivo">Inactivo</option><option value="mantenimiento">Mantenimiento</option><option value="desconectado">Desconectado</option></select></label>
        </div>
        <fieldset class="threshold-fieldset">
          <legend>Rangos permitidos</legend>
          <div class="form-columns">
            <label class="field"><span>Temperatura mín.</span><input v-model.number="sensorForm.temp_min" type="number" min="-80" max="100" step="0.1" required /></label>
            <label class="field"><span>Temperatura máx.</span><input v-model.number="sensorForm.temp_max" type="number" min="-80" max="100" step="0.1" required /></label>
            <label class="field"><span>Humedad mín.</span><input v-model.number="sensorForm.humidity_min" type="number" min="0" max="100" step="0.1" required /></label>
            <label class="field"><span>Humedad máx.</span><input v-model.number="sensorForm.humidity_max" type="number" min="0" max="100" step="0.1" required /></label>
          </div>
          <p class="threshold-help">La advertencia se activa dentro del 10 % cercano a cada límite. Fuera del rango se genera una alarma crítica.</p>
        </fieldset>
        <div class="form-columns">
          <label class="field"><span>Frecuencia de lectura (min)</span><input v-model.number="sensorForm.reading_frequency" type="number" min="1" max="1440" required /></label>
          <label class="field"><span>Responsable</span><input v-model.trim="sensorForm.responsible" /></label>
        </div>
        <label class="field"><span>Observaciones</span><textarea v-model.trim="sensorForm.observations" /></label>
        <label v-if="sensorForm.id" class="field"><span>Justificación de cambios en rangos</span><textarea v-model.trim="sensorForm.justification" /></label>
        <div class="form-actions">
          <button class="primary" :disabled="saving">{{ saving ? 'Guardando...' : sensorForm.id ? 'Guardar cambios' : 'Registrar sensor' }}</button>
          <button type="button" class="secondary" @click="resetSensorForm">Limpiar</button>
        </div>
      </form>
    </section>

    <section v-else class="grid infrastructure-layout">
      <article class="panel">
        <div class="panel-heading">
          <div>
            <h2>Sedes y locaciones</h2>
            <p class="muted">Instalaciones donde se encuentran las zonas y los sensores.</p>
          </div>
          <button v-if="canManageSites" class="secondary" @click="resetSiteForm">Nueva sede</button>
        </div>
        <div class="site-management-grid">
          <button v-for="site in sites" :key="site.id" class="site-management-card" @click="editSite(site)">
            <div>
              <strong>{{ site.name }}</strong>
              <span>{{ site.code }}</span>
            </div>
            <StatusBadge :status="site.status" />
            <p>{{ site.address || 'Dirección no registrada' }}</p>
            <small>{{ site.city }} · {{ equipmentCount(site.sensor_count) }}</small>
            <span class="coordinates">{{ site.latitude }}, {{ site.longitude }}</span>
          </button>
        </div>
      </article>

      <form v-if="canManageSites" class="panel form-grid infrastructure-form" @submit.prevent="saveSite">
        <div>
          <h2>{{ siteForm.id ? 'Editar sede' : 'Registrar nueva sede' }}</h2>
          <p class="muted">Las coordenadas permiten ubicar la sede en el centro de monitoreo.</p>
        </div>
        <div class="form-columns">
          <label class="field"><span>Código de sede</span><input v-model.trim="siteForm.code" required placeholder="Ej. CAFAM-NORTE" /></label>
          <label class="field"><span>Nombre de la sede</span><input v-model.trim="siteForm.name" required placeholder="Ej. Clínica Cafam Norte" /></label>
        </div>
        <label class="field"><span>Dirección</span><input v-model.trim="siteForm.address" placeholder="Dirección completa" /></label>
        <div class="form-columns">
          <label class="field"><span>Ciudad</span><input v-model.trim="siteForm.city" required /></label>
          <label class="field"><span>Estado</span><select v-model="siteForm.status"><option value="active">Activa</option><option value="inactive">Inactiva</option></select></label>
        </div>
        <div class="form-columns">
          <label class="field"><span>Latitud</span><input v-model.number="siteForm.latitude" type="number" min="-90" max="90" step="0.0000001" required /></label>
          <label class="field"><span>Longitud</span><input v-model.number="siteForm.longitude" type="number" min="-180" max="180" step="0.0000001" required /></label>
        </div>
        <div class="coordinate-help">
          <strong>Referencia para Bogotá:</strong>
          <span>Latitud 4.7110 · Longitud -74.0721</span>
        </div>
        <div class="form-actions">
          <button class="primary" :disabled="saving">{{ saving ? 'Guardando...' : siteForm.id ? 'Guardar cambios' : 'Registrar sede' }}</button>
          <button type="button" class="secondary" @click="resetSiteForm">Limpiar</button>
        </div>
      </form>
    </section>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppLayout from '../layouts/AppLayout.vue';
import StatusBadge from '../components/StatusBadge.vue';
import Sparkline from '../components/Sparkline.vue';
import api from '../services/api';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';

type Site = {
  id?: number; code: string; name: string; address: string; city: string;
  latitude: number; longitude: number; status: string; sensor_count?: number;
};
type SensorForm = {
  id?: number; site_id: number | null; code: string; name: string; type: string;
  technology: string; firmware_version: string; battery_level: number | null;
  power_status: string; latitude: number | null; longitude: number | null;
  location: string; area: string; status: string; reading_frequency: number;
  temp_min: number; temp_max: number; humidity_min: number; humidity_max: number;
  installed_at: string | null; last_calibration_at: string | null;
  responsible: string; observations: string; justification: string; site_name?: string;
};

const auth = useAuthStore();
const toast = useToastStore();
const saving = ref(false);
const sparklines = ref<Record<number, { temperature: number; humidity: number; status: string }[]>>({});
const activeTab = ref<'sensors' | 'sites'>('sensors');
const sensors = ref<SensorForm[]>([]);
const sites = ref<Site[]>([]);
const sensorSearch = ref('');
const siteFilter = ref('');
const originalThresholds = ref<Pick<SensorForm, 'temp_min' | 'temp_max' | 'humidity_min' | 'humidity_max'> | null>(null);

const baseSensorForm: SensorForm = {
  site_id: null, code: '', name: '', type: 'SHT35', technology: 'WiFi',
  firmware_version: '', battery_level: 100, power_status: 'normal',
  latitude: null, longitude: null, location: '', area: '', status: 'activo',
  reading_frequency: 5, temp_min: 2, temp_max: 8, humidity_min: 35,
  humidity_max: 70, installed_at: null, last_calibration_at: null,
  responsible: '', observations: '', justification: ''
};
const baseSiteForm: Site = {
  code: '', name: '', address: '', city: 'Bogotá', latitude: 4.7110,
  longitude: -74.0721, status: 'active'
};
const sensorForm = ref<SensorForm>({ ...baseSensorForm });
const siteForm = ref<Site>({ ...baseSiteForm });

const canManageSensors = computed(() => ['administrador', 'mantenimiento_biomedico'].includes(auth.role));
const canManageSites = computed(() => auth.role === 'administrador');
const knownAreas = computed(() => [...new Set(sensors.value.map((sensor) => sensor.area))].sort());
const filteredSensors = computed(() => {
  const search = sensorSearch.value.trim().toLocaleLowerCase();
  return sensors.value.filter((sensor) => {
    const matchesSite = !siteFilter.value || String(sensor.site_id) === siteFilter.value;
    const haystack = `${sensor.code} ${sensor.name} ${sensor.area} ${sensor.location} ${sensor.site_name || ''}`.toLocaleLowerCase();
    return matchesSite && (!search || haystack.includes(search));
  });
});

const equipmentCount = (count = 0) => `${count} ${Number(count) === 1 ? 'sensor' : 'sensores'}`;
function resetSensorForm() {
  sensorForm.value = { ...baseSensorForm };
  originalThresholds.value = null;
}
function resetSiteForm() { siteForm.value = { ...baseSiteForm }; }
function editSensor(sensor: SensorForm) {
  activeTab.value = 'sensors';
  sensorForm.value = {
    ...baseSensorForm,
    ...sensor,
    installed_at: sensor.installed_at?.slice(0, 10) || null,
    last_calibration_at: sensor.last_calibration_at?.slice(0, 10) || null,
    justification: ''
  };
  originalThresholds.value = {
    temp_min: sensor.temp_min,
    temp_max: sensor.temp_max,
    humidity_min: sensor.humidity_min,
    humidity_max: sensor.humidity_max
  };
}
function editSite(site: Site) {
  if (!canManageSites.value) return;
  siteForm.value = { ...site, latitude: Number(site.latitude), longitude: Number(site.longitude) };
}
function sparklineColor(sensorId: number) {
  const pts = sparklines.value[sensorId];
  if (!pts || !pts.length) return '#1268ad';
  const last = pts[pts.length - 1];
  if (last.status === 'critico') return '#be2e35';
  if (last.status === 'advertencia') return '#b98105';
  return '#168a55';
}

async function load() {
  const [sensorResponse, siteResponse, sparklineResponse] = await Promise.all([
    api.get('/sensors'),
    api.get('/monitoring/sites'),
    api.get('/sensors/sparklines').catch(() => ({ data: { data: {} } }))
  ]);
  sensors.value = sensorResponse.data.data;
  sites.value = siteResponse.data.data;
  sparklines.value = sparklineResponse.data.data ?? {};
}
async function saveSensor() {
  if (sensorForm.value.temp_min >= sensorForm.value.temp_max) {
    toast.show('La temperatura mínima debe ser menor que la máxima.', 'error');
    return;
  }
  if (sensorForm.value.humidity_min >= sensorForm.value.humidity_max) {
    toast.show('La humedad mínima debe ser menor que la máxima.', 'error');
    return;
  }
  const changedThresholds = originalThresholds.value && (
    originalThresholds.value.temp_min !== sensorForm.value.temp_min ||
    originalThresholds.value.temp_max !== sensorForm.value.temp_max ||
    originalThresholds.value.humidity_min !== sensorForm.value.humidity_min ||
    originalThresholds.value.humidity_max !== sensorForm.value.humidity_max
  );
  if (changedThresholds && !sensorForm.value.justification.trim()) {
    toast.show('Explique por qué se modificaron los rangos permitidos.', 'error');
    return;
  }
  saving.value = true;
  try {
    if (sensorForm.value.id) {
      await api.put(`/sensors/${sensorForm.value.id}`, sensorForm.value);
      toast.show('Sensor actualizado correctamente.');
    } else {
      await api.post('/sensors', sensorForm.value);
      toast.show('Sensor registrado y asociado a la zona.');
    }
    resetSensorForm();
    await load();
  } catch (error: any) {
    toast.show(error.response?.data?.message || 'No fue posible guardar el sensor.', 'error');
  } finally {
    saving.value = false;
  }
}
async function saveSite() {
  if (siteForm.value.latitude < -90 || siteForm.value.latitude > 90 ||
      siteForm.value.longitude < -180 || siteForm.value.longitude > 180) {
    toast.show('Revise las coordenadas de la sede.', 'error');
    return;
  }
  saving.value = true;
  try {
    if (siteForm.value.id) {
      await api.put(`/monitoring/sites/${siteForm.value.id}`, siteForm.value);
      toast.show('Sede actualizada correctamente.');
    } else {
      await api.post('/monitoring/sites', siteForm.value);
      toast.show('Nueva sede registrada correctamente.');
    }
    resetSiteForm();
    await load();
  } catch (error: any) {
    toast.show(error.response?.data?.message || 'No fue posible guardar la sede.', 'error');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
