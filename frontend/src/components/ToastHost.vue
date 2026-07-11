<template>
  <div class="toast-host" aria-live="polite">
    <div v-for="item in toast.items" :key="item.id" class="toast-message" :class="item.tone">
      <CircleCheck v-if="item.tone === 'success'" :size="18" />
      <CircleAlert v-else-if="item.tone === 'error'" :size="18" />
      <Info v-else :size="18" />
      <span>{{ item.message }}</span>
      <button title="Cerrar aviso" @click="toast.dismiss(item.id)"><X :size="16" /></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CircleAlert, CircleCheck, Info, X } from '@lucide/vue';
import { useToastStore } from '../stores/toast';

const toast = useToastStore();
</script>
