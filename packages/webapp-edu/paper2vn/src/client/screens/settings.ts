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
  type Locale,
  type ProviderId,
} from '../types.ts';

/**
 * Inline-styled hint paragraph.
 *
 * @param text - hint copy
 *
 * @returns paragraph element
 *
 * @example
 * ```ts
 * const p = hint('API key stored locally.');
 * ```
 */
function hint(text: string,): HTMLElement {
  return el(
    'p',
    { class: 'muted', },
    [text,],
  );
}

/**
 * Field row: label + control with optional hint.
 *
 * @param label - field label text
 *
 * @param control - the input element
 *
 * @param hintText - optional hint shown below the control
 *
 * @returns field container
 *
 * @example
 * ```ts
 * field('Language', langSelect);
 * ```
 */
function field(
  label: string,
  control: HTMLElement,
  hintText: string | undefined,
): HTMLElement {
  /** Field children built up with the optional hint paragraph. */
  const children: (Node | string)[] = [
    el(
      'label',
      {},
      [label,],
    ),
    control,
  ];
  if (hintText !== undefined)
    children.push(hint(hintText,),);
  return el(
    'div',
    { class: 'field', },
    children,
  );
}

/**
 * Builds a labeled `<input type="range">` slider.
 *
 * @param min - minimum value
 *
 * @param max - maximum value
 *
 * @param step - increment between values
 *
 * @param initial - starting value
 *
 * @param onValue - callback fired with each `input` event
 *
 * @returns range input element
 *
 * @example
 * ```ts
 * const r = range({ min: 0, max: 1, step: 0.1, initial: 0.5, onValue: console.log });
 * ```
 */
function range(
  {
    min,
    max,
    step,
    initial,
    onValue,
  }: {
    min: number;
    max: number;
    step: number;
    initial: number;
    onValue: (value: number,) => void;
  },
): HTMLInputElement {
  /** Slider input wired to fire {@link onValue} with the coerced number. */
  const input = el(
    'input',
    {
      type: 'range',
      min: String(min,),
      max: String(max,),
      step: String(step,),
      value: String(initial,),
    },
  );
  input.addEventListener(
    'input',
    function onInput(): void {
      onValue(Number(input.value,),);
    },
  );
  return input;
}

