import { createApp, h, ref, type App } from 'vue';
import RadialMenu from '@/components/RadialMenu.vue';
import { config } from '@/entrypoints/utils/config';
import { isServiceConfigured, options, supportsTranslationOnlyMode } from '@/entrypoints/utils/option';
import browser from 'webextension-polyfill';

let app: App<Element> | null = null;
let host: HTMLDivElement | null = null;
let raf = 0;

const position = ref<'left' | 'right'>('right');
const offsetY = ref<number | null>(null);
const open = ref(false);

function availableServices() {
  const result: Array<{ value: string; label: string }> = [];
  for (const item of options.services) {
    if (item.disabled) continue;
    if (config.display === 0 && !supportsTranslationOnlyMode(item.value)) continue;
    if (isServiceConfigured(item.value, config)) result.push({ value: item.value, label: item.label });
  }
  for (const provider of config.customProviders ?? []) {
    if (isServiceConfigured(provider.id, config)) result.push({ value: provider.id, label: provider.name || provider.id });
  }
  return result;
}

function syncAnchor() {
  const ball = document.querySelector<HTMLElement>('#only-translate-floating-ball-container .floating-ball-trigger');
  if (ball) {
    const rect = ball.getBoundingClientRect();
    position.value = config.floatingBallPosition === 'left' ? 'left' : 'right';
    offsetY.value = Math.max(8, rect.top);
  }
  raf = requestAnimationFrame(syncAnchor);
}

export function mountRadialMenu() {
  if (app || !document.documentElement) return;

  host = document.createElement('div');
  host.id = 'only-translate-radial-menu-container';
  document.documentElement.appendChild(host);

  app = createApp({
    setup() {
      return () => h(RadialMenu, {
        open: open.value,
        'onUpdate:open': (value: boolean) => { open.value = value; },
        position: position.value,
        offsetY: offsetY.value,
        activeScope: config.translationScope === 'full' ? 'full' : 'smart',
        activeService: config.service,
        services: availableServices(),
        pdfSource: '',
        onToggleScope: () => { config.translationScope = config.translationScope === 'full' ? 'smart' : 'full'; },
        onSelectService: (value: string) => { config.service = value; },
        onOpenReading: () => { void browser.runtime.sendMessage({ type: 'openEbookLibrary' }); },
        onOpenSettings: () => { void browser.runtime.sendMessage({ type: 'openOptionsPage' }); },
        onOpenPdf: () => {},
      });
    }
  });
  app.mount(host);

  const style = document.createElement('style');
  style.id = 'only-translate-radial-menu-bridge-style';
  style.textContent = '#only-translate-floating-ball-container .floating-toolbar,#only-translate-floating-ball-container .floating-ball-more-trigger{display:none!important;}';
  document.documentElement.appendChild(style);
  syncAnchor();
}

export function unmountRadialMenu() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (app) app.unmount();
  app = null;
  host?.remove();
  host = null;
  document.getElementById('only-translate-radial-menu-bridge-style')?.remove();
  open.value = false;
}
