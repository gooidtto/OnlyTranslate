<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
// @ts-ignore — the radial engine is intentionally a DOM/SVG micro-engine.
import { mountRadialRing } from './radial-ring-engine.js';

let cleanup: (() => void) | undefined;

onMounted(() => {
  cleanup = mountRadialRing();
});

onBeforeUnmount(() => {
  cleanup?.();
});
</script>

<template>
  <!-- The radial engine owns its fixed viewport layer and Shadow DOM. -->
  <span aria-hidden="true" style="display:none" />
</template>
