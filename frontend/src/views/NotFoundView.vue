<template>
  <AppLayout title="Página no encontrada">
    <AsyncState
      tone="empty"
      title="Esta sección no existe"
      message="La dirección puede estar incompleta o la sección fue movida."
      action-label="Volver al panel"
      @action="router.push('/')"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import AppLayout from '../layouts/AppLayout.vue';
import AsyncState from '../components/AsyncState.vue';

const router = useRouter();
</script>
