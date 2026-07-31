import { randomUUID, } from 'node:crypto';
import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { BypassStateError, } from './errors.ts';
import {
  bypassRuntimeDirectory,
  bypassStatePath,
} from './tunnel-bypass-path.ts';
import {
  findFreeBypassPreference,
  findFreeBypassTable,
  tableIsFree,
} from './tunnel-table.ts';
import type { BypassState, } from './tunnel-bypass-types.ts';

/**
 * Sentinel representing absent state or lock path.
 */
export const BYPASS_STATE_ABSENT: unique symbol = Symbol('bypass state path is absent',);

/**
 * Cooperative lock payload.
 */
type ResourceLock = {
  readonly interfaceName: string;
  readonly ownerId: string;
};

/**
 * Narrows caught value to Node filesystem error.
 *
 * @param error - Caught value.
 *
 * @returns Whether value carries error code.
 *
 * @example
 * ```ts
 * isErrnoException({ code: 'ENOENT' }); // true
 * ```
 */
function isErrnoException(error: unknown,): error is NodeJS.ErrnoException {
  return ((typeof error) === 'object')
    && (error !== null)
    && ('code' in error);
}

/**
 * Reads UTF-8 path with explicit absence.
 *
 * @param path - Path to read.
 *
 * @returns Text or absence sentinel.
 *
 * @example
 * ```ts
 * await readIfExists('/run/wg-quicker/state.json');
 * ```
 */
async function readIfExists(
  path: string,
): Promise<string | typeof BYPASS_STATE_ABSENT> {
  try {
    return await readFile(
      path,
      'utf8',
    );
  }
  catch (error) {
    if (isErrnoException(error,) && (error.code === 'ENOENT'))
      return BYPASS_STATE_ABSENT;
    throw error;
  }
}

/**
 * Checks unknown object shape.
 *
 * @param value - Candidate JSON value.
 *
 * @returns Whether value supports field guards.
 *
 * @example
 * ```ts
 * isRecord({ version: 1 }); // true
 * ```
 */
function isRecord(value: unknown,): value is Record<PropertyKey, unknown> {
  return ((typeof value) === 'object') && (value !== null);
}

/**
 * Parses and validates persisted bypass state.
 *
 * @param text - JSON state text.
 *
 * @param path - Path named in diagnostics.
 *
 * @returns Validated state.
 *
 * @throws {@link BypassStateError} when state shape is invalid.
 *
 * @example
 * ```ts
 * parseBypassState({ text: '{"version":1}', path: '/tmp/state' });
 * ```
 */
function parseBypassState(
  {
    text,
    path,
  }: {
    readonly text: string;
    readonly path: string;
  },
): BypassState {
  /**
   * Parsed JSON before field validation.
   */
  const value: unknown = JSON.parse(text,);
  if ((!isRecord(value,))
    || (value.version !== 1)
    || ((typeof value.interfaceName) !== 'string')
    || ((typeof value.mark) !== 'number')
    || ((typeof value.table) !== 'number')
    || ((typeof value.preference) !== 'number')
    || ((typeof value.ownerId) !== 'string')) {
    throw new BypassStateError(`Invalid application-bypass state: ${path}`,);
  }
  return {
    version: 1,
    interfaceName: value.interfaceName,
    mark: value.mark,
    table: value.table,
    preference: value.preference,
    ownerId: value.ownerId,
  };
}

/**
 * Reads state from explicit path for watcher process.
 *
 * @param path - State path passed by service manager.
 *
 * @returns Validated state.
 *
 * @throws {@link BypassStateError} when absent or invalid.
 *
 * @example
 * ```ts
 * await readBypassStatePath({ path: '/run/wg-quicker/interface-key.json' });
 * ```
 */
export async function readBypassStatePath(
  { path, }: { readonly path: string; },
): Promise<BypassState> {
  /**
   * State text when path exists.
   */
  const text = await readIfExists(path,);
  if (text === BYPASS_STATE_ABSENT)
    throw new BypassStateError(`Application-bypass state does not exist: ${path}`,);
  return parseBypassState({
    text,
    path,
  },);
}

