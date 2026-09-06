import { createApp } from 'vue';
import App from './App.vue';
import RadialToolMenu from './RadialToolMenu.vue';
import './style.css';
import '../../styles/theme.css';
import { createAppI18n } from '@/entrypoints/utils/i18n';

createApp(App)
  .use(createAppI18n())
  .mount('#app');

// Keep the radial tool surface outside the reader layout so it can never
// participate in EPUB flow/layout calculations or obscure reader content.
const radialHost = document.createElement('div');
radialHost.id = 'onlytranslate-radial-tools';
radialHost.setAttribute('aria-label', 'OnlyTranslate 浮动工具');
document.body.appendChild(radialHost);
createApp(RadialToolMenu).mount(radialHost);
