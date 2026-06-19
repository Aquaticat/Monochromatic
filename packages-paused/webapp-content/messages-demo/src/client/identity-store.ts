/**
 * Identity selection persistence.
 *
 * When `localStorage` is available, the user's last-selected identity
 * survives reloads. Otherwise we fall back to whatever the server
 * rendered as the dropdown's first option.
 */

/**
 * localStorage key holding the persisted identity.
 */
const IDENTITY_KEY = 'messages-demo:identity';

/**
 * Sentinel returned by `loadIdentity` when no identity is stored or
 * `localStorage` is unavailable. A unique `Symbol` rather than `null`:
 * a stored identity is always a string, so callers gate with
 * `=== NO_IDENTITY`.
 */
export const NO_IDENTITY: unique symbol = Symbol('messages-demo:no-identity',);

/**
 * Loads the persisted identity, or `NO_IDENTITY` when none is stored or
 * when `localStorage` is unavailable / failing.
 *
 * @param available - whether the storage probe succeeded
 *
 * @returns persisted identity or `NO_IDENTITY`
 *
 * @example
 * ```ts
 * const identity = loadIdentity(caps.localStorage);
 * ```
 */
export function loadIdentity(available: boolean,): string | typeof NO_IDENTITY {
  if (!available)
    return NO_IDENTITY;
  try {
    /**
     * Raw Web Storage read; `getItem` yields `null` for an absent key, mapped to the sentinel.
     */
    const stored = localStorage.getItem(IDENTITY_KEY,);
    if (stored === null)
      return NO_IDENTITY;
    return stored;
  }
  catch {
    return NO_IDENTITY;
  }
}

/**
 * Persists the user's identity selection. Silently no-ops when
 * `localStorage` is unavailable, the write throws, or the value is
 * empty.
 *
 * @param input - identity to save and the storage-probe flag
 *
 * @example
 * ```ts
 * saveIdentity({ identity: 'user-a', available: caps.localStorage });
 * ```
 */
export function saveIdentity(
  input: {
    readonly identity: string;
    readonly available: boolean;
  },
): void {
  if ((!input.available) || (input.identity
    === ''))
    return;
  try {
    localStorage.setItem(
      IDENTITY_KEY,
      input.identity,
    );
  }
  catch {
    // Quota exceeded or write blocked; silently degrade.
  }
}