/**
 * Reads state for interface when present.
 *
 * @param interfaceName - Interface identity.
 *
 * @returns State or absence sentinel.
 *
 * @example
 * ```ts
 * await readBypassState({ interfaceName: 'wg0' });
 * ```
 */
export async function readBypassState(
  { interfaceName, }: { readonly interfaceName: string; },
): Promise<BypassState | typeof BYPASS_STATE_ABSENT> {
  /**
   * Interface-specific path.
   */
  const path = bypassStatePath({ interfaceName, },);
  /**
   * State text when path exists.
   */
  const text = await readIfExists(path,);
  if (text === BYPASS_STATE_ABSENT)
    return BYPASS_STATE_ABSENT;
  /**
   * Validated state from interface path.
   */
  const state = parseBypassState({
    text,
    path,
  },);
  if (state.interfaceName !== interfaceName) {
    throw new BypassStateError(
      `Application-bypass state at ${path} belongs to ${state.interfaceName}, not ${interfaceName}.`,
    );
  }
  return state;
}

/**
 * Ensures private runtime directory exists.
 *
 * @example
 * ```ts
 * await ensureRuntimeDirectory();
 * ```
 */
async function ensureRuntimeDirectory(): Promise<void> {
  await mkdir(
    bypassRuntimeDirectory(),
    {
      mode: 0o700,
      recursive: true,
    },
  );
}

/**
 * Attempts exclusive cooperative resource lock.
 *
 * @param path - Lock path.
 *
 * @param lock - Owner payload.
 *
 * @returns Whether lock was created.
 *
 * @example
 * ```ts
 * await tryClaimLock({ path: '/tmp/table.lock', lock });
 * ```
 */
async function tryClaimLock(
  {
    path,
    lock,
  }: {
    readonly path: string;
    readonly lock: ResourceLock;
  },
): Promise<boolean> {
  try {
    await writeFile(
      path,
      JSON.stringify({
        interfaceName: lock.interfaceName,
        ownerId: lock.ownerId,
      },),
      {
        flag: 'wx',
        mode: 0o600,
      },
    );
    return true;
  }
  catch (error) {
    if (isErrnoException(error,) && (error.code === 'EEXIST'))
      return false;
    throw error;
  }
}

/**
 * Removes cooperative lock only when owner token matches.
 *
 * @param path - Lock path.
 *
 * @param ownerId - Expected owner token.
 *
 * @example
 * ```ts
 * await releaseLock({ path: '/tmp/table.lock', ownerId: 'owner' });
 * ```
 */
async function releaseLock(
  {
    path,
    ownerId,
  }: {
    readonly path: string;
    readonly ownerId: string;
  },
): Promise<void> {
  /**
   * Existing lock payload when present.
   */
  const text = await readIfExists(path,);
  if (text === BYPASS_STATE_ABSENT)
    return;
  /**
   * Parsed lock before owner validation.
   */
  const value: unknown = JSON.parse(text,);
  if ((!isRecord(value,)) || (value.ownerId !== ownerId)) {
    throw new BypassStateError(`Refusing to remove application-bypass lock not owned by ${ownerId}: ${path}`,);
  }
  await rm(path,);
}

/**
 * Claims collision-safe table and preference resources.
 *
 * @param interfaceName - Interface becoming owner.
 *
 * @param mark - Socket mark persisted with state.
 *
 * @returns Unpersisted state carrying both cooperative locks.
 *
 * @example
 * ```ts
 * await claimBypassState({ interfaceName: 'wg0', mark: 8888 });
 * ```
 */
