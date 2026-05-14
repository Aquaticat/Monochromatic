/**
 * Settings screen.
 *
 * Combines display / voice / locale settings with provider config.
 * Writes through to the state store on every change so values persist
 * across reloads. The Anthropic browser-direct flag is gated behind
 * an explicit acknowledgement checkbox per the README.
 *
 * Event handlers attach via `addEventListener` so each closure reads
 * its captured, already-typed element reference rather than narrowing
 * `event.currentTarget` at call time. That avoids
 * `typescript-eslint/no-unsafe-type-assertion` and works correctly
 * even if the underlying element is moved or replaced.
 */
import { el, } from '../dom.ts';
import { LL, } from '../i18n/runtime.ts';
import {
  navigate,
  registerScreen,
} from '../router.ts';
import {
  getProvider,
  getSettings,
  updateProvider,
  updateSettings,
} from '../state.ts';
import {
  coerceLocale,
  coerceProviderId,
} from '../types.ts';
import {
  anthropicWarningNodes,
  AUTO_DELAY_MAX_MS,
  AUTO_DELAY_STEP_MS,
  checkbox,
  field,
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  FONT_SCALE_STEP,
  languageSelect,
  providerInput,
  providerSelect,
  range,
  TEXT_SPEED_MAX,
  TEXT_SPEED_MIN,
  TEXT_SPEED_STEP,
  VOLUME_STEP,
} from './settings-helpers.ts';

/**
 * Mounts the settings screen.
 *
 * @param root - host element the screen mounts into
 */
