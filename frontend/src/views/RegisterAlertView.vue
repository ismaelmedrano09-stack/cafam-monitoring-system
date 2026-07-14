<template>
  <section class="login-page register-alert-page">
    <!-- Confirmación de token -->
    <div v-if="confirmed !== null" class="login-panel form-grid">
      <span class="brand-mark">C</span>
      <div>
        <h1>{{ confirmed ? '✓ ¡Suscripción confirmada!' : 'Enlace inválido' }}</h1>
        <p>{{ confirmMessage }}</p>
      </div>
      <RouterLink class="primary" style="text-align:center;padding:12px" to="/login">Ir al sistema</RouterLink>
    </div>

    <!-- Formulario de registro -->
    <form v-else class="login-panel register-panel form-grid" @submit.prevent="submit">
      <span class="brand-mark">C</span>
      <div>
        <h1>Registro de alertas</h1>
        <p>Completa el formulario para recibir notificaciones automáticas cuando se dispare una alarma en Clínicas Cafam.</p>
      </div>

      <div v-if="success" class="register-success">
        <strong>✓ ¡Registro exitoso!</strong>
        <p>{{ successMessage }}</p>
        <RouterLink v-if="demoConfirmToken" class="primary" :to="`/confirmar-alerta?token=${demoConfirmToken}`">Confirmar suscripción demo</RouterLink>
      </div>

      <template v-if="!success">
        <!-- Datos personales -->
        <fieldset class="register-fieldset">
          <legend>Datos personales</legend>
          <div class="form-columns">
            <label class="field">
              <span>Nombre completo <span class="required">*</span></span>
              <input v-model.trim="form.name" required placeholder="Ej. María García" />
            </label>
            <label class="field">
              <span>Cargo / Rol</span>
              <input v-model.trim="form.cargo" placeholder="Ej. Regente de farmacia" />
            </label>
          </div>
          <div class="form-columns">
            <label class="field">
              <span>Correo electrónico <span class="required">*</span></span>
              <input v-model.trim="form.email" type="email" required placeholder="nombre@cafam.com.co" />
            </label>
            <label class="field">
              <span>Teléfono / Celular</span>
              <input v-model.trim="form.phone" type="tel" placeholder="Ej. 3001234567" />
            </label>
          </div>
        </fieldset>

        <!-- Sede -->
        <fieldset class="register-fieldset">
          <legend>Sede de interés</legend>
          <label class="field">
            <span>Sede que deseas monitorear</span>
            <select v-model="form.site_id">
              <option :value="null">Todas las sedes (global)</option>
              <option v-for="site in sites" :key="site.id" :value="site.id">
                {{ site.name }} — {{ site.city }}
              </option>
            </select>
          </label>
        </fieldset>

        <!-- Niveles -->
        <fieldset class="register-fieldset">
          <legend>Niveles de alarma que deseas recibir <span class="required">*</span></legend>
          <div class="check-group">
            <label class="check-item check-critica">
              <input v-model="form.levels" type="checkbox" value="critica" />
              <span>
                <strong>🔴 Crítica</strong>
                <small>Temperatura o humedad fuera del rango permitido. Requiere acción inmediata.</small>
              </span>
            </label>
            <label class="check-item check-advertencia">
              <input v-model="form.levels" type="checkbox" value="advertencia" />
              <span>
                <strong>🟡 Advertencia</strong>
                <small>Valores cercanos al límite. Requiere vigilancia preventiva.</small>
              </span>
            </label>
            <label class="check-item check-informativa">
              <input v-model="form.levels" type="checkbox" value="informativa" />
              <span>
                <strong>🔵 Informativa</strong>
                <small>Sensor sin reporte o eventos de baja prioridad.</small>
              </span>
            </label>
          </div>
          <p v-if="levelError" class="error">Selecciona al menos un nivel de alarma.</p>
        </fieldset>

        <!-- Canales -->
        <fieldset class="register-fieldset">
          <legend>Canales de notificación <span class="required">*</span></legend>
          <div class="check-group">
            <label class="check-item">
              <input v-model="form.channels" type="checkbox" value="email" />
              <span>
                <strong>📧 Correo electrónico</strong>
                <small>Recibirás un email detallado con la información de la alarma.</small>
              </span>
            </label>
            <label class="check-item">
              <input v-model="form.channels" type="checkbox" value="whatsapp" />
              <span>
                <strong>💬 WhatsApp</strong>
                <small>Mensaje de WhatsApp al celular registrado. Requiere una activación única y gratuita.</small>
              </span>
            </label>
            <label class="check-item">
              <input v-model="form.channels" type="checkbox" value="sms" />
              <span>
                <strong>📱 SMS</strong>
                <small>Mensaje de texto al teléfono registrado. Requiere celular.</small>
              </span>
            </label>
            <label class="check-item">
              <input v-model="form.channels" type="checkbox" value="call" />
              <span>
                <strong>📞 Llamada</strong>
                <small>Llamada automática al teléfono registrado para alarmas críticas.</small>
              </span>
            </label>
          </div>
          <p v-if="channelError" class="error">Selecciona al menos un canal de notificación.</p>

          <div v-if="form.channels.includes('whatsapp')" class="register-success" style="margin-top:12px">
            <strong>💬 Recibir alertas por WhatsApp</strong>
            <p style="margin:8px 0 4px">
              Escribe tu número <strong>con código de país</strong> en el campo Teléfono
              (Ej. +573001234567 para Colombia, +5215512345678 para México) y recibirás las alertas
              directamente desde el WhatsApp institucional del sistema.
            </p>
            <label class="field">
              <span>API key de CallMeBot (opcional, solo como respaldo)</span>
              <input v-model.trim="form.whatsapp_apikey" placeholder="Déjalo vacío si no la tienes" />
            </label>
          </div>
        </fieldset>

        <p v-if="error" class="error">{{ error }}</p>

        <div class="form-actions">
          <button class="primary" :disabled="loading">
            {{ loading ? 'Registrando...' : 'Registrarme para alertas' }}
          </button>
        </div>

        <p style="font-size:13px;color:var(--muted);text-align:center">
          Al registrarte aceptas recibir notificaciones automáticas del sistema de telemetría Cafam. Puedes darte de baja en cualquier momento contactando al administrador.
        </p>
      </template>
    </form>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import api from '../services/api';

