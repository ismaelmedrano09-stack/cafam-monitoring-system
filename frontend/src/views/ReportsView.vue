<template>
  <AppLayout title="Reportes">
    <section class="reports-hero">
      <div>
        <span class="eyebrow">Evidencia operativa</span>
        <h2>Reportes clínicos listos para auditoría</h2>
        <p>
          Exporta informes diarios, semanales, mensuales y expedientes de auditoría con lecturas,
          alarmas, cumplimiento por área y acciones correctivas.
        </p>
      </div>
      <div class="reports-hero-kpis">
        <div>
          <strong>{{ extrema.length }}</strong>
          <span>dispositivos</span>
        </div>
        <div>
          <strong>{{ averageCompliance }}</strong>
          <span>cumplimiento</span>
        </div>
      </div>
    </section>

    <section class="report-cards">
      <article v-for="type in types" :key="type.key" class="report-card">
        <div class="report-card-icon">
          <component :is="type.icon" :size="21" />
        </div>
        <div>
          <h2>{{ type.label }}</h2>
          <p>{{ type.description }}</p>
          <small>{{ type.range }}</small>
        </div>
        <div class="report-card-actions">
          <button class="primary" :disabled="downloading === `${type.key}-pdf`" @click="download(type.key, 'pdf')">
            <FileText :size="16" />
            {{ downloading === `${type.key}-pdf` ? 'Generando...' : 'PDF ejecutivo' }}
          </button>
          <button class="secondary" :disabled="downloading === `${type.key}-excel`" @click="download(type.key, 'excel')">
            <Table2 :size="16" />
            {{ downloading === `${type.key}-excel` ? 'Generando...' : 'Excel técnico' }}
          </button>
        </div>
      </article>
    </section>

    <section class="reports-layout">
      <article class="panel">
        <div class="panel-heading">
          <div>
            <h2>Máximos, mínimos y cumplimiento</h2>
            <p class="muted">Vista previa de los datos que alimentan los reportes.</p>
          </div>
          <select v-model="days" class="compact-select" @change="loadExtrema">
            <option :value="1">Último día</option>
            <option :value="7">Últimos 7 días</option>
            <option :value="30">Últimos 30 días</option>
          </select>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Sede</th>
                <th>Temperatura</th>
                <th>Humedad</th>
                <th>Cumplimiento</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in extrema" :key="row.id">
                <td><strong>{{ row.code }}</strong><br><small>{{ row.name }}</small></td>
                <td>{{ row.site_name || 'Sin sede' }}</td>
                <td>{{ metric(row.temp_min, ' °C') }} - {{ metric(row.temp_max, ' °C') }}</td>
                <td>{{ metric(row.humidity_min, ' %') }} - {{ metric(row.humidity_max, ' %') }}</td>
                <td>
                  <div class="compliance-cell">
                    <span>{{ metric(row.compliance, ' %') }}</span>
                    <i><b :style="{ width: `${Math.min(Number(row.compliance || 0), 100)}%` }"></b></i>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <aside class="panel report-guide">
        <h2>Qué incluye cada archivo</h2>
        <ul>
          <li><strong>Resumen ejecutivo:</strong> lecturas, cumplimiento, alarmas y acciones.</li>
          <li><strong>Gráfica en PDF:</strong> barras de cumplimiento y distribución de alarmas.</li>
          <li><strong>Excel técnico:</strong> hojas separadas para áreas, dispositivos, alarmas, lecturas y acciones.</li>
          <li><strong>Auditoría:</strong> evidencia trazable para revisiones internas o externas.</li>
        </ul>
        <p v-if="error" class="error">{{ error }}</p>
      </aside>
    </section>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { CalendarDays, ClipboardCheck, FileClock, FileText, Table2 } from '@lucide/vue';
import AppLayout from '../layouts/AppLayout.vue';
import api from '../services/api';
import { isDemoMode } from '../services/mockApi';

type ReportFormat = 'pdf' | 'excel';
type ReportType = 'daily' | 'weekly' | 'monthly' | 'audit-dossier';

const days = ref(30);
const extrema = ref<any[]>([]);
const downloading = ref('');
const error = ref('');

const types = [
  {
    key: 'daily' as ReportType,
    label: 'Reporte diario',
    range: 'Operación del día',
    description: 'Ideal para cierres de turno y validación diaria de cadena de frío.',
    icon: CalendarDays
  },
  {
    key: 'weekly' as ReportType,
    label: 'Reporte semanal',
    range: 'Últimos 7 días',
    description: 'Resume tendencias, alarmas recurrentes y cumplimiento por área.',
    icon: FileClock
  },
  {
    key: 'monthly' as ReportType,
    label: 'Reporte mensual',
    range: 'Último mes',
    description: 'Documento ejecutivo para comités, calidad y seguimiento operativo.',
    icon: FileText
  },
  {
    key: 'audit-dossier' as ReportType,
    label: 'Expediente de auditoría',
    range: 'Último mes',
    description: 'Paquete detallado con evidencia técnica, alarmas y acciones correctivas.',
    icon: ClipboardCheck
  }
];

const averageCompliance = computed(() => {
  const values = extrema.value.map((row) => Number(row.compliance)).filter((value) => !Number.isNaN(value));
  if (!values.length) return '0 %';
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return `${avg.toFixed(1)} %`;
});

async function download(type: ReportType, format: ReportFormat) {
  downloading.value = `${type}-${format}`;
  error.value = '';
  try {
    const { data } = await api.get(`/reports/${type}/${format}`, { responseType: 'blob' });
    const demo = isDemoMode();
    const ext = demo ? (format === 'pdf' ? 'html' : 'csv') : (format === 'pdf' ? 'pdf' : 'xlsx');
    const stamp = new Date().toISOString().slice(0, 19).replace('T', '_').replaceAll(':', '-');
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cafam-${type}-${stamp}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    error.value = 'No fue posible generar el reporte. Verifica que la API y la base de datos estén activas.';
  } finally {
    downloading.value = '';
  }
}

function metric(value: unknown, suffix: string) {
  return value === null || value === undefined ? 'Sin datos' : `${value}${suffix}`;
}

async function loadExtrema() {
  try {
    const { data } = await api.get('/monitoring/extrema', { params: { days: days.value } });
    extrema.value = data.data.rows;
  } catch {
    error.value = 'No fue posible cargar el resumen de dispositivos.';
  }
}

onMounted(loadExtrema);
</script>
