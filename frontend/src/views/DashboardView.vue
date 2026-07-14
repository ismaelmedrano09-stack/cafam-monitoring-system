<template>
  <AppLayout title="Panel principal">
    <AsyncState
      v-if="loading"
      tone="loading"
      title="Preparando el panel"
      message="Estamos consultando sensores, lecturas y alarmas."
    />
    <AsyncState
      v-else-if="loadError"
      tone="error"
      title="No fue posible cargar el panel"
      :message="loadError"
      action-label="Intentar de nuevo"
      @action="load(true)"
    />
    <template v-else>
    <section class="live-toolbar">
      <div class="live-indicator" :class="{ paused: !autoRefresh }">
        <span></span>
        {{ autoRefresh ? 'Actualización automática activa' : 'Actualización pausada' }}
      </div>
      <small>Última consulta: {{ lastUpdatedLabel }}</small>
      <button class="secondary icon-text-button" type="button" @click="toggleAutoRefresh">
        <Pause v-if="autoRefresh" :size="16" />
        <Play v-else :size="16" />
        {{ autoRefresh ? 'Pausar' : 'Reanudar' }}
      </button>
      <button class="icon-button" type="button" title="Actualizar ahora" :disabled="refreshing" @click="load(false)">
        <RefreshCw :size="18" :class="{ spinning: refreshing }" />
      </button>
    </section>

    <section class="command-band" :class="summary.system_status">
      <div>
        <span class="eyebrow">Estado general</span>
        <h2>{{ statusTitle }}</h2>
        <p>{{ statusCopy }}</p>
      </div>
      <div class="command-metrics">
        <strong>{{ summary.critical_open || 0 }}</strong>
        <span>críticas abiertas</span>
      </div>
      <div class="command-metrics">
        <strong>{{ summary.open_alarms || 0 }}</strong>
        <span>alarmas activas</span>
      </div>
    </section>

    <section class="quick-actions" aria-label="Acciones rápidas">
      <RouterLink to="/sensors">
        <PlusCircle :size="20" />
        <span><strong>Registrar infraestructura</strong><small>Agregar una sede, zona o sensor</small></span>
      </RouterLink>
      <RouterLink to="/areas">
        <Thermometer :size="20" />
        <span><strong>Consultar áreas</strong><small>Revisar rangos y tendencias</small></span>
      </RouterLink>
      <RouterLink to="/alarms">
        <Siren :size="20" />
        <span><strong>Gestionar alarmas</strong><small>Atender y documentar eventos</small></span>
      </RouterLink>
      <RouterLink to="/reports">
        <FileDown :size="20" />
        <span><strong>Generar reporte</strong><small>Exportar evidencia de monitoreo</small></span>
      </RouterLink>
      <button type="button" class="qa-sim-btn" @click="openSimModal">
        <FlaskConical :size="20" />
        <span><strong>Simulación</strong><small>Enviar alerta de prueba por correo</small></span>
      </button>
    </section>

    <!-- Modal simulación -->
    <Teleport to="body">
      <div v-if="simModal" class="modal-overlay" @click.self="simModal = false">
        <div class="modal-box sim-modal">
          <div class="modal-header">
            <h3>Enviar alerta de simulación</h3>
            <button type="button" @click="simModal = false">✕</button>
          </div>
          <div class="modal-body">
            <p class="muted" style="margin-bottom:16px">
              Selecciona el sensor y el nivel. El sistema enviará una alerta de prueba (marcada como simulación) a todos los contactos registrados suscritos a ese nivel, o a uno específico si lo eliges.
            </p>
            <label class="field">
              <span>Contacto a notificar</span>
              <select v-model="sim.contact_id">
                <option value="all">📢 Todos los contactos registrados</option>
                <option v-for="c in simContacts" :key="c.id" :value="c.id">
                  {{ c.name }}{{ c.cargo ? ` — ${c.cargo}` : '' }} &lt;{{ c.email }}&gt;
                </option>
              </select>
            </label>
            <label class="field" style="margin-top:12px">
              <span>Sensor / Área a simular</span>
              <select v-model="sim.sensor_id">
                <option value="">— Selecciona un sensor —</option>
                <option v-for="s in simSensors" :key="s.id" :value="s.id">
                  {{ s.code }} — {{ s.name }} ({{ s.site_name || 'sin sede' }})
                </option>
              </select>
            </label>
            <label class="field" style="margin-top:12px">
              <span>Nivel de alarma a simular</span>
              <select v-model="sim.level">
                <option value="critica">🔴 Crítica</option>
                <option value="advertencia">🟡 Advertencia</option>
                <option value="informativa">🔵 Informativa</option>
              </select>
            </label>
            <p v-if="simError" class="error" style="margin-top:12px">{{ simError }}</p>
            <p v-if="simSuccess" class="sim-ok" style="margin-top:12px">✓ {{ simSuccess }}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="secondary" @click="simModal = false">Cancelar</button>
            <button type="button" class="primary" :disabled="simLoading" @click="sendSimulation">
              {{ simLoading ? 'Enviando...' : 'Enviar simulación' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <section class="grid stats dashboard-stats">
      <StatCard label="Sensores activos" :value="summary.active_sensors" hint="Operativos" tone="normal" />
      <StatCard label="Sensores en alerta" :value="summary.alert_sensors" hint="Con alarmas activas" tone="warning" />
      <StatCard label="Lecturas del día" :value="summary.today_readings" hint="Registros hoy" />
      <StatCard label="Críticas abiertas" :value="summary.critical_open" hint="Requieren atención" tone="critical" />
      <StatCard label="Estado general" :value="summary.system_status" hint="Semáforo operacional" :tone="summary.system_status" />
      <StatCard label="Última lectura" :value="summary.last_reading?.sensor_code || summary.last_reading?.sensor_name" :hint="lastHint" />
    </section>

    <section class="operations-grid">
      <article class="panel operations-panel">
        <div class="panel-heading">
          <div>
            <h2>Cola priorizada de atención</h2>
            <p class="muted">Ordenada por criticidad y tiempo transcurrido.</p>
          </div>
          <RouterLink class="secondary" to="/alarms">Gestionar</RouterLink>
        </div>
        <div class="operation-list">
          <RouterLink
            v-for="alarm in operations.alarmQueue"
            :key="alarm.id"
            to="/alarms"
            class="operation-row"
            :class="[alarm.level, { overdue: alarm.sla_status === 'vencida' }]"
          >
            <span class="operation-icon"><CircleAlert :size="18" /></span>
            <span class="operation-copy">
              <strong>{{ alarm.sensor_code }} · {{ alarm.area }}</strong>
              <small>{{ alarm.site_name }} · {{ alarm.description }}</small>
            </span>
            <span class="operation-meta">
              <StatusBadge :status="alarm.level" />
              <small><Clock3 :size="13" /> {{ elapsed(alarm.age_minutes) }}</small>
            </span>
          </RouterLink>
          <p v-if="!operations.alarmQueue.length" class="empty-state">No hay alarmas pendientes. La operación está al día.</p>
        </div>
      </article>

      <article class="panel health-panel">
        <div class="panel-heading">
          <div>
            <h2>Salud de dispositivos</h2>
            <p class="muted">Comunicación, energía y batería.</p>
          </div>
          <RouterLink class="secondary" to="/monitoring">Ver mapa</RouterLink>
        </div>
        <div class="health-summary">
          <div><strong>{{ operations.indicators.overdue_alarms || 0 }}</strong><span>alarmas vencidas</span></div>
          <div><strong>{{ operations.indicators.alarms_in_progress || 0 }}</strong><span>en atención</span></div>
          <div><strong>{{ resolutionLabel }}</strong><span>resolución promedio</span></div>
        </div>
        <div class="device-health-list">
          <RouterLink v-for="device in riskyDevices" :key="device.id" :to="`/sensors/${device.id}`" class="device-health-row">
            <span class="device-health-icon" :class="deviceRisk(device)">
              <WifiOff v-if="device.status === 'desconectado' || isSilent(device)" :size="17" />
              <BatteryLow v-else-if="Number(device.battery_level) < 25" :size="17" />
              <Activity v-else :size="17" />
            </span>
            <span><strong>{{ device.code }} · {{ device.name }}</strong><small>{{ deviceHealthMessage(device) }}</small></span>
            <StatusBadge :status="deviceRisk(device)" />
          </RouterLink>
          <p v-if="!riskyDevices.length" class="empty-state">Todos los dispositivos reportan condiciones saludables.</p>
        </div>
      </article>
    </section>

    <section class="grid chart-grid" style="margin-top:16px">
      <article class="panel environmental-chart">
        <div class="panel-heading">
          <div><h2>Temperatura y humedad</h2><p class="muted">Comparación de las últimas lecturas.</p></div>
        </div>
        <div class="dashboard-chart-canvas">
          <Line :data="environmentChart" :options="environmentChartOptions" />
        </div>
      </article>
      <article class="panel alarm-chart-panel">
        <div class="panel-heading">
          <div><h2>Alarmas por criticidad</h2><p class="muted">Cantidad de eventos registrados por nivel.</p></div>
        </div>
        <div class="dashboard-chart-canvas">
          <Bar :data="alarmChart" :options="alarmChartOptions" />
        </div>
      </article>
      <article class="panel compliance-chart-panel">
        <div class="panel-heading">
          <div><h2>Cumplimiento por área</h2><p class="muted">Porcentaje de lecturas dentro del rango.</p></div>
        </div>
        <div class="dashboard-chart-canvas">
          <Bar :data="complianceChart" :options="complianceChartOptions" />
        </div>
      </article>
    </section>

    <section class="grid two-col" style="margin-top:16px">
      <article class="panel">
        <div class="panel-heading">
          <h2>Lecturas recientes</h2>
          <RouterLink class="secondary" to="/readings">Ver todo</RouterLink>
        </div>
        <div class="timeline">
          <div v-for="reading in latestReadings" :key="reading.id" class="timeline-row" :class="reading.calculated_status">
            <span class="dot"></span>
            <div>
              <strong>{{ reading.sensor_code || reading.code }} · {{ reading.temperature }} °C</strong>
              <small>{{ reading.humidity }} % HR · {{ new Date(reading.created_at).toLocaleString() }}</small>
            </div>
            <span class="mini-status">{{ humanize(reading.calculated_status) }}</span>
          </div>
        </div>
      </article>

      <article class="panel">
        <div class="panel-heading">
          <div>
            <h2>Estado por sede</h2>
            <p class="muted">Disponibilidad y equipos que requieren seguimiento.</p>
          </div>
          <RouterLink class="secondary" to="/monitoring">Centro de monitoreo</RouterLink>
        </div>
        <div class="site-health-list">
          <RouterLink v-for="site in operations.siteHealth" :key="site.id" to="/monitoring" class="site-health-row">
            <div class="site-health-copy">
              <strong>{{ site.name }}</strong>
              <small><MapPin :size="13" /> {{ site.city }} · {{ site.total_sensors }} equipos</small>
            </div>
            <div class="availability-track" :title="`${site.availability || 0}% disponible`">
              <span :style="{ width: `${site.availability || 0}%` }"></span>
            </div>
            <div class="site-health-meta">
              <strong>{{ site.availability || 0 }}%</strong>
              <small>{{ site.alert_sensors || 0 }} en alerta</small>
            </div>
          </RouterLink>
        </div>
      </article>
    </section>
    </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Line, Bar } from 'vue-chartjs';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend } from 'chart.js';
