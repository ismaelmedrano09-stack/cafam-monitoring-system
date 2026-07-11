<template>
  <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" class="sparkline">
    <polyline v-if="points" :points="points" fill="none" :stroke="color" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    <circle v-if="lastPoint" :cx="lastPoint.x" :cy="lastPoint.y" r="2.5" :fill="color" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}>(), { width: 80, height: 28, color: '#1268ad' });

const points = computed(() => {
  const vals = props.values.filter((v) => v != null && !isNaN(v));
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const pad = 3;
  const w = props.width - pad * 2;
  const h = props.height - pad * 2;
  return vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * w;
    const y = pad + h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
});

const lastPoint = computed(() => {
  const vals = props.values.filter((v) => v != null && !isNaN(v));
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const pad = 3;
  const w = props.width - pad * 2;
  const h = props.height - pad * 2;
  const v = vals[vals.length - 1];
  return { x: pad + w, y: pad + h - ((v - min) / range) * h };
});
</script>

<style scoped>
.sparkline { display: block; }
</style>
