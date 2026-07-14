<template>
  <AppLayout title="Bot de WhatsApp">
    <section class="panel" style="max-width:720px">
      <div class="panel-heading">
        <div>
          <h2>Bot institucional de WhatsApp</h2>
          <p class="muted">Vincula un número dedicado para enviar alertas a cualquier contacto sin activaciones.</p>
        </div>
      </div>

      <div v-if="status.connected" class="register-success">
        <strong>✅ Bot conectado</strong>
        <p>Sesión activa: {{ status.me || 'número vinculado' }}. Las alertas por WhatsApp se envían desde este número.</p>
      </div>

      <div v-else-if="status.qr" style="text-align:center;padding:12px">
        <p><strong>Escanea este código con el WhatsApp del número que será el bot:</strong></p>
        <p class="muted" style="font-size:13px">WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo</p>
        <img :src="status.qr" alt="QR de vinculación" style="width:280px;height:280px;border:1px solid var(--line);border-radius:8px" />
        <p class="muted" style="font-size:12px">El código se renueva automáticamente cada pocos segundos.</p>
      </div>

      <div v-else style="padding:12px">
        <p class="muted">{{ loading ? 'Consultando estado…' : 'El bot no está iniciado o aún no genera el código QR.' }}</p>
        <button class="primary" :disabled="loading" @click="startBot">Iniciar vinculación</button>
      </div>

      <hr style="border:none;border-top:1px solid var(--line);margin:18px 0" />

      <h3 style="margin-bottom:8px">Enviar mensaje de prueba</h3>
      <div class="form-columns">
        <label class="field">
          <span>Número destino (con código de país)</span>
          <input v-model.trim="testPhone" placeholder="+5215512345678" />
        </label>
        <label class="field">
          <span>&nbsp;</span>
          <button class="primary" :disabled="!status.connected || testing" @click="sendTest">
            {{ testing ? 'Enviando…' : 'Enviar prueba' }}
          </button>
        </label>
      </div>
      <p v-if="testMsg" :class="testOk ? 'register-success' : 'error'" style="padding:8px">{{ testMsg }}</p>

      <hr style="border:none;border-top:1px solid var(--line);margin:18px 0" />
      <button class="secondary" :disabled="resetting" @click="resetBot">
        {{ resetting ? 'Desvinculando…' : 'Desvincular número (borrar sesión)' }}
      </button>
    </section>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import AppLayout from '../layouts/AppLayout.vue';
import api from '../services/api';

const status = ref<{ connected: boolean; me?: string | null; qr?: string | null }>({ connected: false });
const loading = ref(false);
const testing = ref(false);
const resetting = ref(false);
const testPhone = ref('');
const testMsg = ref('');
const testOk = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

async function refresh() {
  try {
    const { data } = await api.get('/whatsapp/status');
    status.value = data.data || { connected: false };
  } catch {}
}

async function startBot() {
  loading.value = true;
  try { await api.post('/whatsapp/start'); } catch {}
  loading.value = false;
  refresh();
}

async function sendTest() {
  testing.value = true;
  testMsg.value = '';
  try {
    await api.post('/whatsapp/test', { phone: testPhone.value });
    testOk.value = true;
    testMsg.value = '✅ Mensaje enviado. Revisa el WhatsApp destino.';
  } catch (err: any) {
    testOk.value = false;
    testMsg.value = err.response?.data?.message || 'No fue posible enviar el mensaje.';
  } finally {
    testing.value = false;
  }
}

async function resetBot() {
  resetting.value = true;
  try { await api.post('/whatsapp/reset'); } catch {}
  resetting.value = false;
  refresh();
}

onMounted(() => {
  refresh();
  timer = setInterval(refresh, 4000);
});
onUnmounted(() => { if (timer) clearInterval(timer); });
</script>
