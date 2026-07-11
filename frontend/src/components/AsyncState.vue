<template>
  <section class="async-state" :class="tone" role="status">
    <LoaderCircle v-if="tone === 'loading'" class="async-state-icon spinning" :size="24" />
    <CircleAlert v-else-if="tone === 'error'" class="async-state-icon" :size="24" />
    <Inbox v-else class="async-state-icon" :size="24" />
    <div>
      <strong>{{ title }}</strong>
      <p>{{ message }}</p>
    </div>
    <button v-if="actionLabel" type="button" class="secondary" @click="$emit('action')">
      <RefreshCw :size="16" /> {{ actionLabel }}
    </button>
  </section>
</template>

<script setup lang="ts">
import { CircleAlert, Inbox, LoaderCircle, RefreshCw } from '@lucide/vue';

withDefaults(defineProps<{
  tone?: 'loading' | 'error' | 'empty';
  title: string;
  message: string;
  actionLabel?: string;
}>(), { tone: 'empty', actionLabel: '' });

defineEmits<{ action: [] }>();
</script>
