<template>
  <AppLayout title="Detalle de sensor">
    <section v-if="payload.sensor" class="grid">
      <article class="panel">
        <h2>{{ payload.sensor.code }} - {{ payload.sensor.name }}</h2>
        <p>{{ payload.sensor.area }} · {{ payload.sensor.location }}</p>
        <StatusBadge :status="payload.sensor.status" />
        <div class="sensor-meta-grid">
          <div><span>Sede</span><strong>{{ payload.sensor.site_name || 'Sin sede' }}</strong></div>
          <div><span>Tecnología</span><strong>{{ payload.sensor.technology || 'No disponible' }}</strong></div>
          <div><span>Firmware</span><strong>{{ payload.sensor.firmware_version || 'No disponible' }}</strong></div>
          <div><span>Batería</span><strong>{{ payload.sensor.battery_level ?? 'No disponible' }}{{ payload.sensor.battery_level == null ? '' : ' %' }}</strong></div>
          <div><span>Última conexión</span><strong>{{ format(payload.sensor.last_seen_at) }}</strong></div>
        </div>
      </article>
      <article class="panel">
        <div class="panel-heading">
          <h2>Documentos del dispositivo</h2>
          <button class="secondary" @click="showFileForm = !showFileForm">Registrar documento</button>
        </div>
        <form v-if="showFileForm" class="inline-file-form" @submit.prevent="createFile">
          <input v-model="fileForm.name" placeholder="Nombre del documento" required />
          <select v-model="fileForm.category">
            <option value="calibration">Calibración</option>
            <option value="certificate">Certificado</option>
            <option value="manual">Manual</option>
            <option value="maintenance">Mantenimiento</option>
            <option value="other">Otro</option>
          </select>
          <input v-model="fileForm.file_url" placeholder="URL del archivo (opcional)" />
          <button class="primary">Guardar</button>
        </form>
        <div class="document-list">
          <a v-for="file in payload.files" :key="file.id" :href="file.file_url || undefined" :target="file.file_url ? '_blank' : undefined" class="document-row">
            <span class="document-icon">DOC</span>
            <span><strong>{{ file.name }}</strong><small>{{ humanize(file.category) }} · {{ format(file.created_at) }}</small></span>
          </a>
          <p v-if="!payload.files?.length" class="empty-state">No hay documentos asociados.</p>
        </div>
      </article>
      <article class="panel table-wrap">
        <h2>Histórico de lecturas</h2>
        <table><thead><tr><th>Fecha</th><th>Temperatura</th><th>Humedad</th><th>Estado</th></tr></thead>
          <tbody><tr v-for="r in payload.readings" :key="r.id"><td>{{ format(r.created_at) }}</td><td>{{ r.temperature }}</td><td>{{ r.humidity }}</td><td><StatusBadge :status="r.calculated_status" /></td></tr></tbody>
        </table>
      </article>
      <article class="panel table-wrap">
        <h2>Alarmas asociadas</h2>
        <table><thead><tr><th>Inicio</th><th>Nivel</th><th>Estado</th><th>Descripción</th></tr></thead>
          <tbody><tr v-for="a in payload.alarms" :key="a.id"><td>{{ format(a.started_at) }}</td><td><StatusBadge :status="a.level" /></td><td><StatusBadge :status="a.status" /></td><td>{{ a.description }}</td></tr></tbody>
        </table>
      </article>
    </section>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import AppLayout from '../layouts/AppLayout.vue';
import StatusBadge from '../components/StatusBadge.vue';
import api from '../services/api';
import { humanize } from '../utils/labels';
import { useToastStore } from '../stores/toast';

const route = useRoute();
const payload = ref<any>({ sensor: null, readings: [], alarms: [], files: [] });
const showFileForm = ref(false);
const fileForm = ref({ name: '', category: 'calibration', file_url: '' });
const toast = useToastStore();
const format = (value: string | null) => value ? new Date(value).toLocaleString() : 'Sin registro';
onMounted(async () => {
  const { data } = await api.get(`/sensors/${route.params.id}`);
  payload.value = data.data;
});
async function createFile() {
  try {
    await api.post('/monitoring/files', { ...fileForm.value, sensor_id: route.params.id });
    fileForm.value = { name: '', category: 'calibration', file_url: '' };
    showFileForm.value = false;
    toast.show('Documento asociado al sensor.');
    const { data } = await api.get(`/sensors/${route.params.id}`);
    payload.value = data.data;
  } catch (error: any) {
    toast.show(error.response?.data?.message || 'No fue posible registrar el documento.', 'error');
  }
}
</script>
