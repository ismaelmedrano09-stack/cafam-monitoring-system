<template>
  <div v-if="show" class="push-banner">
    <span class="push-banner-icon" aria-hidden="true">🔔</span>
    <div class="push-banner-text">
      <strong>{{ installReady ? 'Instala la app en tu celular' : 'Activa las notificaciones de alarma' }}</strong>
      <small v-if="installReady">Instala Cafam Telemetría en tu pantalla de inicio para recibir alertas incluso con la pantalla apagada.</small>
      <small v-else>Recibe alertas de alarma aunque cierres el navegador, directamente en tu celular o computadora.</small>
    </div>
    <div class="push-banner-actions">
      <button v-if="installReady" class="primary" :disabled="loading" @click="install">Instalar app</button>
      <button class="primary" :disabled="loading" @click="activate">
        {{ loading ? 'Activando...' : 'Activar alertas' }}
      </button>
      <button class="push-banner-close" aria-label="Cerrar" @click="dismiss">✕</button>
    </div>
    <p v-if="message" class="push-banner-msg" :class="{ ok: msgOk }">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { subscribePush, isPushSubscribed } from '../services/push';

const show = ref(false);
const loading = ref(false);
const message = ref('');
const msgOk = ref(false);
const installReady = ref(false);
let deferredPrompt: any = null;

function dismiss() {
  show.value = false;
  sessionStorage.setItem('cafam_push_dismissed', '1');
}

async function install() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  installReady.value = false;
  if (outcome === 'accepted') {
    message.value = '¡App instalada! Ya puedes reciibir alertas en tu pantalla de inicio.';
    msgOk.value = true;
  }
}

async function activate() {
  loading.value = true;
  message.value = '';
  const result = await subscribePush();
  loading.value = false;
  message.value = result.message;
  msgOk.value = result.ok;
  if (result.ok) setTimeout(dismiss, 3000);
}

onMounted(async () => {
  if (sessionStorage.getItem('cafam_push_dismissed')) return;
  const alreadySubscribed = await isPushSubscribed();
  if (alreadySubscribed) return;

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e;
    installReady.value = true;
    show.value = true;
  });

  if ('Notification' in window && Notification.permission !== 'granted') {
    show.value = true;
  }
});
</script>
