/**
 * Identity selection persistence.
 *
 * When `localStorage` is available, the user's last-selected identity
 * survives reloads. Otherwise we fall back to whatever the server
 * rendered as the dropdown's first option.
 */

/** localStorage key holding the persisted identity. */
const IDENTITY_KEY = 'messages-demo:identity';

/**
 * Loads the persisted identity, or `null` when none is stored or when
 * `localStorage` is unavailable / failing.
 *
 * @param available - whether the storage probe succeeded
 *
 * @returns persisted identity or `null`
 *
 * @example
 * ```ts
 * const identity = loadIdentity(caps.localStorage);
 * ```
 */
export function loadIdentity(available: boolean,): string | null {
  if (!available)
    return null;
  try {
    return localStorage.getItem(IDENTITY_KEY,);
  }
  catch {
    return null;
  }
}

/**
 * Persists the user's identity selection. Silently no-ops when
 * `localStorage` is unavailable, the write throws, or the value is
 * empty.
 *
 * @param identity - user id from the dropdown
 *
 * @param available - whether the storage probe succeeded
 *
 * @example
 * ```ts
 * saveIdentity('user-a', caps.localStorage);
 * ```
 */
export function saveIdentity(
  identity: string,
  available: boolean,
): void {
  if (!available || identity === '')
    return;
  try {
    localStorage.setItem(
      IDENTITY_KEY,
      identity,
    );
  }
  catch {
    // Quota exceeded or write blocked; silently degrade.
  }
}
