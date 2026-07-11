<template>
  <article class="stat-card" :class="tone">
    <span>{{ label }}</span>
    <strong>{{ displayValue }}</strong>
    <small>{{ hint }}</small>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { humanize } from '../utils/labels';

const props = defineProps({
  label: String,
  value: [String, Number],
  hint: String,
  tone: { type: String, default: 'normal' }
});

const displayValue = computed(() => {
  if (props.value === null || props.value === undefined || props.value === '') return '-';
  return typeof props.value === 'string' ? humanize(props.value) : props.value;
});
</script>