import {
  Activity, BatteryLow, CircleAlert, Clock3, FileDown, FlaskConical, MapPin,
  Pause, Play, PlusCircle, RefreshCw, Siren, Thermometer, WifiOff
} from '@lucide/vue';
import AppLayout from '../layouts/AppLayout.vue';
import AsyncState from '../components/AsyncState.vue';
import StatCard from '../components/StatCard.vue';
import StatusBadge from '../components/StatusBadge.vue';
import api from '../services/api';
import { humanize } from '../utils/labels';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

type ReadingPoint = {
  id?: number;
  code?: string;
  sensor_code?: string;
  sensor_name?: string;
  temperature?: number | string;
  humidity?: number | string;
  calculated_status?: string;
  created_at: string;
};

type DashboardSummary = {
  active_sensors?: number;
  disconnected_sensors?: number;
  total_sensors?: number;
  today_readings?: number;
  open_alarms?: number;
  alert_sensors?: number;
  critical_open?: number;
  system_status?: string;
  last_reading?: ReadingPoint;
};

type ChartsPayload = {
  temperature: ReadingPoint[];
  humidity: ReadingPoint[];
  alarmsByLevel: Array<{ level: string; total: number }>;
  complianceByArea: Array<{ area: string; compliance: number }>;
};

type OperationsPayload = {
  alarmQueue: any[];
  deviceHealth: any[];
  siteHealth: any[];
  indicators: {
    overdue_alarms?: number;
    avg_resolution_minutes?: number;
    alarms_in_progress?: number;
  };
};

