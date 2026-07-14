/**
 * Helpers and named constants for the settings screen.
 *
 * Hosts the `hint` / `field` / `range` element factories and lifts the
 * settings-screen magic numbers (slider bounds, steps) into named
 * constants so `screens/settings.ts` stays under the max-lines cap.
 */
import { el, } from '../dom.ts';
import type {
  Locale,
  ProviderConfig,
  ProviderId,
} from '../types.ts';

/**
 * Minimum font-scale slider value.
 */
export const FONT_SCALE_MIN = 0.75;

/**
 * Maximum font-scale slider value.
 */
export const FONT_SCALE_MAX = 1.5;

/**
 * Font-scale slider step.
 */
export const FONT_SCALE_STEP = 0.05;

/**
 * Minimum text-speed slider value (chars per second).
 */
export const TEXT_SPEED_MIN = 10;

/**
 * Maximum text-speed slider value (chars per second).
 */
export const TEXT_SPEED_MAX = 120;

/**
 * Text-speed slider step.
 */
export const TEXT_SPEED_STEP = 5;

/**
 * Volume slider step (used for both voice and BGM).
 */
export const VOLUME_STEP = 0.05;

/**
 * Maximum auto-advance delay in milliseconds.
 */
export const AUTO_DELAY_MAX_MS = 5_000;

/**
 * Auto-advance delay slider step in milliseconds.
 */
export const AUTO_DELAY_STEP_MS = 100;

/**
 * Inline-styled hint paragraph.
 *
 * @param text - hint copy
 *
 * @returns paragraph element with the `muted` class
 *
 * @example
 * ```ts
 * const p = hint('API key stored locally.');
 * ```
 */