function mount(root: HTMLElement,): void {
  /** Current locale's translation accessors. */
  // oxlint-disable-next-line new-cap -- typesafe-i18n exports the accessor as LL by convention.
  const ll = LL();
  /** Settings snapshot used to seed every control. */
  const settings = getSettings();
  /** Provider config snapshot used to seed provider-specific controls. */
  const provider = getProvider();

  /** Language `<select>` whose change event writes the new locale to settings. */
  const langSelect = languageSelect(settings.locale,);
  langSelect.addEventListener(
    'change',
    function onChange(): void {
      /** Newly chosen locale, coerced back to the union to drop unknown values. */
      const next = coerceLocale({
        value: langSelect.value,
        fallback: settings.locale,
      },);
      updateSettings({ locale: next, },);
      document.documentElement.style.setProperty(
        '--font-scale',
        String(getSettings().fontScale,),
      );
      navigate('settings',);
    },
  );

  /** Font-scale slider feeding `--font-scale` for live preview. */
  const fontInput = range({
    min: FONT_SCALE_MIN,
    max: FONT_SCALE_MAX,
    step: FONT_SCALE_STEP,
    initial: settings.fontScale,
    onValue: function onValue(v,): void {
      updateSettings({ fontScale: v, },);
      document.documentElement.style.setProperty(
        '--font-scale',
        String(v,),
      );
    },
  },);
  /** Text-speed slider controlling the lecture screen's typing cadence. */
  const speedInput = range({
    min: TEXT_SPEED_MIN,
    max: TEXT_SPEED_MAX,
    step: TEXT_SPEED_STEP,
    initial: settings.textSpeed,
    onValue: function onValue(v,): void {
      updateSettings({ textSpeed: v, },);
    },
  },);
  /** Voice-volume slider piped into the speech utterance. */
  const voiceVolInput = range({
    min: 0,
    max: 1,
    step: VOLUME_STEP,
    initial: settings.voiceVolume,
    onValue: function onValue(v,): void {
      updateSettings({ voiceVolume: v, },);
    },
  },);
  /** BGM-volume slider (background music level, reserved for future audio). */
  const bgmVolInput = range({
    min: 0,
    max: 1,
    step: VOLUME_STEP,
    initial: settings.bgmVolume,
    onValue: function onValue(v,): void {
      updateSettings({ bgmVolume: v, },);
    },
  },);
  /** Auto-advance delay slider used by the lecture screen between beats. */
  const autoDelayInput = range({
    min: 0,
    max: AUTO_DELAY_MAX_MS,
    step: AUTO_DELAY_STEP_MS,
    initial: settings.autoAdvanceDelayMs,
    onValue: function onValue(v,): void {
      updateSettings({ autoAdvanceDelayMs: v, },);
    },
  },);

  /** Voice-enabled checkbox; change event writes back to settings. */
  const voiceToggle = checkbox({
    initial: settings.voiceEnabled,
    onChange: function saveVoiceEnabled(value,): void {
      updateSettings({ voiceEnabled: value, },);
    },
  },);

  /** Provider `<select>` whose change event swaps the active provider id. */
  const providerSelectEl = providerSelect({
    activeProvider: provider.id,
    labels: {
      openrouter: ll.providerOpenrouter(),
      openai: ll.providerOpenai(),
      anthropic: ll.providerAnthropic(),
      ollama: ll.providerOllama(),
    },
  },);
  providerSelectEl.addEventListener(
    'change',
    function onChange(): void {
      /** Newly chosen provider id, coerced back to the union to drop unknowns. */
      const next = coerceProviderId({
        value: providerSelectEl.value,
        fallback: provider.id,
      },);
      updateProvider({ id: next, },);
      navigate('settings',);
    },
  );

  /** Model text input; input event writes the new model name to provider state. */
  const modelInput = providerInput({
    type: 'text',
    initial: provider.model,
    autocomplete: undefined,
    onValue: function saveModel(value,): void {
      updateProvider({ model: value, },);
    },
  },);

  /** API-key password input; input event writes the new key to provider state. */
  const apiKeyInput = providerInput({
    type: 'password',
    initial: provider.apiKey,
    autocomplete: 'off',
    onValue: function saveApiKey(value,): void {
      updateProvider({ apiKey: value, },);
    },
  },);

  /** Base-URL text input; input event writes the new URL to provider state. */
  const baseUrlInput = providerInput({
    type: 'text',
    initial: provider.baseUrl,
    autocomplete: undefined,
    onValue: function saveBaseUrl(value,): void {
      updateProvider({ baseUrl: value, },);
    },
  },);

  /** Anthropic-specific opt-in nodes, populated only when that provider is active. */
  const anthropicWarningChildren = anthropicWarningNodes({
    provider,
    warningText: ll.anthropicWarning(),
    acceptText: ll.anthropicAccept(),
    onAcknowledge: function saveAck(value,): void {
      updateProvider({ acknowledgedAnthropicWarning: value, },);
    },
  },);

  /** Outer screen container assembling header, fields, and provider section. */
  const screen = el({
    tag: 'section',
    attrs: {
      class: 'screen',
      'data-screen': 'settings',
    },
    children: [
      el({
        tag: 'header',
        attrs: { class: 'row', },
        children: [
          el({
            tag: 'button',
            attrs: {
              'data-variant': 'ghost',
              onclick: function go(): void {
                navigate('menu',);
              },
            },
            children: [ll.back(),],
          }),
          el({
            tag: 'h2',
            attrs: {},
            children: [ll.settings(),],
          }),
        ],
      }),
      field({
        label: ll.language(),
        control: langSelect,
        hintText: undefined,
      },),
      field({
        label: ll.fontSize(),
        control: fontInput,
        hintText: undefined,
      },),
      field({
        label: ll.textSpeed(),
        control: speedInput,
        hintText: undefined,
      },),
      field({
        label: ll.voiceVolume(),
        control: voiceVolInput,
        hintText: undefined,
      },),
      field({
        label: ll.bgmVolume(),
        control: bgmVolInput,
        hintText: undefined,
      },),
      field({
        label: ll.autoAdvanceDelay(),
        control: autoDelayInput,
        hintText: undefined,
      },),
      el({
        tag: 'label',
        attrs: { class: 'row', },
        children: [
          voiceToggle,
          ll.voiceEnabled(),
        ],
      }),
      el({
        tag: 'h2',
        attrs: {},
        children: [ll.provider(),],
      }),
      field({
        label: ll.provider(),
        control: providerSelectEl,
        hintText: undefined,
      },),
      field({
        label: ll.model(),
        control: modelInput,
        hintText: undefined,
      },),
      field({
        label: ll.apiKey(),
        control: apiKeyInput,
        hintText: ll.apiKeyHint(),
      },),
      field({
        label: ll.baseUrl(),
        control: baseUrlInput,
        hintText: ll.baseUrlHint(),
      },),
      ...anthropicWarningChildren,
    ],
  });
  root.append(screen,);
}

/**
 * Registers the settings screen with the router.
 *
 * @example
 * ```ts
 * registerSettings();
 * navigate('settings');
 * ```
 */
export function registerSettings(): void {
  registerScreen({
    id: 'settings',
    module: { mount, },
  },);
}
