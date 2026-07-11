import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import LoginView from '../views/LoginView.vue';
import DashboardView from '../views/DashboardView.vue';
import SensorsView from '../views/SensorsView.vue';
import AlarmsView from '../views/AlarmsView.vue';
import AreasView from '../views/AreasView.vue';

const routes: RouteRecordRaw[] = [
  { path: '/login', component: LoginView, meta: { public: true } },
  { path: '/registro-alerta', component: () => import('../views/RegisterAlertView.vue'), meta: { public: true } },
  { path: '/confirmar-alerta', component: () => import('../views/RegisterAlertView.vue'), meta: { public: true } },
  { path: '/', component: DashboardView },
  { path: '/monitoring', component: () => import('../views/MonitoringCenterView.vue') },
  { path: '/areas', component: AreasView },
  { path: '/sensors', component: SensorsView },
  { path: '/sensors/:id', component: () => import('../views/SensorDetailView.vue') },
  { path: '/readings', component: () => import('../views/ReadingsView.vue') },
  { path: '/alarms', component: AlarmsView },
  { path: '/corrective-actions', redirect: '/alarms' },
  { path: '/reports', component: () => import('../views/ReportsView.vue') },
  { path: '/users', component: () => import('../views/UsersView.vue'), meta: { roles: ['administrador'] } },
  { path: '/ranges', redirect: '/sensors' },
  { path: '/audit', component: () => import('../views/AuditView.vue'), meta: { roles: ['administrador', 'calidad'] } },
  { path: '/profile', component: () => import('../views/ProfileView.vue') },
  { path: '/:pathMatch(.*)*', component: () => import('../views/NotFoundView.vue') }
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!to.meta.public && !auth.isAuthenticated) return '/login';
  if (!to.meta.public && !(await auth.validateSession())) {
    return { path: '/login', query: { expired: '1' } };
  }
  if (to.path === '/login' && auth.isAuthenticated) return '/';
  const roles = to.meta.roles as string[] | undefined;
  if (roles && !roles.includes(auth.role)) return '/';
  return true;
});

export default router;
