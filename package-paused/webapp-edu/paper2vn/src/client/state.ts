/**
 * State store for paper2vn.
 *
 * Holds settings, provider config, save index, and the active save.
 * Persists to localStorage on every mutation. A small subscriber list
 * notifies screens when state changes.
 *
 * Storage failures (quota, blocked storage) are logged and silently
 * downgraded to in-memory only; the app keeps working without
 * persistence rather than crashing.
 */
import {
  STORAGE_KEY_PROVIDER,
  STORAGE_KEY_SAVE_PREFIX,
  STORAGE_KEY_SAVES,
  STORAGE_KEY_SETTINGS,
} from './storage-keys.ts';
import type {
  ProviderConfig,
  SaveData,
  SaveSummary,
  Settings,
} from './types.ts';

/**
 * Default settings applied when nothing is persisted yet.
 *
 * Text-speed default of 40 chars/second matches the original's
 * mid-tier feel; auto delay of 1.6 seconds matches its UI label.
 */
const DEFAULT_SETTINGS: Settings = {
  locale: 'en',
  fontScale: 1,
  textSpeed: 40,
  voiceVolume: 0.3,
  bgmVolume: 0.3,
  autoAdvanceDelayMs: 1_600,
  autoAdvanceByVoice: false,
  voiceEnabled: false,
};

/**
 * Default provider configuration: OpenRouter is the safest CORS-permissive
 * option, with no key configured until the user pastes one.
 */
const DEFAULT_PROVIDER: ProviderConfig = {
  id: 'openrouter',
  model: 'anthropic/claude-haiku-4.5',
  apiKey: '',
  baseUrl: '',
  acknowledgedAnthropicWarning: false,
};

/**
 * Reads JSON from localStorage and parses, returning fallback on any failure.
 *
 * @param key - localStorage key to read
 *
 * @param fallback - value returned when the key is missing or parse fails
 *
 * @returns the parsed value, or `fallback` on any failure
 *
 * @example
 * ```ts
 * const settings = readJson({ key: 'settings', fallback: DEFAULT_SETTINGS });
 * ```
 */
function readJson<T,>(
  {
    key,
    fallback,
  }: Readonly<{
    key: string;
    fallback: T;
  }>,
): T {
  try {
    /**
     * Raw stored JSON string, or `null` when the key is missing.
     */
    const raw = globalThis.localStorage
      .getItem(key,);
    if (raw === null)
      return fallback;
    /*
     * Trust boundary: localStorage is user-controlled. Callers either
     * spread over a typed default (settings, provider) or treat the
     * result as a list/map of typed records validated downstream.
     * Validating every shape at this seam would duplicate the type
     * declarations; bad data falls through to the typed-spread defaults
     * or shows up as missing fields the UI tolerates.
     */
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    return JSON.parse(raw,) as T;
  }
  catch (err) {
    console.error(
      '[state] failed to read',
      key,
      err,
    );
    return fallback;
  }
}

/**
 * Writes JSON to localStorage, logging and continuing on quota/security failures.
 *
 * @param key - localStorage key to write
 *
 * @param value - JSON-serialisable value
 *
 * @example
 * ```ts
 * writeJson({ key: 'settings', value: nextSettings });
 * ```
 */
function writeJson(
  {
    key,
    value,
  }: Readonly<{
    key: string;
    value: unknown;
  }>,
): void {
  try {
    globalThis.localStorage
      .setItem(
      key,
      JSON.stringify(value,),
    );
  }
  catch (err) {
    console.error(
      '[state] failed to write',
      key,
      err,
    );
  }
}

/**
 * Removes a key from localStorage; ignores failures.
 *
 * @param key - localStorage key to remove
 */
function removeKey(key: string,): void {
  try {
    globalThis.localStorage
      .removeItem(key,);
  }
  catch (err) {
    console.error(
      '[state] failed to remove',
      key,
      err,
    );
  }
}

/**
 * Listener notified after any state mutation.
 */
type Listener = () => void;

