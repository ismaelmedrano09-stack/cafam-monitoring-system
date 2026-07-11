<template>
  <button class="global-search-trigger" type="button" title="Buscar en la plataforma" @click="open">
    <Search :size="18" />
    <span>Buscar</span>
    <kbd>Ctrl K</kbd>
  </button>

  <div v-if="visible" class="command-overlay" @click.self="close">
    <section class="command-dialog" role="dialog" aria-modal="true" aria-label="Búsqueda global">
      <div class="command-input">
        <Search :size="20" />
        <input ref="inputElement" v-model="query" placeholder="Buscar sensor, sede, área o módulo..." />
        <button class="icon-button" type="button" title="Cerrar búsqueda" @click="close"><X :size="18" /></button>
      </div>

      <div v-if="loading" class="command-message">Consultando infraestructura...</div>
      <div v-else class="command-results">
        <RouterLink v-for="result in results" :key="`${result.type}-${result.to}`" :to="result.to" @click="close">
          <component :is="result.icon" :size="19" />
          <span><strong>{{ result.title }}</strong><small>{{ result.subtitle }}</small></span>
          <ArrowRight :size="16" />
        </RouterLink>
        <p v-if="query.trim() && !results.length" class="command-message">No encontramos coincidencias.</p>
        <p v-else-if="!query.trim()" class="command-message">Escriba para encontrar cualquier sección o equipo.</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import {
  Activity, AlarmClock, ArrowRight, BarChart3, Building2,
  FileBarChart, Gauge, RadioTower, Search, ShieldCheck, X
} from '@lucide/vue';
import api from '../services/api';

type SearchResult = { type: string; title: string; subtitle: string; to: string; icon: any };

const visible = ref(false);
const loading = ref(false);
const loaded = ref(false);
const query = ref('');
const inputElement = ref<HTMLInputElement | null>(null);
const sensors = ref<any[]>([]);
const sites = ref<any[]>([]);
const modules: SearchResult[] = [
  { type: 'module', title: 'Panel principal', subtitle: 'Resumen y prioridades', to: '/', icon: Gauge },
  { type: 'module', title: 'Centro de monitoreo', subtitle: 'Mapa y dispositivos', to: '/monitoring', icon: RadioTower },
  { type: 'module', title: 'Áreas monitoreadas', subtitle: 'Rangos y tendencias', to: '/areas', icon: BarChart3 },
  { type: 'module', title: 'Sedes y sensores', subtitle: 'Infraestructura', to: '/sensors', icon: Building2 },
  { type: 'module', title: 'Alarmas y acciones', subtitle: 'Gestión de incidentes', to: '/alarms', icon: AlarmClock },
  { type: 'module', title: 'Lecturas', subtitle: 'Histórico de variables', to: '/readings', icon: Activity },
  { type: 'module', title: 'Reportes', subtitle: 'Evidencia y exportaciones', to: '/reports', icon: FileBarChart },
  { type: 'module', title: 'Auditoría', subtitle: 'Trazabilidad de cambios', to: '/audit', icon: ShieldCheck }
];

const results = computed(() => {
  const term = query.value.trim().toLocaleLowerCase();
  if (!term) return [];
  const sensorResults: SearchResult[] = sensors.value
    .filter((sensor) => `${sensor.code} ${sensor.name} ${sensor.area} ${sensor.site_name || ''}`.toLocaleLowerCase().includes(term))
    .slice(0, 6)
    .map((sensor) => ({
      type: 'sensor',
      title: `${sensor.code} · ${sensor.name}`,
      subtitle: `${sensor.site_name || 'Sin sede'} · ${sensor.area}`,
      to: `/sensors/${sensor.id}`,
      icon: Activity
    }));
  const siteResults: SearchResult[] = sites.value
    .filter((site) => `${site.code} ${site.name} ${site.city}`.toLocaleLowerCase().includes(term))
    .slice(0, 4)
    .map((site) => ({
      type: 'site',
      title: site.name,
      subtitle: `${site.code} · ${site.city}`,
      to: `/sensors?site=${site.id}`,
      icon: Building2
    }));
  return [
    ...modules.filter((item) => `${item.title} ${item.subtitle}`.toLocaleLowerCase().includes(term)),
    ...sensorResults,
    ...siteResults
  ].slice(0, 10);
});

async function loadData() {
  if (loaded.value) return;
  loading.value = true;
  try {
    const [sensorResponse, siteResponse] = await Promise.all([
      api.get('/sensors'),
      api.get('/monitoring/sites')
    ]);
    sensors.value = sensorResponse.data.data;
    sites.value = siteResponse.data.data;
    loaded.value = true;
  } finally {
    loading.value = false;
  }
}
async function open() {
  visible.value = true;
  query.value = '';
  await Promise.all([loadData(), nextTick()]);
  inputElement.value?.focus();
}
function close() {
  visible.value = false;
}
function onKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
    event.preventDefault();
    open();
  } else if (event.key === 'Escape' && visible.value) {
    close();
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>
