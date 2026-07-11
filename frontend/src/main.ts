import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/auth';
import { SESSION_EXPIRED_EVENT } from './services/session';
import './styles/main.css';

const pinia = createPinia();
const app = createApp(App);

app.use(pinia).use(router);

window.addEventListener(SESSION_EXPIRED_EVENT, () => {
  useAuthStore(pinia).logout();
  if (router.currentRoute.value.path !== '/login') {
    router.replace({ path: '/login', query: { expired: '1' } });
  }
});

app.mount('#app');
