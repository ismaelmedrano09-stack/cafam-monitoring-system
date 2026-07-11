<template>
  <section class="login-page clinical-login-page">
    <div class="clinical-login-shell">
      <aside class="login-identity-panel" aria-label="Identidad Cafam Monitoring">
        <div class="login-brand-lockup">
          <span class="brand-mark">C</span>
          <div>
            <strong>Cafam Monitoring</strong>
            <small>Telemetría clínica</small>
          </div>
        </div>

        <div class="login-identity-copy">
          <span class="eyebrow">Centro de control</span>
          <h1>Monitoreo seguro para áreas clínicas críticas.</h1>
          <p>Seguimiento continuo de temperatura, humedad, alarmas y evidencia operativa para cadena de frío.</p>
        </div>

        <div class="login-identity-grid">
          <div><Thermometer :size="18" /><span>Variables ambientales</span></div>
          <div><BellRing :size="18" /><span>Alertas automáticas</span></div>
          <div><ShieldCheck :size="18" /><span>Acceso protegido</span></div>
        </div>
      </aside>

      <form class="login-panel clinical-login-panel form-grid" @submit.prevent="submit">
        <div class="login-form-heading">
          <span class="brand-mark compact">C</span>
          <div>
            <h2>Iniciar sesión</h2>
            <p>Ingresa con tus credenciales para continuar.</p>
          </div>
        </div>

        <div v-if="demoEnabled" class="login-note">
          Si MySQL no está activo, el usuario administrador abre un modo demo con datos simulados.
        </div>
        <div v-if="sessionExpired" class="login-note session-expired-note">
          Tu sesión venció por seguridad. Ingresa nuevamente para continuar.
        </div>

        <label class="field login-field">
          <span>Correo electrónico</span>
          <div class="input-with-icon">
            <Mail :size="18" />
            <input v-model="email" type="email" autocomplete="email" required placeholder="nombre@cafam.com.co" />
          </div>
        </label>

        <label class="field login-field">
          <span>Contraseña</span>
          <div class="input-with-icon password-input">
            <LockKeyhole :size="18" />
            <input v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" required placeholder="Ingresa tu contraseña" />
            <button type="button" class="password-toggle" :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'" @click="showPassword = !showPassword">
              <EyeOff v-if="showPassword" :size="18" />
              <Eye v-else :size="18" />
            </button>
          </div>
        </label>

        <label v-if="requiresTotp" class="field login-field">
          <span>Código de autenticación (2FA)</span>
          <div class="input-with-icon">
            <ShieldCheck :size="18" />
            <input v-model="totpToken" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="000000" autocomplete="one-time-code" required />
          </div>
        </label>

        <div class="login-options">
          <label class="remember-option">
            <input v-model="rememberMe" type="checkbox" />
            <span>Recordarme</span>
          </label>
          <button type="button" class="forgot-link" @click="showRecoveryMessage">
            Recuperar contraseña
          </button>
        </div>

        <button class="primary login-submit" :disabled="loading">
          {{ loading ? 'Iniciando sesión...' : 'Iniciar sesión' }}
        </button>

        <p v-if="error" class="error">{{ error }}</p>
        <p v-if="recoveryMessage" class="login-helper">{{ recoveryMessage }}</p>

        <p class="alert-register-link">
          ¿No tienes cuenta?
          <RouterLink to="/registro">Crear cuenta</RouterLink>
        </p>

        <p class="alert-register-link">
          ¿Quieres recibir alertas por correo?
          <RouterLink to="/registro-alerta">Registrarse aquí</RouterLink>
        </p>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { BellRing, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Thermometer } from '@lucide/vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const sessionExpired = computed(() => route.query.expired === '1');
const demoEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO === 'true';
const rememberedEmail = localStorage.getItem('cafam_remembered_email');
const email = ref(rememberedEmail || (demoEnabled ? 'admin@cafam.test' : ''));
const password = ref(demoEnabled ? 'Admin123*' : '');
const totpToken = ref('');
const requiresTotp = ref(false);
const loading = ref(false);
const error = ref('');
const showPassword = ref(false);
const rememberMe = ref(Boolean(rememberedEmail));
const recoveryMessage = ref('');

function showRecoveryMessage() {
  recoveryMessage.value = 'Para recuperar el acceso, solicita al administrador restablecer tu contraseña.';
}

async function submit() {
  loading.value = true;
  error.value = '';
  recoveryMessage.value = '';
  try {
    const result = await auth.login(email.value, password.value, requiresTotp.value ? totpToken.value : undefined);
    if (result?.requires_totp) {
      requiresTotp.value = true;
      return;
    }
    if (rememberMe.value) localStorage.setItem('cafam_remembered_email', email.value);
    else localStorage.removeItem('cafam_remembered_email');
    router.push('/');
  } catch (err: any) {
    error.value = err.response?.data?.message || 'No fue posible iniciar sesión';
  } finally {
    loading.value = false;
  }
}
</script>