const summary = ref<DashboardSummary>({});
const charts = ref<ChartsPayload>({ temperature: [], humidity: [], alarmsByLevel: [], complianceByArea: [] });
const operations = ref<OperationsPayload>({ alarmQueue: [], deviceHealth: [], siteHealth: [], indicators: {} });
const loading = ref(true);
const loadError = ref('');
const refreshing = ref(false);
const autoRefresh = ref(true);
const lastUpdatedAt = ref<Date | null>(null);
let timer: ReturnType<typeof setInterval> | undefined;

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { intersect: false, mode: 'index' as const }
  },
  scales: {
    x: {
      ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6, font: { size: 10 } },
      grid: { display: false }
    },
    y: {
      ticks: { maxTicksLimit: 5, font: { size: 10 } },
      grid: { color: '#edf3f7' }
    }
  }
};
const lastHint = computed(() => summary.value.last_reading ? `${summary.value.last_reading.temperature} °C / ${summary.value.last_reading.humidity} % HR` : 'Sin registros');
const latestReadings = computed(() => [...(charts.value.temperature || [])].slice(0, 6));
const riskyDevices = computed(() => operations.value.deviceHealth
  .filter((device) => device.status === 'desconectado' || device.power_status !== 'normal' ||
    Number(device.battery_level) < 25 || isSilent(device))
  .slice(0, 6));
