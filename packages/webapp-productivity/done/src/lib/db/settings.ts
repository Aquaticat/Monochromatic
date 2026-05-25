/**
 * Settings key-value store access layer.
 *
 * The `settings` table holds instance configuration as simple key-value pairs.
 * Keys are plain strings; values are stored as TEXT (callers JSON.stringify complex values).
 */
import db from '../db.ts';

/** Database row shape for the settings table. */
type SettingRow = {
  key: string;
  value: string;
};

/**
 * Retrieves a single setting by key.
 *
 * @param key - Setting identifier
 *
 * @returns Stored value, or `null` when the key does not exist
 *
 * @example
 * ```ts
 * const apiKey = await getSetting('openai-api-key');
 * ```
 */
export async function getSetting(key: string,): Promise<string | null> {
  /* oxlint-disable typescript/no-unsafe-type-assertion -- database query returns the SettingRow shape */
  /** Single-column projection from the settings table for the requested key. */
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?',)
    .get(key,) as
    | Pick<SettingRow, 'value'>
    | undefined;
  /* oxlint-enable typescript/no-unsafe-type-assertion */
  return row?.value
    ?? null;
}

/**
 * Upserts a setting: inserts the key if absent, replaces the value if present.
 *
 * @param key - Setting identifier
 *
 * @param value - Text payload to store
 *
 * @example
 * ```ts
 * await setSetting({ key: 'openai-api-key', value: 'sk-...', });
 * ```
 */
export async function setSetting({
  key,
  value,
}: {
  key: string;
  value: string;
},): Promise<void> {
  await db
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    )
    .run(
      key,
      value,
    );
}

/**
 * Deletes a setting by key.
 *
 * @param key - Setting identifier
 *
 * @returns `true` when the key existed and was removed
 *
 * @example
 * ```ts
 * const removed = await deleteSetting('openai-api-key');
 * ```
 */
export async function deleteSetting(key: string,): Promise<boolean> {
  /** Captures the run result so the caller can learn whether a row was actually removed. */
  const result = await db.prepare('DELETE FROM settings WHERE key = ?',)
    .run(key,);
  return result.changes
    > 0;
}

/**
 * Returns all settings as a key-value record.
 *
 * @returns All settings as key-value pairs
 *
 * @example
 * ```ts
 * const settings = await getAllSettings();
 * // { 'openai-api-key': 'sk-...', 'location': 'home' }
 * ```
 */
export async function getAllSettings(): Promise<Record<string, string>> {
  /* oxlint-disable typescript/no-unsafe-type-assertion -- database query returns SettingRow shape */
  /** Materialises the full settings table so callers receive a single snapshot record. */
  const rows = await db
    .prepare('SELECT key, value FROM settings ORDER BY key ASC',)
    .all() as SettingRow[];
  /* oxlint-enable typescript/no-unsafe-type-assertion */
  return Object.fromEntries(rows.map(function toEntry(row,) {
    return [
      row.key,
      row.value,
    ];
  },),);
}
