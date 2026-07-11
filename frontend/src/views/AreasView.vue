<template>
  <AppLayout title="Áreas monitoreadas">
    <AsyncState v-if="loading" tone="loading" title="Cargando áreas" message="Consultando sensores, rangos y lecturas recientes." />
    <AsyncState v-else-if="loadError" tone="error" title="No fue posible consultar las áreas" :message="loadError" action-label="Intentar de nuevo" @action="load" />
    <AsyncState v-else-if="!areas.length" title="No hay áreas registradas" message="Registre una sede y su primer sensor para comenzar el monitoreo." action-label="Registrar infraestructura" @action="router.push('/sensors')" />
    <section v-else class="area-layout">
      <aside class="panel area-sidebar">
        <div class="panel-heading">
          <div>
            <h2>Áreas</h2>
            <p class="muted">Seleccione un área para consultar su comportamiento.</p>
          </div>
        </div>
        <button
          v-for="area in areas"
          :key="area.area"
          class="area-option"
          :class="{ selected: selectedArea?.area === area.area }"
          @click="selectArea(area)"
        >
          <span class="area-option-state" :class="Number(area.sensors_in_alarm) ? 'critical' : 'normal'"></span>
          <span>
            <strong>{{ area.area }}</strong>
            <small>{{ sensorCount(area.sensor_count) }} · {{ area.temp_min }}–{{ area.temp_max }} °C</small>
          </span>
          <StatusBadge :status="Number(area.sensors_in_alarm) ? 'critica' : 'normal'" />
        </button>
      </aside>

      <main v-if="selectedArea" class="area-content">
        <section class="area-heading">
          <div>
            <span class="eyebrow-dark">Área seleccionada</span>
            <h2>{{ selectedArea.area }}</h2>
            <p>{{ selectedSensor?.site_name || 'Todas las sedes' }} · Última actualización: {{ formatDate(selectedArea.last_reading_at) }}</p>
          </div>
          <select v-model="selectedSensorId" class="compact-select">
            <option value="all">Todos los sensores</option>
            <option v-for="sensor in selectedArea.sensors" :key="sensor.id" :value="String(sensor.id)">
              {{ sensor.code }} · {{ sensor.name }}
            </option>
          </select>
        </section>

        <div v-if="selectedSensorId === 'all' && Number(selectedArea.threshold_config_count) > 1" class="inline-alert">
          Esta área tiene sensores con rangos diferentes. Seleccione un sensor para revisar sus límites exactos.
        </div>

        <section class="grid area-kpis">
          <article class="area-kpi">
            <span>Temperatura actual</span>
            <strong>{{ currentReading ? `${currentReading.temperature} °C` : 'Sin datos' }}</strong>
            <StatusBadge :status="currentReading?.calculated_status || 'normal'" />
          </article>
          <article class="area-kpi">
            <span>Rango permitido</span>
            <strong>{{ threshold.temp_min }}–{{ threshold.temp_max }} °C</strong>
            <small>Fuera de este rango se genera alarma crítica.</small>
          </article>
          <article class="area-kpi warning">
            <span>Umbral inferior de tolerancia</span>
            <strong>{{ threshold.temp_warning_low }} °C</strong>
            <small>Entre {{ threshold.temp_min }} y {{ threshold.temp_warning_low }} °C se genera advertencia.</small>
          </article>
          <article class="area-kpi warning">
            <span>Umbral superior de tolerancia</span>
            <strong>{{ threshold.temp_warning_high }} °C</strong>
            <small>Entre {{ threshold.temp_warning_high }} y {{ threshold.temp_max }} °C se genera advertencia.</small>
          </article>
        </section>

        <article class="panel area-chart-panel">
          <div class="panel-heading">
            <div>
              <h2>Temperatura registrada</h2>
              <p class="muted">Las líneas punteadas representan los límites y umbrales configurados.</p>
            </div>
            <div class="chart-legend">
              <span><i class="legend-reading"></i>Lectura</span>
              <span><i class="legend-warning"></i>Tolerancia</span>
              <span><i class="legend-critical"></i>Alarma crítica</span>
            </div>
          </div>
          <div class="area-chart">
            <Line :data="chartData" :options="chartOptions" />
          </div>
          <p v-if="!filteredReadings.length" class="empty-state">No hay lecturas registradas para este filtro.</p>
        </article>

        <article class="panel">
          <h2>Escala de temperatura y tolerancia</h2>
          <div class="threshold-scale">
            <div class="threshold-segments">
              <span class="critical">Alarma</span>
              <span class="warning">Tolerancia</span>
              <span class="normal">Rango normal</span>
              <span class="warning">Tolerancia</span>
              <span class="critical">Alarma</span>
            </div>
            <div class="threshold-labels">
              <span>&lt; {{ threshold.temp_min }} °C</span>
              <span>{{ threshold.temp_warning_low }} °C</span>
              <span>{{ threshold.temp_warning_high }} °C</span>
              <span>&gt; {{ threshold.temp_max }} °C</span>
            </div>
          </div>
          <div class="threshold-notes">
            <p><strong>Normal:</strong> temperatura entre {{ threshold.temp_warning_low }} y {{ threshold.temp_warning_high }} °C.</p>
            <p><strong>Advertencia:</strong> temperatura dentro del 10 % cercano a los límites permitidos.</p>
            <p><strong>Crítica:</strong> temperatura menor a {{ threshold.temp_min }} °C o mayor a {{ threshold.temp_max }} °C.</p>
          </div>
        </article>

        <article class="panel table-wrap">
          <div class="panel-heading">
            <h2>Sensores del área</h2>
          </div>
          <table>
            <thead><tr><th>Sensor</th><th>Sede</th><th>Última temperatura</th><th>Humedad</th><th>Estado</th><th>Rango</th></tr></thead>
            <tbody>
              <tr v-for="sensor in selectedArea.sensors" :key="sensor.id">
                <td><RouterLink :to="`/sensors/${sensor.id}`"><strong>{{ sensor.code }}</strong><br><small>{{ sensor.name }}</small></RouterLink></td>
                <td>{{ sensor.site_name || 'Sin sede' }}</td>
                <td>{{ value(sensor.temperature, ' °C') }}</td>
                <td>{{ value(sensor.humidity, ' % HR') }}</td>
                <td><StatusBadge :status="sensor.calculated_status || sensor.status" /></td>
                <td>{{ sensor.temp_min }}–{{ sensor.temp_max }} °C</td>
              </tr>
            </tbody>
          </table>
        </article>
      </main>
    </section>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from 'chart.js';