const route = useRoute();
const sites = ref<{ id: number; name: string; city: string }[]>([]);
const loading = ref(false);
const success = ref(false);
const successMessage = ref('');
const demoConfirmToken = ref('');
const error = ref('');
const levelError = ref(false);
const channelError = ref(false);
const confirmed = ref<boolean | null>(null);
const confirmMessage = ref('');

const form = ref({
  name: '',
  cargo: '',
  email: '',
  phone: '',
  whatsapp_apikey: '',
  site_id: null as number | null,
  levels: [] as string[],
  channels: ['email'] as string[]
});

async function loadSites() {
  try {
    const { data } = await api.get('/monitoring/sites');
    sites.value = data.data ?? [];
  } catch {}
}

async function confirmToken(token: string) {
  try {
    const { data } = await api.get(`/monitoring/contacts/confirm?token=${token}`);
    confirmed.value = true;
    confirmMessage.value = data.message;
  } catch (err: any) {
    confirmed.value = false;
    confirmMessage.value = err.response?.data?.message || 'El enlace no es válido o ya fue usado.';
  }
}

async function submit() {
  levelError.value = form.value.levels.length === 0;
  channelError.value = form.value.channels.length === 0;
  if (levelError.value || channelError.value) return;

  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.post('/monitoring/contacts/register', form.value);
    success.value = true;
    successMessage.value = data.data?.email_sent
      ? `Hemos enviado un correo de confirmación a ${form.value.email}. Revisa también la carpeta de correo no deseado.`
      : data.message;
    demoConfirmToken.value = data.data?.demo ? data.data.confirmation_token : '';
  } catch (err: any) {
    error.value = err.response?.data?.message || 'No fue posible completar el registro. Intenta de nuevo.';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  const token = route.query.token as string;
  if (token) {
    confirmToken(token);
  } else {
    loadSites();
  }
});
</script>