export function hint(text: string,): HTMLElement {
  return el({
    tag: 'p',
    attrs: { class: 'muted', },
    children: [text,],
  },);
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
 * @returns field container with a `.field` class
 *
 * @example
 * ```ts
 * const row = field({ label: 'Language', control: langSelect, hintText: undefined });
 * ```
 */
export function field(
  {
    label,
    control,
    hintText,
  }: {
    label: string;
    control: HTMLElement;
    hintText: string | undefined;
  },
): HTMLElement {
  /**
   * Field children built up with the optional hint paragraph.
   */
  const children: (Node | string)[] = [
    el({
      tag: 'label',
      attrs: {},
      children: [label,],
    },),
    control,
  ];
  if (hintText !== undefined)
    children.push(hint(hintText,),);
  return el({
    tag: 'div',
    attrs: { class: 'field', },
    children,
  },);
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
 * @returns range input element wired to call `onValue` on every event
 *
 * @example
 * ```ts
 * const r = range({
 *   min: 0,
 *   max: 1,
 *   step: 0.1,
 *   initial: 0.5,
 *   onValue: function emit(v): void { console.error('volume', v); },
 * });
 * ```
 */
export function range(
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
  /**
   * Slider input wired to fire {@link onValue} with the coerced number.
   */
  const input = el({
    tag: 'input',
    attrs: {
      type: 'range',
      min: String(min,),
      max: String(max,),
      step: String(step,),
      value: String(initial,),
    },
  },);
  input.addEventListener(
    'input',
    function onInput(): void {
      onValue(Number(input.value,),);
    },
  );
  return input;
}

/**
 * Builds the language `<select>` element with the four supported locales.
 *
 * @param activeLocale - locale to mark `selected` in the rendered options
 *
 * @returns `<select>` populated with one option per supported locale
 *
 * @example
 * ```ts
 * const sel = languageSelect('en');
 * sel.addEventListener('change', applyLocale);
 * ```
 */
export function languageSelect(activeLocale: Locale,): HTMLSelectElement {
  /**
   * Locale code paired with its native-language display label.
   */
  const entries: readonly (readonly [
    Locale,
    string,
  ])[] = [
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
  ];
  return el({
    tag: 'select',
    attrs: {},
    children: entries.map(function toOption(
      [
        value,
        label,
      ],
    ): HTMLOptionElement {
      /**
       * Option attributes, with `selected` set when the locale matches.
       */
      const attrs: Record<string, string> = { value, };
      if (activeLocale === value)
        attrs.selected = 'selected';
      return el({
        tag: 'option',
        attrs,
        children: [label,],
      },);
    },),
  },);
}

/**
 * Builds the provider `<select>` element with translated labels.
 *
 * @param activeProvider - provider id to mark `selected` in the rendered options
 *
 * @param labels - translated labels for each provider id, in their order of appearance
 *
 * @returns `<select>` populated with one option per provider
 *
 * @example
 * ```ts
 * const sel = providerSelect('openai', {
 *   openrouter: ll.providerOpenrouter(),
 *   openai:     ll.providerOpenai(),
 *   anthropic:  ll.providerAnthropic(),
 *   ollama:     ll.providerOllama(),
 * });
 * ```
 */
export function providerSelect(
  {
    activeProvider,
    labels,
  }: Readonly<{
    activeProvider: ProviderId;
    labels: Readonly<Record<ProviderId, string>>;
  }>,
): HTMLSelectElement {
  /**
   * Provider id paired with the locale-translated label for the option text.
   */
  const entries: readonly (readonly [
    ProviderId,
    string,
  ])[] = [
    [
      'openrouter',
      labels.openrouter,
    ],
    [
      'openai',
      labels.openai,
    ],
    [
      'anthropic',
      labels.anthropic,
    ],
    [
      'ollama',
      labels.ollama,
    ],
  ];
  return el({
    tag: 'select',
    attrs: {},
    children: entries.map(function toOption(
      [
        value,
        label,
      ],
    ): HTMLOptionElement {
      /**
       * Option attributes, with `selected` set when the provider id matches.
       */
      const attrs: Record<string, string> = { value, };
      if (activeProvider === value)
        attrs.selected = 'selected';
      return el({
        tag: 'option',
        attrs,
        children: [label,],
      },);
    },),
  },);
}

/**
 * Builds a labelled `<input>` element of type text or password and wires
 * an `input` listener that forwards the new value.
 *
 * @param type - `'text'` for plaintext or `'password'` for hidden input
 *
 * @param initial - value to seed the field with
 *
 * @param autocomplete - optional `autocomplete` attribute
 *
 * @param onValue - listener invoked with the new value on every `input` event
 *
 * @returns the wired input element
 *
 * @example
 * ```ts
 * const apiKey = providerInput({
 *   type: 'password',
 *   initial: provider.apiKey,
 *   autocomplete: 'off',
 *   onValue: function save(v): void { updateProvider({ apiKey: v }); },
 * });
 * ```
 */
export function providerInput(
  {
    type,
    initial,
    autocomplete,
    onValue,
  }: {
    type: 'text' | 'password';
    initial: string;
    autocomplete: string | undefined;
    onValue: (value: string,) => void;
  },
): HTMLInputElement {
  /**
   * Input attribute bag built up before construction.
   */
  const attrs: Record<string, string> = {
    type,
    value: initial,
  };
  if (autocomplete !== undefined)
    attrs.autocomplete = autocomplete;
  /**
   * Configured input element wired to forward its current value.
   */
  const input = el({
    tag: 'input',
    attrs,
  },);
  input.addEventListener(
    'input',
    function onInput(): void {
      onValue(input.value,);
    },
  );
  return input;
}

/**
 * Builds a `<input type="checkbox">` element wired to a change listener.
 *
 * @param initial - whether the box is checked at mount time
 *
 * @param onChange - listener invoked with the new boolean on every change
 *
 * @returns the wired checkbox element
 *
 * @example
 * ```ts
 * const voiceToggle = checkbox({
 *   initial: settings.voiceEnabled,
 *   onChange: function save(v): void { updateSettings({ voiceEnabled: v }); },
 * });
 * ```
 */
export function checkbox(
  {
    initial,
    onChange,
  }: {
    initial: boolean;
    onChange: (value: boolean,) => void;
  },
): HTMLInputElement {
  /**
   * Checkbox attributes; `checked` is added only when `initial` is true.
   */
  const attrs: Record<string, string> = { type: 'checkbox', };
  if (initial)
    attrs.checked = 'checked';
  /**
   * Configured checkbox wired to forward its current `checked` value.
   */
  const input = el({
    tag: 'input',
    attrs,
  },);
  input.addEventListener(
    'change',
    function onChangeHandler(): void {
      onChange(input.checked,);
    },
  );
  return input;
}

/**
 * Builds the Anthropic dangerous-browser-access opt-in nodes, or an empty
 * array when the active provider is not Anthropic.
 *
 * @param provider - current provider config snapshot
 *
 * @param warningText - localised warning text
 *
 * @param acceptText - localised accept-checkbox label
 *
 * @param onAcknowledge - listener called when the checkbox is toggled
 *
 * @returns ordered node list with the warning hint and the accept row
 *
 * @example
 * ```ts
 * const nodes = anthropicWarningNodes({
 *   provider,
 *   warningText: ll.anthropicWarning(),
 *   acceptText: ll.anthropicAccept(),
 *   onAcknowledge: function save(v): void {
 *     updateProvider({ acknowledgedAnthropicWarning: v });
 *   },
 * });
 * ```
 */
export function anthropicWarningNodes(
  {
    provider,
    warningText,
    acceptText,
    onAcknowledge,
  }: {
    provider: Pick<
      ProviderConfig,
      'id' | 'acknowledgedAnthropicWarning'
    >;
    warningText: string;
    acceptText: string;
    onAcknowledge: (value: boolean,) => void;
  },
): (Node | string)[] {
  if (provider.id
    !== 'anthropic')
    return [];
  /**
   * Acknowledgement checkbox writing back to provider state on change.
   */
  const ackInput = checkbox({
    initial: provider.acknowledgedAnthropicWarning,
    onChange: onAcknowledge,
  },);
  return [
    hint(warningText,),
    el({
      tag: 'label',
      attrs: { class: 'row', },
      children: [
        ackInput,
        acceptText,
      ],
    },),
  ];
}