/**
 * Subscribers of {@link onChange}.
 */
const listeners = new Set<Listener>();

/**
 * Notifies every subscriber. Errors in one listener do not stop others.
 */
function emit(): void {
  for (const fn of listeners) {
    try {
      fn();
    }
    catch (err) {
      console.error(
        '[state] listener threw',
        err,
      );
    }
  }
}

/**
 * Subscribes to state mutations.
 *
 * @param fn - listener invoked synchronously after each mutation
 *
 * @returns unsubscribe function
 *
 * @example
 * ```ts
 * const off = onChange(function refresh(): void {
 *   render();
 * });
 * // later, on teardown:
 * off();
 * ```
 */
export function onChange(fn: Listener,): () => void {
  listeners.add(fn,);
  return function unsubscribe(): void {
    listeners.delete(fn,);
  };
}

/**
 * Mutable in-memory state container.
 *
 * Held inside a single `const` so individual fields can be reassigned
 * without violating `no-module-root-let`.
 */
const store: {
  /**
   * Current settings snapshot.
   */
  settings: Settings;
  /**
   * Current provider config snapshot.
   */
  provider: ProviderConfig;
  /**
   * Save slots index.
   */
  saves: readonly SaveSummary[];
  /**
   * Save id of the active save, when one is loaded.
   */
  activeSaveId: string | undefined;
  /**
   * Active save payload, materialized when loaded from storage or just created.
   */
  activeSave: SaveData | undefined;
} = {
  settings: {
    ...DEFAULT_SETTINGS,
    ...readJson<Partial<Settings>>({
      key: STORAGE_KEY_SETTINGS,
      fallback: {},
    },),
  },
  provider: {
    ...DEFAULT_PROVIDER,
    ...readJson<Partial<ProviderConfig>>({
      key: STORAGE_KEY_PROVIDER,
      fallback: {},
    },),
  },
  saves: readJson<readonly SaveSummary[]>({
    key: STORAGE_KEY_SAVES,
    fallback: [],
  },),
  activeSaveId: undefined,
  activeSave: undefined,
};

/**
 * Returns the current settings (read-only snapshot).
 *
 * @returns the live settings object
 *
 * @example
 * ```ts
 * const { textSpeed } = getSettings();
 * ```
 */
export function getSettings(): Settings {
  return store.settings;
}

/**
 * Updates settings and persists.
 *
 * @param patch - partial settings to merge over current values
 *
 * @example
 * ```ts
 * updateSettings({ voiceEnabled: true });
 * ```
 */
export function updateSettings(patch: Partial<Settings>,): void {
  store.settings = {
    ...store.settings,
    ...patch,
  };
  writeJson({
    key: STORAGE_KEY_SETTINGS,
    value: store.settings,
  },);
  emit();
}

/**
 * Returns current provider configuration.
 *
 * @returns the live provider config object
 *
 * @example
 * ```ts
 * if (getProvider().apiKey === '') showSettingsScreen();
 * ```
 */
export function getProvider(): ProviderConfig {
  return store.provider;
}

/**
 * Updates provider config and persists.
 *
 * @param patch - partial provider fields to merge
 *
 * @example
 * ```ts
 * updateProvider({ id: 'anthropic', apiKey: 'sk-...' });
 * ```
 */
export function updateProvider(patch: Partial<ProviderConfig>,): void {
  store.provider = {
    ...store.provider,
    ...patch,
  };
  writeJson({
    key: STORAGE_KEY_PROVIDER,
    value: store.provider,
  },);
  emit();
}

/**
 * Returns the current saves index (read-only).
 *
 * @returns the live array of save summaries
 *
 * @example
 * ```ts
 * for (const summary of getSaves()) console.error(summary.label);
 * ```
 */
export function getSaves(): readonly SaveSummary[] {
  return store.saves;
}

/**
 * Returns the active save when one is loaded.
 *
 * @returns the active save, or `undefined` when no save is loaded
 *
 * @example
 * ```ts
 * const save = getActiveSave();
 * if (save === undefined) navigate('menu');
 * ```
 */