const lastUpdatedLabel = computed(() => lastUpdatedAt.value
  ? lastUpdatedAt.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  : 'Pendiente');
const resolutionLabel = computed(() => {
  const minutes = Number(operations.value.indicators.avg_resolution_minutes || 0);
  if (!minutes) return 'N/D';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
});
const statusTitle = computed(() => {
  if (summary.value.system_status === 'critico') return 'Intervención requerida';
  if (summary.value.system_status === 'advertencia') return 'Seguimiento preventivo';
  return 'Operación estable';
});
const statusCopy = computed(() => {
  if (summary.value.system_status === 'critico') return 'Hay sensores con valores fuera del rango permitido. Prioriza alarmas críticas y registra acciones correctivas.';
  if (summary.value.system_status === 'advertencia') return 'Existen valores cercanos al límite. Mantén vigilancia y verifica tendencia.';
  return 'Los espacios controlados se mantienen dentro de rangos configurados.';
});

const environmentChart = computed(() => {
  const rows = [...(charts.value.temperature || [])].reverse().slice(-30);
  return {
    labels: rows.map((row) => `${row.code || row.sensor_code || ''} ${new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`),
    datasets: [
      {
        label: 'Temperatura (°C)',
        data: rows.map((row) => Number(row.temperature)),
        borderColor: '#be2e35',
        backgroundColor: '#be2e35',
        yAxisID: 'temperature',
        pointRadius: rows.length > 20 ? 1 : 3,
        tension: 0.3
      },
      {
        label: 'Humedad (% HR)',
        data: rows.map((row) => Number(row.humidity)),
        borderColor: '#1268ad',
        backgroundColor: '#1268ad',
        yAxisID: 'humidity',
        pointRadius: rows.length > 20 ? 1 : 3,
        tension: 0.3
      }
    ]
  };
});
const environmentChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { intersect: false, mode: 'index' as const },
  plugins: {
    legend: {
      display: true,
      position: 'bottom' as const,
      labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } }
    }
  },
  scales: {
    x: {
      ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6, font: { size: 10 } },
      grid: { display: false }
    },
    temperature: {
      type: 'linear' as const,
      position: 'left' as const,
      title: { display: true, text: '°C' },
      ticks: { maxTicksLimit: 6 },
      grid: { color: '#edf3f7' }
    },
    humidity: {
      type: 'linear' as const,
      position: 'right' as const,
      min: 0,
      max: 100,
      title: { display: true, text: '% HR' },
      ticks: { maxTicksLimit: 6 },
      grid: { drawOnChartArea: false }
    }
  }
};
const alarmChart = computed(() => ({
  labels: (charts.value.alarmsByLevel || []).map((r) => humanize(r.level)),
  datasets: [{
    data: (charts.value.alarmsByLevel || []).map((r) => Number(r.total)),
    backgroundColor: (charts.value.alarmsByLevel || []).map((r) => ({
      informativa: '#7b8794',
      advertencia: '#b98105',
      critica: '#be2e35'
    }[r.level] || '#1268ad')),
    borderRadius: 5,
    maxBarThickness: 38
  }]
}));
const alarmChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y' as const,
  layout: { padding: { right: 12, bottom: 8 } },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (context: any) => `${context.raw} ${Number(context.raw) === 1 ? 'alarma' : 'alarmas'}`
      }
    }
  },
  scales: {
    x: {
      beginAtZero: true,
      ticks: { precision: 0, stepSize: 1, maxTicksLimit: 5 },
      grid: { color: '#edf3f7' }
    },
    y: {
      ticks: { font: { size: 11, weight: 700 as const }, padding: 8 },
      grid: { display: false }
    }
  }
};
const complianceChart = computed(() => ({
  labels: (charts.value.complianceByArea || []).map((r) => r.area),
  datasets: [{
    data: (charts.value.complianceByArea || []).map((r) => Number(r.compliance || 0)),
    backgroundColor: '#168a55',
    borderRadius: 5,
    maxBarThickness: 24
  }]
}));
const complianceChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y' as const,
  layout: { padding: { right: 10, bottom: 4 } },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (context: any) => `${Number(context.raw).toFixed(1)} % de cumplimiento`
      }
    }
  },
  scales: {
    x: {
      beginAtZero: true,
      min: 0,
      max: 100,
      ticks: { stepSize: 25, callback: (value: string | number) => `${value}%` },
      grid: { color: '#edf3f7' }
    },
    y: {
      ticks: { autoSkip: false, font: { size: 10, weight: 700 as const }, padding: 6 },
      grid: { display: false }
    }
  }
};

