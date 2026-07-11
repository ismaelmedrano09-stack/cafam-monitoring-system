<template>
  <AppLayout title="Auditoría">
    <article class="panel table-wrap">
      <table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Descripción</th></tr></thead>
        <tbody><tr v-for="r in rows" :key="r.id"><td>{{ format(r.created_at) }}</td><td>{{ r.user_name || 'Sistema' }}</td><td>{{ humanize(r.action) }}</td><td>{{ humanize(r.entity) }}</td><td>{{ r.description }}</td></tr></tbody>
      </table>
    </article>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AppLayout from '../layouts/AppLayout.vue';
import api from '../services/api';
import { humanize } from '../utils/labels';
const rows = ref([]);
const format = (value) => value ? new Date(value).toLocaleString() : '';
onMounted(async () => { rows.value = (await api.get('/audit-logs')).data.data; });
</script>
