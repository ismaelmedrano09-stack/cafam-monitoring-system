<template>
  <div class="app-shell">
    <div v-if="mobileMenuOpen" class="sidebar-backdrop" @click="mobileMenuOpen = false"></div>
    <aside id="main-navigation" class="sidebar" :class="{ open: mobileMenuOpen }">
      <div class="sidebar-header">
        <div class="brand">
          <span class="brand-mark">C</span>
          <div><strong>Cafam</strong><small>Telemetría clínica</small></div>
        </div>
        <button class="icon-button sidebar-close" title="Cerrar menú" @click="mobileMenuOpen = false">
          <X :size="20" />
        </button>
      </div>
      <nav>
        <section v-for="group in visibleNavGroups" :key="group.label" class="nav-group">
          <span class="nav-group-label">{{ group.label }}</span>
          <RouterLink v-for="item in group.items" :key="item.to" :to="item.to" @click="mobileMenuOpen = false">
            <component :is="item.icon" :size="18" stroke-width="1.8" />
            <span>{{ item.label }}</span>
            <span v-if="item.to === '/alarms' && alarmsStore.criticalCount > 0" class="nav-badge">{{ alarmsStore.criticalCount }}</span>
          </RouterLink>
        </section>
      </nav>
    </aside>

    <main class="main">
      <div v-if="demoMode && !demoBannerDismissed" class="demo-banner">
        Modo demo activo: estás viendo datos simulados porque MySQL/API real no respondió al iniciar sesión.
        <button class="demo-banner-close" title="Cerrar aviso" @click="demoBannerDismissed = true"><X :size="16" /></button>
      </div>
      <PushBanner />
      <header class="topbar">
        <button class="icon-button mobile-menu-button" title="Abrir menú" aria-controls="main-navigation" :aria-expanded="mobileMenuOpen" @click="mobileMenuOpen = true">
          <Menu :size="22" />
        </button>
        <div class="topbar-title">
          <h1>{{ title }}</h1>
          <p>Monitoreo en tiempo real de temperatura y humedad relativa</p>
        </div>
        <GlobalSearch />
        <div class="user-chip">
          <RouterLink to="/profile" class="user-identity" title="Ver perfil">
            <span>{{ auth.user?.name }}</span>
            <small>{{ roleLabel(auth.user?.role) }}</small>
          </RouterLink>
          <button class="icon-button" title="Cerrar sesión" @click="logout"><LogOut :size="19" /></button>
        </div>
      </header>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useAlarmsStore } from '../stores/alarms';
import { useToastStore } from '../stores/toast';
import PushBanner from '../components/PushBanner.vue';
import { getSocket, disconnectSocket } from '../services/socket';
import { useRoute, useRouter } from 'vue-router';
import {
  Activity, AlarmClock, BarChart3, Building2, FileBarChart,
  Gauge, LogOut, Menu, RadioTower, ShieldCheck, Users, X
} from '@lucide/vue';
import { useAuthStore } from '../stores/auth';
import { humanize } from '../utils/labels';
import GlobalSearch from '../components/GlobalSearch.vue';

defineProps({ title: { type: String, default: 'Panel principal' } });

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const mobileMenuOpen = ref(false);
const alarmsStore = useAlarmsStore();
const toast = useToastStore();
let alarmPollTimer: ReturnType<typeof setInterval> | undefined;
const demoMode = computed(() => localStorage.getItem('cafam_demo') === 'true');
const demoBannerDismissed = ref(false);

type NavItem = { to: string; label: string; icon: any; roles?: string[] };
type NavGroup = { label: string; items: NavItem[] };
const navGroups: NavGroup[] = [
  { label: 'General', items: [
    { to: '/', label: 'Panel principal', icon: Gauge },
    { to: '/monitoring', label: 'Centro de monitoreo', icon: RadioTower }
  ] },
  { label: 'Operación', items: [
    { to: '/areas', label: 'Áreas monitoreadas', icon: BarChart3 },
    { to: '/sensors', label: 'Sedes y sensores', icon: Building2 },
    { to: '/alarms', label: 'Alarmas y acciones', icon: AlarmClock }
  ] },
  { label: 'Evidencia', items: [
    { to: '/readings', label: 'Lecturas', icon: Activity },
    { to: '/reports', label: 'Reportes', icon: FileBarChart }
  ] },
  { label: 'Administración', items: [
    { to: '/users', label: 'Usuarios', icon: Users, roles: ['administrador'] },
    { to: '/audit', label: 'Auditoría', icon: ShieldCheck, roles: ['administrador', 'calidad'] }
  ] }
];
const visibleNavGroups = computed(() => navGroups
  .map((group) => ({ ...group, items: group.items.filter((item) => !item.roles || item.roles.includes(auth.role)) }))
  .filter((group) => group.items.length));

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') mobileMenuOpen.value = false;
}
watch(() => route.fullPath, () => { mobileMenuOpen.value = false; });
onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  alarmsStore.poll();
  alarmPollTimer = setInterval(() => alarmsStore.poll(), 30000);
  const sock = getSocket();
  if (sock) {
    sock.on('new_alarm', (alarm: any) => {
      alarmsStore.poll();
      toast.show(`Nueva alarma ${alarm.level}: ${alarm.sensor_code} — ${alarm.sensor_name}`, alarm.level === 'critica' ? 'error' : 'info');
    });
  }
});
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  if (alarmPollTimer) clearInterval(alarmPollTimer);
  disconnectSocket();
});

const roleLabel = (role?: string) => humanize(role);
function logout() {
  auth.logout();
  router.push('/login');
}
</script>
