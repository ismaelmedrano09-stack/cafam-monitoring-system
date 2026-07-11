<template>
  <AppLayout title="Alarmas y acciones correctivas">
    <div class="view-tabs" role="tablist" aria-label="Vistas de alarmas y acciones">
      <button :class="{ active: activeTab === 'alarms' }" @click="activeTab = 'alarms'">
        Alarmas
        <span>{{ activeAlarmCount }}</span>
      </button>
      <button :class="{ active: activeTab === 'actions' }" @click="activeTab = 'actions'">
        Historial de acciones
        <span>{{ correctiveActions.length }}</span>
      </button>
    </div>

    <section v-if="activeTab === 'alarms'" class="grid two-col">
      <article class="panel">
        <div class="alarm-summary-strip">
          <div><strong>{{ criticalCount }}</strong><span>críticas activas</span></div>
          <div class="warning"><strong>{{ overdueCount }}</strong><span>fuera del tiempo objetivo</span></div>
          <div><strong>{{ inProgressCount }}</strong><span>en atención</span></div>
        </div>
        <div class="toolbar">
          <select v-model="filters.status" @change="load"><option value="">Todos los estados</option><option value="abierta">Abierta</option><option value="en_atencion">En atención</option><option value="cerrada">Cerrada</option></select>
          <select v-model="filters.level" @change="load"><option value="">Todos los niveles</option><option value="informativa">Informativa</option><option value="advertencia">Advertencia</option><option value="critica">Crítica</option></select>
          <button class="secondary" @click="load">Actualizar</button>
          <button class="secondary" :disabled="exporting" @click="exportAlarms('pdf')">PDF</button>
          <button class="secondary" :disabled="exporting" @click="exportAlarms('excel')">Excel</button>
        </div>
        <div class="table-wrap">
          <table><thead><tr><th>Inicio</th><th>Sensor</th><th>Nivel</th><th>Estado</th><th>Tiempo</th><th>Descripción</th><th></th></tr></thead>
            <tbody>
              <tr v-for="alarm in alarms" :key="alarm.id" :class="{ 'selected-row': selected?.id === alarm.id, 'overdue-row': alarm.sla_status === 'vencida' }" @click="selected = alarm">
                <td>{{ format(alarm.started_at) }}</td><td>{{ alarm.sensor_code }}</td><td><StatusBadge :status="alarm.level" /></td><td><StatusBadge :status="alarm.status" /></td>
                <td><span class="sla-time" :class="{ overdue: alarm.sla_status === 'vencida' }">{{ elapsed(alarm.age_minutes) }}</span></td>
                <td>{{ alarm.description }}</td>
                <td class="actions"><button class="ghost" :disabled="alarm.status !== 'abierta'" @click.stop="attend(alarm)">Atender</button><button class="secondary danger" :disabled="alarm.status === 'cerrada'" @click.stop="close(alarm)">Cerrar</button></td>
              </tr>
            </tbody>
          </table>
          <p v-if="!alarms.length" class="empty-state">No hay alarmas para los filtros seleccionados.</p>
        </div>
        <div v-if="pagination.pages > 1" class="pagination-bar">
          <button class="secondary" :disabled="pagination.page <= 1" @click="goToPage(pagination.page - 1)">← Anterior</button>
          <span class="pagination-info">Página {{ pagination.page }} de {{ pagination.pages }} · {{ pagination.total }} registros</span>
          <button class="secondary" :disabled="pagination.page >= pagination.pages" @click="goToPage(pagination.page + 1)">Siguiente →</button>
        </div>
      </article>
      <form class="panel form-grid corrective-form" @submit.prevent="createAction">
        <div>
          <h2>Acción correctiva</h2>
          <p class="muted">{{ selected ? `Alarma #${selected.id} · ${selected.sensor_code}` : 'Seleccione una alarma para registrar la acción.' }}</p>
        </div>
        <label class="field"><span>Acción realizada</span><textarea v-model="action.action_taken" required /></label>
        <label class="field"><span>Evidencia textual</span><textarea v-model="action.evidence" /></label>
        <label class="field"><span>Observaciones</span><textarea v-model="action.observations" /></label>
        <label class="field"><span>Estado final</span><input v-model="action.final_status" /></label>
        <button class="primary" :disabled="!selected">Registrar acción</button>
      </form>
    </section>

    <article v-else class="panel">
      <div class="panel-heading">
        <div>
          <h2>Historial de acciones correctivas</h2>
          <p class="muted">Seguimiento consolidado de las acciones registradas para las alarmas.</p>
        </div>
        <button class="secondary" @click="load">Actualizar</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Fecha</th><th>Sensor</th><th>Responsable</th><th>Acción realizada</th><th>Estado final</th></tr></thead>
          <tbody>
            <tr v-for="item in correctiveActions" :key="item.id">
              <td>{{ format(item.created_at) }}</td>
              <td>{{ item.sensor_code }}</td>
              <td>{{ item.user_name }}</td>
              <td>{{ item.action_taken }}</td>
              <td>{{ item.final_status || 'Sin estado final' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!correctiveActions.length" class="empty-state">No hay acciones correctivas registradas.</p>
      </div>
    </article>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import AppLayout from '../layouts/AppLayout.vue';
import StatusBadge from '../components/StatusBadge.vue';
import api from '../services/api';
import { isDemoMode } from '../services/mockApi';
import { useToastStore } from '../stores/toast';
const alarms = ref([]);
const correctiveActions = ref([]);
const selected = ref(null);
const activeTab = ref<'alarms' | 'actions'>('alarms');
const filters = ref({ status: '', level: '' });
const pagination = ref({ page: 1, limit: 20, total: 0, pages: 1 });
const action = ref({ action_taken: '', evidence: '', observations: '', final_status: 'Controlado' });
const toast = useToastStore();
const exporting = ref(false);
const activeAlarmCount = computed(() => alarms.value.filter((alarm: any) => alarm.status !== 'cerrada').length);
const criticalCount = computed(() => alarms.value.filter((alarm: any) => alarm.level === 'critica' && alarm.status !== 'cerrada').length);
const overdueCount = computed(() => alarms.value.filter((alarm: any) => alarm.sla_status === 'vencida').length);
const inProgressCount = computed(() => alarms.value.filter((alarm: any) => alarm.status === 'en_atencion').length);
const format = (value) => value ? new Date(value).toLocaleString() : '';
const elapsed = (minutes: number) => {
  const value = Number(minutes || 0);
  if (value < 60) return `${value} min`;
  if (value < 1440) return `${Math.floor(value / 60)} h`;
  return `${Math.floor(value / 1440)} d`;
};
async function load() {
  const [alarmsResponse, actionsResponse] = await Promise.all([
    api.get('/alarms', { params: { ...filters.value, page: pagination.value.page, limit: pagination.value.limit } }),
    api.get('/corrective-actions')
  ]);
  alarms.value = alarmsResponse.data.data;
  if (alarmsResponse.data.meta) {
    pagination.value.total = alarmsResponse.data.meta.total;
    pagination.value.pages = alarmsResponse.data.meta.pages;
  }
  correctiveActions.value = actionsResponse.data.data;
}
function goToPage(p: number) {
  if (p < 1 || p > pagination.value.pages) return;
  pagination.value.page = p;
  load();
}
async function attend(alarm) {
  try {
    await api.patch(`/alarms/${alarm.id}/attend`, {});
    toast.show('Alarma marcada en atención.');
    await load();
  } catch (error: any) {
    toast.show(error.response?.data?.message || 'No fue posible atender la alarma.', 'error');
  }
}
async function close(alarm) {
  try {
    await api.patch(`/alarms/${alarm.id}/close`, {});
    toast.show('Alarma cerrada correctamente.');
    await load();
  } catch (error: any) {
    toast.show(error.response?.data?.message || 'Registre una acción correctiva antes de cerrar la alarma.', 'error');
  }
}
async function exportAlarms(format: 'pdf' | 'excel') {
  exporting.value = true;
  try {
    const demo = isDemoMode();
    const ext = demo ? (format === 'pdf' ? 'html' : 'csv') : (format === 'pdf' ? 'pdf' : 'xlsx');
    const stamp = new Date().toISOString().slice(0, 19).replace('T', '_').replaceAll(':', '-');
    const response = await api.get(`/reports/alarms/${format}`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `cafam-alarmas-${stamp}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.show('No fue posible generar el reporte. Verifique la conexión.', 'error');
  } finally {
    exporting.value = false;
  }
}
async function createAction() {
  try {
    await api.post('/corrective-actions', { ...action.value, alarm_id: selected.value.id, sensor_id: selected.value.sensor_id });
    action.value = { action_taken: '', evidence: '', observations: '', final_status: 'Controlado' };
    activeTab.value = 'actions';
    toast.show('Acción correctiva registrada.');
    await load();
  } catch (error: any) {
    toast.show(error.response?.data?.message || 'No fue posible registrar la acción.', 'error');
  }
}
let refreshTimer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  load();
  refreshTimer = setInterval(load, 30000);
});
onUnmounted(() => { if (refreshTimer) clearInterval(refreshTimer); });
</script>
