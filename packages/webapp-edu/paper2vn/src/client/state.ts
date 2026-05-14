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

/** Reads JSON from localStorage and parses, returning fallback on any failure. */
function readJson<T,>(
  key: string,
  fallback: T,
): T {
  try {
    const raw = globalThis.localStorage.getItem(key,);
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

/** Writes JSON to localStorage, logging and continuing on quota/security failures. */
function writeJson(
  key: string,
  value: unknown,
): void {
  try {
    globalThis.localStorage.setItem(
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

/** Removes a key from localStorage; ignores failures. */
function removeKey(key: string,): void {
  try {
    globalThis.localStorage.removeItem(key,);
  }
  catch (err) {
    console.error(
      '[state] failed to remove',
      key,
      err,
    );
  }
}

/** Listener notified after any state mutation. */
type Listener = () => void;

/** Subscribers of {@link onChange}. */
const listeners = new Set<Listener>();

/** Notifies every subscriber. Errors in one listener do not stop others. */
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
 */
export function onChange(fn: Listener,): () => void {
  listeners.add(fn,);
  return function unsubscribe(): void {
    listeners.delete(fn,);
  };
}

/** Current settings snapshot. */
let settings: Settings = {
  ...DEFAULT_SETTINGS,
  ...readJson<Partial<Settings>>(
    STORAGE_KEY_SETTINGS,
    {},
  ),
};

/** Current provider config snapshot. */
let provider: ProviderConfig = {
  ...DEFAULT_PROVIDER,
  ...readJson<Partial<ProviderConfig>>(
    STORAGE_KEY_PROVIDER,
    {},
  ),
};

/** Save slots index. */
let saves: readonly SaveSummary[] = readJson<readonly SaveSummary[]>(
  STORAGE_KEY_SAVES,
  [],
);

/** Save id of the active save, when one is loaded. */
let activeSaveId: string | undefined;

/** Active save payload, materialized when loaded from storage or just created. */
let activeSave: SaveData | undefined;

/** Returns the current settings (read-only snapshot). */
export function getSettings(): Settings {
  return settings;
}

/**
 * Updates settings and persists.
 *
 * @param patch - partial settings to merge over current values
 */
export function updateSettings(patch: Partial<Settings>,): void {
  settings = {
    ...settings,
    ...patch,
  };
  writeJson(
    STORAGE_KEY_SETTINGS,
    settings,
  );
  emit();
}

/** Returns current provider configuration. */
export function getProvider(): ProviderConfig {
  return provider;
}

/** Updates provider config and persists. */
export function updateProvider(patch: Partial<ProviderConfig>,): void {
  provider = {
    ...provider,
    ...patch,
  };
  writeJson(
    STORAGE_KEY_PROVIDER,
    provider,
  );
  emit();
}

/** Returns the current saves index (read-only). */
export function getSaves(): readonly SaveSummary[] {
  return saves;
}

/** Returns the active save when one is loaded. */
export function getActiveSave(): SaveData | undefined {
  return activeSave;
}

/** Sets the active save in memory; does not write through to disk yet. */
export function setActiveSave(save: SaveData,): void {
  activeSave = save;
  activeSaveId = save.id;
  emit();
}

/** Clears the active save (does not delete the persisted slot). */
export function clearActiveSave(): void {
  activeSave = undefined;
  activeSaveId = undefined;
  emit();
}

/**
 * Persists the active save to storage and updates the saves index.
 *
 * No-op when no save is active.
 */
export function persistActiveSave(): void {
  if (activeSave === undefined)
    return;
  const updated: SaveData = {
    ...activeSave,
    updatedAt: new Date().toISOString(),
  };
  activeSave = updated;
  writeJson(
    `${STORAGE_KEY_SAVE_PREFIX}${updated.id}`,
    updated,
  );
  const summary: SaveSummary = {
    id: updated.id,
    label: updated.label,
    paperTitle: updated.paperTitle,
    updatedAt: updated.updatedAt,
  };
  const next = saves.filter(function isOther(s,): boolean {
    return s.id !== updated.id;
  },);
  saves = [
    summary,
    ...next,
  ];
  writeJson(
    STORAGE_KEY_SAVES,
    saves,
  );
  emit();
}

/**
 * Loads a save by id.
 *
 * @param id - save id from {@link SaveSummary}
 *
 * @returns the loaded save, or `undefined` when not found
 */
export function loadSave(id: string,): SaveData | undefined {
  const data = readJson<SaveData | null>(
    `${STORAGE_KEY_SAVE_PREFIX}${id}`,
    null,
  );
  if (data === null)
    return undefined;
  activeSave = data;
  activeSaveId = data.id;
  emit();
  return data;
}

/**
 * Deletes a save slot.
 *
 * @param id - save id to remove
 */
export function deleteSave(id: string,): void {
  removeKey(`${STORAGE_KEY_SAVE_PREFIX}${id}`,);
  saves = saves.filter(function isOther(s,): boolean {
    return s.id !== id;
  },);
  writeJson(
    STORAGE_KEY_SAVES,
    saves,
  );
  if (activeSaveId === id)
    clearActiveSave();
  emit();
}

/**
 * Mutates the active save in memory (does not persist).
 *
 * @param patch - partial save fields to merge
 */
export function patchActiveSave(patch: Partial<SaveData>,): void {
  if (activeSave === undefined)
    return;
  activeSave = {
    ...activeSave,
    ...patch,
  };
  emit();
}
