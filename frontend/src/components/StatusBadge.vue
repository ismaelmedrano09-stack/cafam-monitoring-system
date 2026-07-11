<template>
  <span class="badge" :class="normalized">{{ label }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { humanize } from '../utils/labels';

const props = defineProps({ status: { type: String, default: 'normal' } });
const normalized = computed(() => props.status?.replaceAll('_', '-') || 'normal');
const label = computed(() => humanize(props.status));
</script>
