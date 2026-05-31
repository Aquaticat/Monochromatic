/**
 * Shared types for paper2vn client.
 *
 * Persisted shapes live here too so migrations have one place to land.
 */

/**
 * Supported UI / persona language codes.
 */
export type Locale = 'en' | 'zh' | 'ja' | 'ru';

/**
 * Speaker pose key, indexed against the active sprite pack.
 */
export type Pose = 'neutral' | 'thinking' | 'happy';

/**
 * A single beat of dialogue spoken by the persona.
 */
export type DialogueBeat = {
  /**
   * Display text shown in the dialogue box.
   */
  text: string;

  /**
   * Pose to show during this beat. Defaults to `neutral` when omitted.
   */
  pose?: Pose;
};

/**
 * A generated chapter: one logical section of the paper.
 */
export type Chapter = {
  /**
   * Chapter title, displayed as a card before the first beat.
   */
  title: string;

  /**
   * Short prose summary, shown on the chapter card.
   */
  summary: string;

  /**
   * Ordered list of dialogue beats.
   */
  dialogue: readonly DialogueBeat[];
};

/**
 * Memory log entry shown on the Log screen.
 */
export type LogEntry = {
  /**
   * Speaker label (`Ruka` or `You`).
   */
  speaker: 'persona' | 'user';

  /**
   * Text content.
   */
  text: string;
};

/**
 * App-wide settings persisted to localStorage.
 */
export type Settings = {
  /**
   * UI + persona language.
   */
  locale: Locale;

  /**
   * Font scale multiplier (e.g. `1` = 100%).
   */
  fontScale: number;

  /**
   * Characters per second for the typewriter reveal.
   */
  textSpeed: number;

  /**
   * Web Speech volume between `0` and `1`.
   */
  voiceVolume: number;

  /**
   * BGM volume between `0` and `1` (BGM not implemented in MVP).
   */
  bgmVolume: number;

  /**
   * Auto-advance delay in milliseconds.
   */
  autoAdvanceDelayMs: number;

  /**
   * When `true`, auto mode advances after voice finishes.
   */
  autoAdvanceByVoice: boolean;

  /**
   * Whether to speak dialogue aloud.
   */
  voiceEnabled: boolean;
};

/**
 * Identifier for a configured LLM provider.
 */
export type ProviderId = 'openrouter' | 'openai' | 'anthropic' | 'ollama';

/**
 * Runtime list of valid {@link Locale} values for narrowing helpers.
 */
export const LOCALE_VALUES: readonly Locale[] = [
  'en',
  'zh',
  'ja',
  'ru',
];

/**
 * Runtime list of valid {@link ProviderId} values for narrowing helpers.
 */
export const PROVIDER_ID_VALUES: readonly ProviderId[] = [
  'openrouter',
  'openai',
  'anthropic',
  'ollama',
];

/**
 * Narrows an arbitrary string to {@link Locale}, returning the
 * fallback when the value is not a known locale.
 *
 * @param value - candidate string
 *
 * @param fallback - locale to return when `value` is not recognized
 *
 * @returns a valid `Locale`
 *
 * @example
 * ```ts
 * coerceLocale({ value: 'en', fallback: 'en' }); // 'en'
 * coerceLocale({ value: 'xx', fallback: 'en' }); // 'en'
 * ```
 */
export function coerceLocale(
  {
    value,
    fallback,
  }: Readonly<{
    value: string;
    fallback: Locale;
  }>,
): Locale {
  for (const candidate of LOCALE_VALUES) {
    if (candidate === value)
      return candidate;
  }
  return fallback;
}

/**
 * Narrows an arbitrary string to {@link ProviderId}, returning the
 * fallback when the value is not a known provider.
 *
 * @param value - candidate string
 *
 * @param fallback - provider id to return when `value` is not recognized
 *
 * @returns a valid `ProviderId`
 *
 * @example
 * ```ts
 * coerceProviderId({ value: 'openai', fallback: 'openrouter' }); // 'openai'
 * coerceProviderId({ value: '???',    fallback: 'openrouter' }); // 'openrouter'
 * ```
 */
export function coerceProviderId(
  {
    value,
    fallback,
  }: Readonly<{
    value: string;
    fallback: ProviderId;
  }>,
): ProviderId {
  for (const candidate of PROVIDER_ID_VALUES) {
    if (candidate === value)
      return candidate;
  }
  return fallback;
}

/**
 * Provider configuration persisted to localStorage.
 */
export type ProviderConfig = {
  /**
   * Active provider.
   */
  id: ProviderId;

  /**
   * Model identifier within the provider.
   */
  model: string;

  /**
   * API key when applicable. Stored in plain text in localStorage.
   */
  apiKey: string;

  /**
   * Base URL override (used by Ollama, optional for others).
   */
  baseUrl: string;

  /**
   * When `true`, the user has opted in to Anthropic's dangerous-browser flag.
   */
  acknowledgedAnthropicWarning: boolean;
};

/**
 * Save slot summary stored in the saves index.
 */
export type SaveSummary = {
  /**
   * Stable id, also used in the storage key.
   */
  id: string;

  /**
   * User-editable label.
   */
  label: string;

  /**
   * Paper title from the LLM response.
   */
  paperTitle: string;

  /**
   * ISO timestamp of last update.
   */
  updatedAt: string;
};

/**
 * Full save payload stored under `STORAGE_KEY_SAVE_PREFIX${id}`.
 */
export type SaveData = SaveSummary & {
  /**
   * Raw extracted paper text (used for the Ask flow).
   */
  paperText: string;

  /**
   * Generated chapters.
   */
  chapters: readonly Chapter[];

  /**
   * Currently displayed chapter index.
   */
  chapterIndex: number;

  /**
   * Currently displayed beat index within the chapter.
   */
  beatIndex: number;

  /**
   * Memory log of every persona/user line so far.
   */
  log: readonly LogEntry[];
};
