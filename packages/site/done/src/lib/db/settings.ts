/**
 * Settings key-value store access layer.
 *
 * The `settings` table holds instance configuration as simple key-value pairs.
 * Keys are plain strings; values are stored as TEXT (callers JSON.stringify complex values).
 */
import db from "../db.ts";

type SettingRow = {
  key: string;
  value: string;
};

/**
 * Retrieves a single setting by key.
 * @param key - Setting identifier
 * @returns Stored value, or `null` when the key does not exist
 */
export function getSetting(key: string): string | null {
  const row = db.query("SELECT value FROM settings WHERE key = ?").get(key) as Pick<SettingRow, "value"> | null;
  return row === null ? null : row.value;
}

/**
 * Upserts a setting — inserts the key if absent, replaces the value if present.
 * @param key - Setting identifier
 * @param value - Text payload to store
 */
export function setSetting(key: string, value: string): void {
  db.query("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    key,
    value
  );
}

/**
 * Deletes a setting by key.
 * @param key - Setting identifier
 * @returns `true` when the key existed and was removed
 */
export function deleteSetting(key: string): boolean {
  const result = db.query("DELETE FROM settings WHERE key = ?").run(key);
  return result.changes > 0;
}

/**
 * Returns all settings as a key-value record.
 */
export function getAllSettings(): Record<string, string> {
  const rows = db.query("SELECT key, value FROM settings ORDER BY key ASC").all() as SettingRow[];
  const settingsRecord: Record<string, string> = {};
  rows.forEach((row) => {
    settingsRecord[row.key] = row.value;
  });
  return settingsRecord;
}