const elapsed = (minutes: number) => {
  const value = Number(minutes || 0);
  if (value < 60) return `${value} min`;
  if (value < 1440) return `${Math.floor(value / 60)} h ${value % 60} min`;
  return `${Math.floor(value / 1440)} d`;
};
const isSilent = (device: any) => Number(device.silent_minutes) > Math.max(Number(device.reading_frequency || 5) * 3, 20);
function deviceRisk(device: any) {
  if (device.status === 'desconectado' || isSilent(device) || device.power_status === 'offline') return 'critico';
  if (device.power_status === 'battery' || Number(device.battery_level) < 25 || Number(device.open_alarms) > 0) return 'advertencia';
  return 'normal';
}
function deviceHealthMessage(device: any) {
  if (device.status === 'desconectado') return `${device.site_name} · Marcado como desconectado`;
  if (isSilent(device)) return `${device.site_name} · Sin reportar hace ${elapsed(device.silent_minutes)}`;
  if (device.power_status === 'battery') return `${device.site_name} · Operando con batería`;
  if (Number(device.battery_level) < 25) return `${device.site_name} · Batería al ${device.battery_level}%`;
  return `${device.site_name} · ${device.open_alarms} alarmas activas`;
}
function toggleAutoRefresh() {
  autoRefresh.value = !autoRefresh.value;
}

async function load(showLoading = false) {
  if (showLoading) loading.value = true;
  refreshing.value = true;
  try {
    const [summaryResponse, chartsResponse, operationsResponse] = await Promise.all([
      api.get('/dashboard/summary'),
      api.get('/dashboard/charts'),
      api.get('/dashboard/operations')
    ]);
    summary.value = summaryResponse.data.data;
    charts.value = chartsResponse.data.data;
    operations.value = operationsResponse.data.data;
    lastUpdatedAt.value = new Date();
    loadError.value = '';
  } catch (error: any) {
    if (error?.response?.status === 401 || error?.code === 'ERR_CANCELED') {
      autoRefresh.value = false;
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
      return;
    }
    if (!summary.value.total_sensors) {
      loadError.value = 'Verifique que la API y la base de datos estén disponibles.';
    }
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

// --- Simulation modal ---
const simModal = ref(false);
const simLoading = ref(false);
const simError = ref('');
const simSuccess = ref('');
const simContacts = ref<any[]>([]);
const simSensors = ref<any[]>([]);
const sim = ref({ contact_id: 'all', sensor_id: '', level: 'critica' });

async function loadSimData() {
  try {
    const [cRes, sRes] = await Promise.all([
      api.get('/monitoring/contacts'),
      api.get('/sensors')
    ]);
    simContacts.value = (cRes.data.data ?? []).filter((c: any) => c.email && c.status === 'active');
    simSensors.value = sRes.data.data ?? [];
  } catch {}
}

async function sendSimulation() {
  simError.value = '';
  simSuccess.value = '';
  if (!sim.value.sensor_id) {
    simError.value = 'Debes seleccionar un sensor.';
    return;
  }
  simLoading.value = true;
  try {
    const { data } = await api.post('/monitoring/simulate-alert', {
      contact_id: sim.value.contact_id,
      sensor_id: sim.value.sensor_id,
      level: sim.value.level
    });
    simSuccess.value = data.message;
    sim.value = { contact_id: 'all', sensor_id: '', level: 'critica' };
  } catch (err: any) {
    simError.value = err.response?.data?.message || 'No fue posible enviar la simulación.';
  } finally {
    simLoading.value = false;
  }
}

// open modal → load contacts & sensors lazily
function openSimModal() {
  simModal.value = true;
  simError.value = '';
  simSuccess.value = '';
  if (!simContacts.value.length) loadSimData();
}

onMounted(() => {
  load(true);
  timer = setInterval(() => {
    if (autoRefresh.value) load(false);
  }, 15000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>
