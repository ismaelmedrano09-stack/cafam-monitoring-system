<template>
  <AppLayout title="Usuarios">
    <article class="panel table-wrap">
      <table><thead><tr><th>Nombre</th><th>Correo electrónico</th><th>Rol</th><th>Estado</th></tr></thead>
        <tbody><tr v-for="u in rows" :key="u.id"><td>{{ u.name }}</td><td>{{ u.email }}</td><td>{{ humanize(u.role) }}</td><td><StatusBadge :status="u.status" /></td></tr></tbody>
      </table>
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
onMounted(async () => { rows.value = (await api.get('/users')).data.data; });
</script>
