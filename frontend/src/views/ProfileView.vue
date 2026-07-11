<template>
  <AppLayout title="Perfil">
    <div class="grid two-col" style="gap:16px">
      <article class="panel form-grid">
        <h2>{{ auth.user?.name }}</h2>
        <p class="muted">{{ auth.user?.email }}</p>
        <StatusBadge :status="auth.user?.role" />
      </article>

      <article class="panel form-grid">
        <div>
          <h2>Autenticación de dos factores (2FA)</h2>
          <p class="muted">Agrega una capa extra de seguridad con una app de autenticación (Google Authenticator, Authy, etc.).</p>
        </div>

        <div v-if="!qrData && !totpEnabled" class="totp-state">
          <p>El 2FA no está activo en tu cuenta.</p>
          <button class="primary" :disabled="loading" @click="setupTotp">Configurar 2FA</button>
        </div>

        <div v-if="qrData" class="totp-setup">
          <p>Escanea este código QR con tu app de autenticación:</p>
          <img :src="qrData" alt="QR 2FA" style="width:180px;height:180px;border:1px solid var(--line);border-radius:8px" />
          <label class="field">
            <span>Código de verificación (6 dígitos)</span>
            <input v-model="verifyCode" type="text" inputmode="numeric" maxlength="6" placeholder="000000" />
          </label>
          <button class="primary" :disabled="loading || verifyCode.length !== 6" @click="enableTotp">Activar 2FA</button>
        </div>

        <div v-if="totpEnabled && !qrData" class="totp-state">
          <p style="color:var(--green);font-weight:700">✓ 2FA activo en tu cuenta.</p>
          <button class="secondary danger" :disabled="loading" @click="disableTotp">Desactivar 2FA</button>
        </div>

        <p v-if="totpMessage" :style="{ color: totpError ? 'var(--red)' : 'var(--green)' }">{{ totpMessage }}</p>
      </article>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AppLayout from '../layouts/AppLayout.vue';
import StatusBadge from '../components/StatusBadge.vue';
import { useAuthStore } from '../stores/auth';
import api from '../services/api';

const auth = useAuthStore();
const qrData = ref('');
const verifyCode = ref('');
const totpEnabled = ref(false);
const totpMessage = ref('');
const totpError = ref(false);
const loading = ref(false);

async function setupTotp() {
  loading.value = true;
  try {
    const { data } = await api.post('/auth/2fa/setup');
    qrData.value = data.data.qr;
    totpMessage.value = '';
  } catch {
    totpMessage.value = 'No fue posible generar el QR.';
    totpError.value = true;
  } finally {
    loading.value = false;
  }
}

async function enableTotp() {
  loading.value = true;
  try {
    await api.post('/auth/2fa/enable', { token: verifyCode.value });
    totpEnabled.value = true;
    qrData.value = '';
    verifyCode.value = '';
    totpMessage.value = '2FA activado correctamente.';
    totpError.value = false;
  } catch (err: any) {
    totpMessage.value = err.response?.data?.message || 'Código incorrecto.';
    totpError.value = true;
  } finally {
    loading.value = false;
  }
}

async function disableTotp() {
  loading.value = true;
  try {
    await api.post('/auth/2fa/disable');
    totpEnabled.value = false;
    totpMessage.value = '2FA desactivado.';
    totpError.value = false;
  } catch {
    totpMessage.value = 'No fue posible desactivar el 2FA.';
    totpError.value = true;
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  try {
    const { data } = await api.get('/auth/me');
    totpEnabled.value = Boolean(data.data?.totp_enabled);
  } catch {}
});
</script>