export async function claimBypassState(
  {
    interfaceName,
    mark,
  }: {
    readonly interfaceName: string;
    readonly mark: number;
  },
): Promise<BypassState> {
  await ensureRuntimeDirectory();
  /**
   * Random token binding state and locks.
   */
  const ownerId = randomUUID();
  /**
   * Cooperative lock payload.
   */
  const lock: ResourceLock = {
    interfaceName,
    ownerId,
  };
  /**
   * Mutable table retry floor.
   */
  const tableCursor = { minimum: 0, };
  /**
   * Claimed free table.
   */
  const tableState = { value: 0, };
  for (;;) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each collision changes next allocator floor.
    const table = await findFreeBypassTable({ minimum: tableCursor.minimum, },);
    /**
     * Candidate table lock path.
     */
    const lockPath = join(
      bypassRuntimeDirectory(),
      `table-${String(table,)}.lock`,
    );
    // oxlint-disable-next-line eslint/no-await-in-loop -- Exclusive lock result determines whether candidate can be rechecked.
    if (await tryClaimLock({
      path: lockPath,
      lock,
    })) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Recheck closes cooperative allocation race after lock acquisition.
      if (await tableIsFree({ table, })) {
        tableState.value = table;
        break;
      }
      // oxlint-disable-next-line eslint/no-await-in-loop -- Failed candidate lock must be released before retry.
      await releaseLock({
        path: lockPath,
        ownerId,
      });
    }
    tableCursor.minimum = table + 1;
  }
  /**
   * Mutable preference retry floor.
   */
  const preferenceCursor = { minimum: 0, };
  /**
   * Claimed free preference.
   */
  const preferenceState = { value: 0, };
  try {
    for (;;) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each collision changes next allocator floor.
      const preference = await findFreeBypassPreference({ minimum: preferenceCursor.minimum, },);
      /**
       * Candidate preference lock path.
       */
      const lockPath = join(
        bypassRuntimeDirectory(),
        `preference-${String(preference,)}.lock`,
      );
      // oxlint-disable-next-line eslint/no-await-in-loop -- Exclusive lock result determines whether candidate is available.
      if (await tryClaimLock({
        path: lockPath,
        lock,
      })) {
        preferenceState.value = preference;
        break;
      }
      preferenceCursor.minimum = preference + 1;
    }
  }
  catch (error) {
    await releaseLock({
      path: join(
        bypassRuntimeDirectory(),
        `table-${String(tableState.value,)}.lock`,
      ),
      ownerId,
    },);
    throw error;
  }
  return {
    version: 1,
    interfaceName,
    mark,
    table: tableState.value,
    preference: preferenceState.value,
    ownerId,
  };
}

/**
 * Atomically persists claimed state.
 *
 * @param state - Complete ownership state.
 *
 * @example
 * ```ts
 * await persistBypassState({ state });
 * ```
 */
export async function persistBypassState(
  { state, }: { readonly state: BypassState; },
): Promise<void> {
  await ensureRuntimeDirectory();
  /**
   * Final interface state path.
   */
  const path = bypassStatePath({ interfaceName: state.interfaceName, },);
  /**
   * Unique same-directory temporary path.
   */
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(
    temporaryPath,
    JSON.stringify({
      version: state.version,
      interfaceName: state.interfaceName,
      mark: state.mark,
      table: state.table,
      preference: state.preference,
      ownerId: state.ownerId,
    },),
    {
      flag: 'wx',
      mode: 0o600,
    },
  );
  await rename(
    temporaryPath,
    path,
  );
}

/**
 * Removes state and both cooperative locks after owned routes and rules are gone.
 *
 * @param state - Ownership state being released.
 *
 * @example
 * ```ts
 * await releaseBypassState({ state });
 * ```
 */
export async function releaseBypassState(
  { state, }: { readonly state: BypassState; },
): Promise<void> {
  await releaseLock({
    path: join(
      bypassRuntimeDirectory(),
      `table-${String(state.table,)}.lock`,
    ),
    ownerId: state.ownerId,
  },);
  await releaseLock({
    path: join(
      bypassRuntimeDirectory(),
      `preference-${String(state.preference,)}.lock`,
    ),
    ownerId: state.ownerId,
  },);
  /**
   * Current state at interface path before removal.
   */
  const current = await readBypassState({ interfaceName: state.interfaceName, },);
  if (current === BYPASS_STATE_ABSENT)
    return;
  if (current.ownerId !== state.ownerId) {
    throw new BypassStateError(
      `Refusing to remove application-bypass state owned by ${current.ownerId}.`,
    );
  }
  await rm(bypassStatePath({ interfaceName: state.interfaceName, },),);
}
