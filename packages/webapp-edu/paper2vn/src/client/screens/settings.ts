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
  const ll = LL();
  const settings = getSettings();
  const provider = getProvider();

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
  const speedInput = range({
    min: 10,
    max: 120,
    step: 5,
    initial: settings.textSpeed,
    onValue: function onValue(v,): void {
      updateSettings({ textSpeed: v, },);
    },
  },);
  const voiceVolInput = range({
    min: 0,
    max: 1,
    step: 0.05,
    initial: settings.voiceVolume,
    onValue: function onValue(v,): void {
      updateSettings({ voiceVolume: v, },);
    },
  },);
  const bgmVolInput = range({
    min: 0,
    max: 1,
    step: 0.05,
    initial: settings.bgmVolume,
    onValue: function onValue(v,): void {
      updateSettings({ bgmVolume: v, },);
    },
  },);
  const autoDelayInput = range({
    min: 0,
    max: 5_000,
    step: 100,
    initial: settings.autoAdvanceDelayMs,
    onValue: function onValue(v,): void {
      updateSettings({ autoAdvanceDelayMs: v, },);
    },
  },);

  const voiceToggleAttrs: Record<string, string> = { type: 'checkbox', };
  if (settings.voiceEnabled)
    voiceToggleAttrs['checked'] = 'checked';
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
      const next = coerceProviderId(
        providerSelect.value,
        provider.id,
      );
      updateProvider({ id: next, },);
      navigate('settings',);
    },
  );

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

  const anthropicWarningChildren: (Node | string)[] = [];
  if (provider.id === 'anthropic') {
    const ackAttrs: Record<string, string> = { type: 'checkbox', };
    if (provider.acknowledgedAnthropicWarning)
      ackAttrs['checked'] = 'checked';
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
