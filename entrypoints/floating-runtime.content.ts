import { config, configReady } from '@/entrypoints/utils/config'
import { configureFloatingBallTranslationActions, mountFloatingBall, setFloatingBallTranslationState, unmountFloatingBall } from '@/entrypoints/utils/floatingBall'
import { mountRadialMenu, unmountRadialMenu } from '@/entrypoints/utils/radialMenu'
import { createContentFeatureRequester } from '@/entrypoints/content/contentFeatureRequester'
import type { ContentFeatureActionMessage } from '@/entrypoints/utils/contentFeatureProtocol'

type FloatingAction = { type: 'mount' | 'unmount' | 'set-state'; translated?: boolean }
type RuntimeWindow = Window & { __onlyTranslateFloatingRuntime?: boolean }

export default defineContentScript({
  registration: 'runtime', matches: ['<all_urls>'], runAt: 'document_end',
  async main() {
    const runtimeWindow = window as RuntimeWindow
    if (runtimeWindow.__onlyTranslateFloatingRuntime) return
    runtimeWindow.__onlyTranslateFloatingRuntime = true
    await configReady

    const { request } = createContentFeatureRequester(browser.runtime)
    configureFloatingBallTranslationActions({
      autoTranslateEnglishPage: scope => { void request('page', { type: 'translate-page', scope }) },
      restoreOriginalContent: () => { void request('page', { type: 'restore' }) }
    })

    const mount = () => {
      mountFloatingBall()
      if (config.disableFloatingBall !== true) mountRadialMenu()
    }
    const unmount = () => {
      unmountRadialMenu()
      unmountFloatingBall()
    }

    const listener = (message: unknown) => {
      const envelope = message as Partial<ContentFeatureActionMessage>
      if (envelope.type !== 'CONTENT_FEATURE_ACTION' || envelope.feature !== 'floating') return
      const action = envelope.action as FloatingAction
      if (action?.type === 'mount') mount()
      if (action?.type === 'unmount') unmount()
      if (action?.type === 'set-state') setFloatingBallTranslationState(Boolean(action.translated))
      return { success: true }
    }
    const pageStateHandler = (event: Event) => {
      setFloatingBallTranslationState((event as CustomEvent<string>).detail === 'translated')
    }

    browser.runtime.onMessage.addListener(listener)
    document.addEventListener('onlytranslate-page-state-changed', pageStateHandler)
    if (config.disableFloatingBall !== true) mount()
    window.addEventListener('beforeunload', () => {
      unmount()
      browser.runtime.onMessage.removeListener(listener)
      document.removeEventListener('onlytranslate-page-state-changed', pageStateHandler)
      runtimeWindow.__onlyTranslateFloatingRuntime = false
    }, { once: true })
  }
})