export function getActiveSave(): SaveData | undefined {
  return store.activeSave;
}

/**
 * Sets the active save in memory; does not write through to disk yet.
 *
 * @param save - save payload to mark active
 *
 * @example
 * ```ts
 * setActiveSave(freshlyCreatedSave);
 * navigate('lecture');
 * ```
 */
export function setActiveSave(save: SaveData,): void {
  store.activeSave = save;
  store.activeSaveId = save.id;
  emit();
}

/**
 * Clears the active save (does not delete the persisted slot).
 *
 * @example
 * ```ts
 * clearActiveSave();
 * navigate('menu');
 * ```
 */
export function clearActiveSave(): void {
  store.activeSave = undefined;
  store.activeSaveId = undefined;
  emit();
}

/**
 * Persists the active save to storage and updates the saves index.
 *
 * No-op when no save is active.
 *
 * @example
 * ```ts
 * patchActiveSave({ beatIndex: live.beatIndex + 1 });
 * persistActiveSave();
 * ```
 */
export function persistActiveSave(): void {
  if (store.activeSave
    === undefined)
    return;
  /**
   * Active save with refreshed `updatedAt` so the persisted copy reflects the write.
   */
  const updated: SaveData = {
    ...store.activeSave,
    updatedAt: new Date().toISOString(),
  };
  store.activeSave = updated;
  writeJson({
    key: `${STORAGE_KEY_SAVE_PREFIX}${updated.id}`,
    value: updated,
  },);
  /**
   * Index entry rebuilt from `updated` so listings stay current.
   */
  const summary: SaveSummary = {
    id: updated.id,
    label: updated.label,
    paperTitle: updated.paperTitle,
    updatedAt: updated.updatedAt,
  };
  /**
   * Existing index minus the entry being replaced.
   */
  const next = store.saves
    .filter(function isOther(s: Readonly<SaveSummary>,): boolean {
    return s.id
      !== updated
      .id;
  },);
  store.saves = [
    summary,
    ...next,
  ];
  writeJson({
    key: STORAGE_KEY_SAVES,
    value: store.saves,
  },);
  emit();
}

/**
 * Loads a save by id.
 *
 * @param id - save id from {@link SaveSummary}
 *
 * @returns the loaded save, or `undefined` when not found
 *
 * @example
 * ```ts
 * const save = loadSave(summary.id);
 * if (save !== undefined) navigate('lecture');
 * ```
 */
export function loadSave(id: string,): SaveData | undefined {
  /**
   * Loaded save payload, or `null` when the storage key is absent.
   */
  const data = readJson<SaveData | null>({
    key: `${STORAGE_KEY_SAVE_PREFIX}${id}`,
    fallback: null,
  },);
  if (data === null)
    return undefined;
  store.activeSave = data;
  store.activeSaveId = data.id;
  emit();
  return data;
}

/**
 * Deletes a save slot.
 *
 * @param id - save id to remove
 *
 * @example
 * ```ts
 * deleteSave('save-2026-05-14');
 * ```
 */
export function deleteSave(id: string,): void {
  removeKey(`${STORAGE_KEY_SAVE_PREFIX}${id}`,);
  store.saves = store.saves
    .filter(function isOther(s: Readonly<SaveSummary>,): boolean {
    return s.id
      !== id;
  },);
  writeJson({
    key: STORAGE_KEY_SAVES,
    value: store.saves,
  },);
  if (store.activeSaveId
    === id)
    clearActiveSave();
  emit();
}

/**
 * Mutates the active save in memory (does not persist).
 *
 * @param patch - partial save fields to merge
 *
 * @example
 * ```ts
 * patchActiveSave({ beatIndex: live.beatIndex + 1 });
 * ```
 */
export function patchActiveSave(patch: Partial<SaveData>,): void {
  if (store.activeSave
    === undefined)
    return;
  store.activeSave = {
    ...store.activeSave,
    ...patch,
  };
  emit();
}
