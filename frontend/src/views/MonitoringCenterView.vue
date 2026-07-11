<template>
  <AppLayout title="Centro de monitoreo">
    <section class="monitoring-summary">
      <article class="monitoring-kpi"><span>Sedes supervisadas</span><strong>{{ payload.sites.length }}</strong></article>
      <article class="monitoring-kpi"><span>Equipos conectados</span><strong>{{ connectedDevices }}</strong></article>
      <article class="monitoring-kpi warning"><span>Equipos en alarma</span><strong>{{ devicesInAlarm }}</strong></article>
      <article class="monitoring-kpi"><span>Notificaciones recientes</span><strong>{{ payload.notifications.length }}</strong></article>
    </section>

    <section class="monitoring-map-layout">
      <article class="panel map-panel">
        <div class="panel-heading">
          <div><h2>Ubicación de sedes y equipos</h2><p class="muted">Seleccione un marcador para ver el estado operativo.</p></div>
        </div>
        <div ref="mapElement" class="monitoring-map" aria-label="Mapa de sedes Cafam"></div>
      </article>

      <article class="panel site-list">
        <h2>Sedes</h2>
        <button v-for="site in payload.sites" :key="site.id" class="site-row" :class="{ selected: selectedSiteId === site.id }" @click="focusSite(site)">
          <span class="site-status" :class="Number(site.sensors_in_alarm) ? 'critical' : 'normal'"></span>
          <span><strong>{{ site.name }}</strong><small>{{ site.city }} · {{ equipmentCount(site.sensor_count) }}</small></span>
          <b>{{ site.sensors_in_alarm || 0 }}</b>
        </button>
      </article>
    </section>

    <section class="panel" style="margin-top:16px">
      <div class="panel-heading">
        <h2>Estado de dispositivos</h2>
        <select v-model="selectedSiteId" class="compact-select">
          <option :value="null">Todas las sedes</option>
          <option v-for="site in payload.sites" :key="site.id" :value="site.id">{{ site.name }}</option>
        </select>
      </div>
      <div class="device-grid">
        <RouterLink v-for="device in filteredDevices" :key="device.id" :to="`/sensors/${device.id}`" class="device-tile">
          <div class="device-title">
            <div><strong>{{ device.code }}</strong><span>{{ device.name }}</span></div>
            <StatusBadge :status="deviceStatus(device)" />
          </div>
          <div class="device-values">
            <div><span>Temperatura</span><b>{{ value(device.temperature, ' °C') }}</b></div>
            <div><span>Humedad</span><b>{{ value(device.humidity, ' %') }}</b></div>
            <div><span>Batería</span><b>{{ value(device.battery_level, ' %') }}</b></div>
          </div>
          <div class="battery-track"><span :style="{ width: `${Number(device.battery_level || 0)}%` }"></span></div>
          <small>{{ device.site_name }} · Firmware {{ device.firmware_version || 'N/D' }}</small>
        </RouterLink>
      </div>
    </section>

    <section class="grid two-col" style="margin-top:16px">
      <article class="panel">
        <div class="panel-heading"><h2>Últimas variables alarmadas</h2><RouterLink to="/alarms" class="secondary">Ver alarmas</RouterLink></div>
        <div class="event-list">
          <div v-for="alarm in payload.alarmedVariables" :key="alarm.id" class="event-row">
            <StatusBadge :status="alarm.level" />
            <div><strong>{{ alarm.sensor_code }} · {{ alarm.site_name }}</strong><small>{{ alarm.description }}</small></div>
            <time>{{ formatDate(alarm.started_at) }}</time>
          </div>
          <p v-if="!payload.alarmedVariables.length" class="empty-state">No hay alarmas abiertas.</p>
        </div>
      </article>

      <article class="panel">
        <div class="panel-heading"><h2>Contactos notificados</h2><button class="secondary" @click="showContactForm = !showContactForm">Agregar</button></div>
        <form v-if="showContactForm" class="inline-contact-form" @submit.prevent="createContact">
          <input v-model="contactForm.name" placeholder="Nombre del contacto" required />
          <input v-model="contactForm.email" type="email" placeholder="Correo" />
          <input v-model="contactForm.phone" placeholder="Teléfono" />
          <select v-model="contactForm.site_id">
            <option :value="null">Todas las sedes</option>
            <option v-for="site in payload.sites" :key="site.id" :value="site.id">{{ site.name }}</option>
          </select>
          <button class="primary">Guardar contacto</button>
        </form>
        <div class="event-list">
          <div v-for="notification in payload.notifications" :key="notification.id" class="event-row">
            <span class="channel-label">{{ humanize(notification.channel) }}</span>
            <div><strong>{{ notification.contact_name }}</strong><small>{{ notification.sensor_code }} · {{ notification.destination }}</small></div>
            <StatusBadge :status="notification.status" />
          </div>
          <p v-if="!payload.notifications.length" class="empty-state">Aún no hay notificaciones registradas.</p>
        </div>
      </article>
    </section>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import AppLayout from '../layouts/AppLayout.vue';
