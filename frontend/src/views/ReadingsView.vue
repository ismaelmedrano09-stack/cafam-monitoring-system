<template>
  <AppLayout title="Lecturas">
    <article class="panel">
      <div class="toolbar">
        <select v-model="filters.status" @change="load"><option value="">Todos los estados</option><option value="normal">Normal</option><option value="advertencia">Advertencia</option><option value="critico">Crítico</option></select>
        <button class="secondary" @click="load">Actualizar</button>
      </div>
      <div class="table-wrap">
        <table><thead><tr><th>Fecha</th><th>Sensor</th><th>Área</th><th>Temperatura</th><th>Humedad</th><th>Fuente</th><th>Estado</th></tr></thead>
          <tbody><tr v-for="r in rows" :key="r.id"><td>{{ format(r.created_at) }}</td><td>{{ r.sensor_code }}</td><td>{{ r.area }}</td><td>{{ r.temperature }} °C</td><td>{{ r.humidity }} %</td><td>{{ humanize(r.source) }}</td><td><StatusBadge :status="r.calculated_status" /></td></tr></tbody>
        </table>
      </div>
    </article>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AppLayout from '../layouts/AppLayout.vue';
import StatusBadge from '../components/StatusBadge.vue';
import api from '../services/api';
import { humanize } from '../utils/labels';
const rows = ref([]);
const filters = ref({ status: '' });
const format = (value) => value ? new Date(value).toLocaleString() : '';
async function load() {
  const { data } = await api.get('/readings', { params: filters.value });
  rows.value = data.data;
}
onMounted(load);
</script>
