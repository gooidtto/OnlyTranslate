<template>
  <div class="floating-ball-radial-host">
    <FloatingBall v-bind="attrs" />
    <RadialMenu
      v-model:open="radialOpen"
      :position="floatingPosition"
      :offset-y="floatingOffsetY"
      :active-scope="translationScope"
      :active-service="service"
      :services="services"
      :pdf-source="pdfSource"
      @toggle-scope="toggleScope"
      @select-service="selectService"
      @open-reading="openReading"
      @open-settings="openSettings"
      @open-pdf="openPdf"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useAttrs } from 'vue';
import FloatingBall from '@/components/FloatingBall.vue';
import RadialMenu from '@/components/RadialMenu.vue';
import { config } from '@/entrypoints/utils/config';
import { isServiceConfigured, options, supportsTranslationOnlyMode } from '@/entrypoints/utils/option';

defineOptions({ inheritAttrs: false });
const attrs = useAttrs();
const radialOpen = ref(false);

const floatingPosition = computed<'left' | 'right'>(() => attrs.position === 'left' ? 'left' : 'right');
const floatingOffsetY = computed<number | null>(() => typeof attrs.offsetY === 'number' ? attrs.offsetY : null);
const translationScope = computed<'smart' | 'full'>(() => config.translationScope === 'full' ? 'full' : 'smart');
const service = computed(() => config.service);
const pdfSource = computed(() => typeof attrs.pdfSource === 'string' ? attrs.pdfSource : '');
const services = computed(() => {
  const result: Array<{ value: string; label: string }> = [];
  for (const item of options.services) {
    if (item.disabled) continue;
    const incompatible = config.display === 0 && !supportsTranslationOnlyMode(item.value);
    if (!incompatible && isServiceConfigured(item.value, config)) result.push({ value: item.value, label: item.label });
  }
  for (const provider of config.customProviders ?? []) {
    if (isServiceConfigured(provider.id, config)) result.push({ value: provider.id, label: provider.name || provider.id });
  }
  return result;
});

const callback = (name: string, ...args: unknown[]) => {
  const fn = attrs[name];
  if (typeof fn === 'function') fn(...args);
};

function toggleScope() {
  callback('onScopeChanged', translationScope.value === 'full' ? 'smart' : 'full');
}
function selectService(value: string) {
  callback('onServiceChanged', value);
}
function openReading() {
  radialOpen.value = false;
  callback('onOpenReading');
}
function openSettings() {
  radialOpen.value = false;
  callback('onSettingsClick', new MouseEvent('click'));
}
function openPdf() {
  radialOpen.value = false;
  callback('onOpenPdf', pdfSource.value);
}
</script>

<style scoped>
.floating-ball-radial-host { display: contents; }
.floating-ball-radial-host :deep(.floating-toolbar),
.floating-ball-radial-host :deep(.floating-ball-more-trigger) { display: none !important; }
</style>