import StatusBadge from '../components/StatusBadge.vue';
import api from '../services/api';
import { humanize } from '../utils/labels';
import { useToastStore } from '../stores/toast';

type Site = { id: number; name: string; city: string; latitude: number | string; longitude: number | string; sensor_count: number; sensors_in_alarm: number };
type Device = { id: number; site_id: number; code: string; name: string; site_name: string; status: string; temperature?: number; humidity?: number; battery_level?: number; firmware_version?: string; calculated_status?: string; open_alarms?: number };
type MonitoringPayload = { sites: Site[]; devices: Device[]; alarmedVariables: any[]; notifications: any[] };

const mapElement = ref<HTMLElement | null>(null);
const selectedSiteId = ref<number | null>(null);
const showContactForm = ref(false);
const payload = ref<MonitoringPayload>({ sites: [], devices: [], alarmedVariables: [], notifications: [] });
const contactForm = ref({ name: '', email: '', phone: '', site_id: null as number | null });
const toast = useToastStore();
let map: L.Map | null = null;
const siteMarkers = new Map<number, L.Marker>();

const filteredDevices = computed(() => selectedSiteId.value ? payload.value.devices.filter((device) => Number(device.site_id) === Number(selectedSiteId.value)) : payload.value.devices);
const connectedDevices = computed(() => payload.value.devices.filter((device) => device.status === 'activo').length);
const devicesInAlarm = computed(() => payload.value.devices.filter((device) => Number(device.open_alarms) > 0).length);

const value = (input: unknown, suffix: string) => input === null || input === undefined ? 'N/D' : `${input}${suffix}`;
const formatDate = (input: string) => new Date(input).toLocaleString();
const equipmentCount = (count: number) => `${count} ${Number(count) === 1 ? 'equipo' : 'equipos'}`;
function deviceStatus(device: Device) {
  if (device.status === 'desconectado') return 'desconectado';
  if (Number(device.open_alarms) > 0) return device.calculated_status || 'advertencia';
  return 'normal';
}
function focusSite(site: Site) {
  selectedSiteId.value = site.id;
  map?.flyTo([Number(site.latitude), Number(site.longitude)], 15);
  siteMarkers.get(site.id)?.openPopup();
}
function renderMap() {
  if (!mapElement.value || map) return;
  map = L.map(mapElement.value).setView([4.69, -74.07], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  payload.value.sites.forEach((site) => {
    const state = Number(site.sensors_in_alarm) > 0 ? 'critical' : 'normal';
    const icon = L.divIcon({ className: 'site-map-marker', html: `<span class="${state}"></span>`, iconSize: [24, 24], iconAnchor: [12, 12] });
    const marker = L.marker([Number(site.latitude), Number(site.longitude)], { icon }).addTo(map!).bindPopup(`<strong>${site.name}</strong><br>${equipmentCount(site.sensor_count)} · ${site.sensors_in_alarm || 0} en alarma`);
    siteMarkers.set(site.id, marker);
  });
}
async function load() {
  const { data } = await api.get('/monitoring/overview');
  payload.value = data.data;
  await nextTick();
  renderMap();
}
async function createContact() {
  try {
    await api.post('/monitoring/contacts', { ...contactForm.value, channels: ['email', 'sms'], levels: ['advertencia', 'critica'] });
    contactForm.value = { name: '', email: '', phone: '', site_id: null };
    showContactForm.value = false;
    toast.show('Contacto de alertas agregado.');
    await load();
  } catch (error: any) {
    toast.show(error.response?.data?.message || 'No fue posible agregar el contacto.', 'error');
  }
}

onMounted(load);
onBeforeUnmount(() => map?.remove());
</script>
