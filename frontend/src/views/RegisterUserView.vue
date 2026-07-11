<template>
  <section class="login-page register-user-page">
    <div v-if="confirmed !== null" class="login-panel form-grid register-confirm-panel">
      <span class="brand-mark">C</span>
      <div>
        <h1>{{ confirmed ? 'Cuenta confirmada' : 'Enlace inválido' }}</h1>
        <p>{{ confirmMessage }}</p>
      </div>
      <RouterLink class="primary centered-action" to="/login">Ir al login</RouterLink>
    </div>

    <div v-else class="clinical-login-shell register-user-shell">
      <aside class="login-identity-panel">
        <div class="login-brand-lockup">
          <span class="brand-mark">C</span>
          <div>
            <strong>Cafam Monitoring</strong>
            <small>Acceso clínico seguro</small>
          </div>
        </div>
        <div class="login-identity-copy">
          <span class="eyebrow">Nueva cuenta</span>
          <h1>Regístrate para gestionar monitoreo y alertas.</h1>
          <p>Tu cuenta quedará pendiente hasta confirmar el enlace enviado al correo registrado.</p>
        </div>
        <div class="login-identity-grid">
          <div><UserPlus :size="18" /><span>Registro verificado</span></div>
          <div><MailCheck :size="18" /><span>Confirmación por correo</span></div>
          <div><ShieldCheck :size="18" /><span>Roles controlados</span></div>
        </div>
      </aside>

      <form class="login-panel clinical-login-panel form-grid" @submit.prevent="submit">
        <div class="login-form-heading">
          <span class="brand-mark compact">C</span>
          <div>
            <h2>Crear cuenta</h2>
            <p>Completa tus datos para solicitar acceso.</p>
          </div>
        </div>

        <div v-if="success" class="register-success">
          <strong>Registro recibido</strong>
          <p>{{ successMessage }}</p>
          <RouterLink v-if="demoConfirmToken" class="primary centered-action" :to="`/confirmar-registro?token=${demoConfirmToken}`">Confirmar cuenta demo</RouterLink>
        </div>

        <template v-if="!success">
          <label class="field login-field">
            <span>Nombre completo</span>
            <div class="input-with-icon">
              <UserPlus :size="18" />
              <input v-model.trim="form.name" required autocomplete="name" placeholder="Ej. María García" />
            </div>
          </label>

          <label class="field login-field">
            <span>Correo electrónico</span>
            <div class="input-with-icon">
              <Mail :size="18" />
              <input v-model.trim="form.email" type="email" required autocomplete="email" placeholder="nombre@cafam.com.co" />
            </div>
          </label>

          <label class="field login-field">
            <span>Rol solicitado</span>
            <select v-model="form.role">
              <option value="consulta_auditor">Consulta / auditor</option>
              <option value="regente_farmacia">Regente de farmacia</option>
              <option value="auxiliar_farmacia">Auxiliar de farmacia</option>
              <option value="calidad">Calidad</option>
              <option value="mantenimiento_biomedico">Mantenimiento biomédico</option>
            </select>
          </label>

          <div class="form-columns">
            <label class="field login-field">
              <span>Contraseña</span>
              <div class="input-with-icon password-input">
                <LockKeyhole :size="18" />
                <input v-model="form.password" :type="showPassword ? 'text' : 'password'" required autocomplete="new-password" minlength="8" placeholder="Mínimo 8 caracteres" />
                <button type="button" class="password-toggle" :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'" @click="showPassword = !showPassword">
                  <EyeOff v-if="showPassword" :size="18" />
                  <Eye v-else :size="18" />
                </button>
              </div>
            </label>

            <label class="field login-field">
              <span>Confirmar contraseña</span>
              <div class="input-with-icon">
                <ShieldCheck :size="18" />
                <input v-model="confirmPassword" :type="showPassword ? 'text' : 'password'" required autocomplete="new-password" minlength="8" placeholder="Repite tu contraseña" />
              </div>
            </label>
          </div>

          <p class="login-note">
            Por seguridad, las cuentas públicas no pueden registrarse como administrador. Un administrador podrá ajustar permisos después.
          </p>

          <p v-if="error" class="error">{{ error }}</p>

          <button class="primary login-submit" :disabled="loading">
            {{ loading ? 'Enviando confirmación...' : 'Crear cuenta y enviar confirmación' }}
          </button>
        </template>

        <p class="alert-register-link">
          ¿Ya tienes cuenta?
          <RouterLink to="/login">Iniciar sesión</RouterLink>
        </p>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { Eye, EyeOff, LockKeyhole, Mail, MailCheck, ShieldCheck, UserPlus } from '@lucide/vue';
import api from '../services/api';

const route = useRoute();
const loading = ref(false);
const success = ref(false);
const successMessage = ref('');
const error = ref('');
const confirmed = ref<boolean | null>(null);
const confirmMessage = ref('');
const showPassword = ref(false);
const confirmPassword = ref('');
const demoConfirmToken = ref('');

const form = ref({
  name: '',
  email: '',
  role: 'consulta_auditor',
  password: ''
});

async function confirmToken(token: string) {
  try {
    const { data } = await api.get(`/auth/confirm-registration?token=${encodeURIComponent(token)}`);
    confirmed.value = true;
    confirmMessage.value = data.message;
  } catch (err: any) {
    confirmed.value = false;
    confirmMessage.value = err.response?.data?.message || 'El enlace no es válido o ya fue usado.';
  }
}

async function submit() {
  if (form.value.password !== confirmPassword.value) {
    error.value = 'Las contraseñas no coinciden.';
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.post('/auth/public-register', form.value);
    success.value = true;
    successMessage.value = data.data?.email_sent
      ? `Enviamos un correo de confirmación a ${form.value.email}. Revisa también la carpeta de correo no deseado.`
      : data.message;
    demoConfirmToken.value = data.data?.demo ? data.data.confirmation_token : '';
  } catch (err: any) {
    error.value = err.response?.data?.message || 'No fue posible crear la cuenta. Intenta de nuevo.';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  const token = route.query.token as string;
  if (token) confirmToken(token);
});
</script>