import AppLayout from '../layouts/AppLayout.vue';
import AsyncState from '../components/AsyncState.vue';
import StatusBadge from '../components/StatusBadge.vue';
import api from '../services/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type AreaSensor = {
  id: number; code: string; name: string; site_name?: string; status: string;
  temperature?: number; humidity?: number; calculated_status?: string;
  temp_min: number; temp_max: number;
};
type AreaReading = {
  id: number; sensor_id: number; sensor_code: string; temperature: number;
  humidity: number; calculated_status: string; created_at: string;
};
type AreaData = {
  area: string; temp_min: number; temp_max: number; temp_warning_low: number;
  temp_warning_high: number; humidity_min: number; humidity_max: number;
  sensor_count: number; sensors_in_alarm: number; last_reading_at?: string;
  threshold_config_count?: number;
  sensors: AreaSensor[]; readings: AreaReading[];
};

const areas = ref<AreaData[]>([]);
const selectedArea = ref<AreaData | null>(null);
const selectedSensorId = ref('all');
const loading = ref(true);
const loadError = ref('');
const router = useRouter();

const selectedSensor = computed(() => selectedSensorId.value === 'all'
  ? undefined
  : selectedArea.value?.sensors.find((sensor) => String(sensor.id) === selectedSensorId.value));
const threshold = computed(() => {
  const source = selectedSensor.value || selectedArea.value;
  const tempMin = Number(source?.temp_min || 0);
  const tempMax = Number(source?.temp_max || 0);
  const tolerance = (tempMax - tempMin) * 0.1;
  return {
    temp_min: tempMin,
    temp_max: tempMax,
    temp_warning_low: Number((tempMin + tolerance).toFixed(2)),
    temp_warning_high: Number((tempMax - tolerance).toFixed(2))
  };
});
const filteredReadings = computed(() => {
  if (!selectedArea.value) return [];
  const readings = selectedSensorId.value === 'all'
    ? selectedArea.value.readings
    : selectedArea.value.readings.filter((reading) => String(reading.sensor_id) === selectedSensorId.value);
  return readings.slice(-120);
});
const currentReading = computed(() => filteredReadings.value[filteredReadings.value.length - 1]);

function referenceDataset(label: string, value: number, color: string) {
  return {
    label,
    data: filteredReadings.value.map(() => value),
    borderColor: color,
    borderDash: [7, 5],
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0
  };
}
const chartData = computed(() => {
  const area = selectedArea.value;
  const limits = threshold.value;
  const readings = filteredReadings.value;
  if (!area) return { labels: [], datasets: [] };
  return {
    labels: readings.map((reading) => new Date(reading.created_at).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })),
    datasets: [
      {
        label: 'Temperatura registrada',
        data: readings.map((reading) => Number(reading.temperature)),
        borderColor: '#1268ad',
        backgroundColor: '#1268ad',
        borderWidth: 2.5,
        pointRadius: readings.length > 40 ? 0 : 3,
        pointHoverRadius: 5,
        tension: 0.25
      },
      referenceDataset('Límite mínimo crítico', limits.temp_min, '#be2e35'),
      referenceDataset('Umbral mínimo de tolerancia', limits.temp_warning_low, '#b98105'),
      referenceDataset('Umbral máximo de tolerancia', limits.temp_warning_high, '#b98105'),
      referenceDataset('Límite máximo crítico', limits.temp_max, '#be2e35')
    ]
  };
});
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { intersect: false, mode: 'index' as const },
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { maxTicksLimit: 8, maxRotation: 0, font: { size: 10 } }, grid: { display: false } },
    y: { title: { display: true, text: 'Temperatura (°C)' }, ticks: { maxTicksLimit: 7 }, grid: { color: '#edf3f7' } }
  }
};

const sensorCount = (count: number) => `${count} ${Number(count) === 1 ? 'sensor' : 'sensores'}`;
const value = (input: unknown, suffix: string) => input === null || input === undefined ? 'Sin datos' : `${input}${suffix}`;
const formatDate = (input?: string) => input ? new Date(input).toLocaleString() : 'Sin registros';
function selectArea(area: AreaData) {
  selectedArea.value = area;
  selectedSensorId.value = 'all';
}
async function load() {
  loading.value = true;
  try {
    const { data } = await api.get('/monitoring/areas');
    areas.value = data.data;
    loadError.value = '';
    if (areas.value.length) selectArea(areas.value[0]);
  } catch {
    loadError.value = 'Verifique la conexión con la API y vuelva a intentarlo.';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