/** Mounts the settings screen. */
function mount(root: HTMLElement,): void {
  /** Current locale's translation accessors. */
  const ll = LL();
  /** Settings snapshot used to seed every control. */
  const settings = getSettings();
  /** Provider config snapshot used to seed provider-specific controls. */
  const provider = getProvider();

  /** Language `<select>` whose change event writes the new locale to settings. */
  const langSelect = el(
    'select',
    {},
    (
      [
        [
          'en',
          'English',
        ],
        [
          'zh',
          '中文',
        ],
        [
          'ja',
          '日本語',
        ],
        [
          'ru',
          'Русский',
        ],
      ] as readonly (readonly [
        Locale,
        string,
      ])[]
    )
      .map(function toOption(
        [
          value,
          label,
        ],
      ): HTMLOptionElement {
        /** Option attributes, with `selected` set when the locale matches. */
        const attrs: Record<string, string> = { value, };
        if (settings.locale === value)
          attrs['selected'] = 'selected';
        return el(
          'option',
          attrs,
          [label,],
        );
      },),
  );
  langSelect.addEventListener(
    'change',
    function onChange(): void {
      /** Newly chosen locale, coerced back to the union to drop unknown values. */
      const next = coerceLocale(
        langSelect.value,
        settings.locale,
      );
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
    min: 0.75,
    max: 1.5,
    step: 0.05,
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
    min: 10,
    max: 120,
    step: 5,
    initial: settings.textSpeed,
    onValue: function onValue(v,): void {
      updateSettings({ textSpeed: v, },);
    },
  },);
  /** Voice-volume slider piped into the speech utterance. */
  const voiceVolInput = range({
    min: 0,
    max: 1,
    step: 0.05,
    initial: settings.voiceVolume,
    onValue: function onValue(v,): void {
      updateSettings({ voiceVolume: v, },);
    },
  },);
  /** BGM-volume slider (background music level, reserved for future audio). */
  const bgmVolInput = range({
    min: 0,
    max: 1,
    step: 0.05,
    initial: settings.bgmVolume,
    onValue: function onValue(v,): void {
      updateSettings({ bgmVolume: v, },);
    },
  },);
  /** Auto-advance delay slider used by the lecture screen between beats. */
  const autoDelayInput = range({
    min: 0,
    max: 5_000,
    step: 100,
    initial: settings.autoAdvanceDelayMs,
    onValue: function onValue(v,): void {
      updateSettings({ autoAdvanceDelayMs: v, },);
    },
  },);

  /** Checkbox attributes, with `checked` set when voice is currently enabled. */
  const voiceToggleAttrs: Record<string, string> = { type: 'checkbox', };
  if (settings.voiceEnabled)
    voiceToggleAttrs['checked'] = 'checked';
  /** Voice-enabled checkbox; change event writes back to settings. */
  const voiceToggle = el(
    'input',
    voiceToggleAttrs,
  );
  voiceToggle.addEventListener(
    'change',
    function onChange(): void {
      updateSettings({ voiceEnabled: voiceToggle.checked, },);
    },
  );

  /** Provider `<select>` whose change event swaps the active provider id. */
  const providerSelect = el(
    'select',
    {},
    (
      [
        [
          'openrouter',
          ll.providerOpenrouter(),
        ],
        [
          'openai',
          ll.providerOpenai(),
        ],
        [
          'anthropic',
          ll.providerAnthropic(),
        ],
        [
          'ollama',
          ll.providerOllama(),
        ],
      ] as readonly (readonly [
        ProviderId,
        string,
      ])[]
    )
      .map(function toOption(
        [
          value,
          label,
        ],
      ): HTMLOptionElement {
        /** Option attributes, with `selected` set when the provider id matches. */
        const attrs: Record<string, string> = { value, };
        if (provider.id === value)
          attrs['selected'] = 'selected';
        return el(
          'option',
          attrs,
          [label,],
        );
      },),
  );
  providerSelect.addEventListener(
    'change',
    function onChange(): void {
      /** Newly chosen provider id, coerced back to the union to drop unknowns. */
      const next = coerceProviderId(
        providerSelect.value,
        provider.id,
      );
      updateProvider({ id: next, },);
      navigate('settings',);
    },
  );

  /** Model text input; input event writes the new model name to provider state. */
  const modelInput = el(
    'input',
    {
      type: 'text',
      value: provider.model,
    },
  );
  modelInput.addEventListener(
    'input',
    function onInput(): void {
      updateProvider({ model: modelInput.value, },);
    },
  );

  /** API-key password input; input event writes the new key to provider state. */
  const apiKeyInput = el(
    'input',
    {
      type: 'password',
      value: provider.apiKey,
      autocomplete: 'off',
    },
  );
  apiKeyInput.addEventListener(
    'input',
    function onInput(): void {
      updateProvider({ apiKey: apiKeyInput.value, },);
    },
  );

  /** Base-URL text input; input event writes the new URL to provider state. */
  const baseUrlInput = el(
    'input',
    {
      type: 'text',
      value: provider.baseUrl,
    },
  );
  baseUrlInput.addEventListener(
    'input',
    function onInput(): void {
      updateProvider({ baseUrl: baseUrlInput.value, },);
    },
  );

  /** Anthropic-specific opt-in nodes, populated only when that provider is active. */
  const anthropicWarningChildren: (Node | string)[] = [];
  if (provider.id === 'anthropic') {
    /** Checkbox attributes, with `checked` set when the warning was acknowledged. */
    const ackAttrs: Record<string, string> = { type: 'checkbox', };
    if (provider.acknowledgedAnthropicWarning)
      ackAttrs['checked'] = 'checked';
    /** Anthropic dangerous-browser-access acknowledgement checkbox. */
    const ackInput = el(
      'input',
      ackAttrs,
    );
    ackInput.addEventListener(
      'change',
      function onChange(): void {
        updateProvider(
          { acknowledgedAnthropicWarning: ackInput.checked, },
        );
      },
    );
    anthropicWarningChildren.push(
      hint(ll.anthropicWarning(),),
      el(
        'label',
        { class: 'row', },
        [
          ackInput,
          ll.anthropicAccept(),
        ],
      ),
    );
  }

  /** Outer screen container assembling header, fields, and provider section. */
  const screen = el(
    'section',
    {
      class: 'screen',
      'data-screen': 'settings',
    },
    [
      el(
        'header',
        { class: 'row', },
        [
          el(
            'button',
            {
              'data-variant': 'ghost',
              onclick: function go(): void {
                navigate('menu',);
              },
            },
            [ll.back(),],
          ),
          el(
            'h2',
            {},
            [ll.settings(),],
          ),
        ],
      ),
      field(
        ll.language(),
        langSelect,
        undefined,
      ),
      field(
        ll.fontSize(),
        fontInput,
        undefined,
      ),
      field(
        ll.textSpeed(),
        speedInput,
        undefined,
      ),
      field(
        ll.voiceVolume(),
        voiceVolInput,
        undefined,
      ),
      field(
        ll.bgmVolume(),
        bgmVolInput,
        undefined,
      ),
      field(
        ll.autoAdvanceDelay(),
        autoDelayInput,
        undefined,
      ),
      el(
        'label',
        { class: 'row', },
        [
          voiceToggle,
          ll.voiceEnabled(),
        ],
      ),
      el(
        'h2',
        {},
        [ll.provider(),],
      ),
      field(
        ll.provider(),
        providerSelect,
        undefined,
      ),
      field(
        ll.model(),
        modelInput,
        undefined,
      ),
      field(
        ll.apiKey(),
        apiKeyInput,
        ll.apiKeyHint(),
      ),
      field(
        ll.baseUrl(),
        baseUrlInput,
        ll.baseUrlHint(),
      ),
      ...anthropicWarningChildren,
    ],
  );
  root.append(screen,);
}

/** Registers the settings screen. */
export function registerSettings(): void {
  registerScreen(
    'settings',
    { mount, },
  );
}
