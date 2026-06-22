/**
 * Feature request delegations for the LSP manager.
 *
 * Each function resolves the appropriate LSP client from the pool
 * and delegates to the corresponding feature handler via {@link withClient}.
 * Request failures (including timeouts for unsupported files)
 * are caught and mapped to the same fallback as "no client available",
 * so callers always receive a well-typed result.
 * Timeout errors are already logged by {@link LspClient} before
 * they propagate here, so the catch blocks do not re-log.
 */

import type { FilePosition, } from '../../protocol.ts';
import {
  l as rootLogger,
  tagged,
} from '../log.ts';
import type { LspClient, } from './lsp-client.ts';
import {
  type PrepareRenameResult,
  requestPrepareRename,
  requestRename,
} from './lsp-features-rename.ts';
import {
  requestCompletion,
  requestFormat,
  requestGotoDefinition,
  requestHover,
  requestInlayHints,
  requestReferences,
  requestSelectionRange,
} from './lsp-features.ts';
import type { LspPool, } from './lsp-pool.ts';
import type {
  LspCompletionItem,
  LspHover,
  LspInlayHint,
  LspRange,
  LspSelectionRange,
  LspTextEdit,
  LspWorkspaceEdit,
} from './types.ts';

/**
 * Tagged logger for the LSP manager request subsystem.
 */
const l = tagged({
  tag: 'lsp-manager-requests',
  l: rootLogger,
},);

//region Client resolution helper

/**
 * Resolves an LSP client from the pool and runs a request against it.
 * Returns the fallback value when no initialized client is available
 * or when the request throws (e.g. timeout).
 *
 * @param pool - LSP client pool
 *
 * @param serverType - which LSP server to resolve
 *
 * @param path - file path for project-root resolution
 *
 * @param fallback - value to return when no client is available or the request fails
 *
 * @param request - callback that performs the actual LSP request
 *
 * @returns request result, or fallback on failure
 */
async function withClient<T,>({
  pool,
  serverType,
  path,
  fallback,
  request,
}: {
  readonly pool: LspPool;
  readonly serverType: 'tsc' | 'dprint';
  readonly path: string;
  readonly fallback: T;
  readonly request: (client: LspClient,) => Promise<T>;
},): Promise<T> {
  /**
   * Pool-resolved LSP client; `null` when no server is available for this file.
   */
  const c = await pool.resolve({
    type: serverType,
    filePath: path,
  },);
  if ((c === null) || (!c.initialized))
    return fallback;
  try {
    return await request(c,);
  }
  catch (error) {
    /**
     * Whether the error message contains the LSP request timeout marker; already logged by LspClient.
     */
    const isTimeout = (error instanceof Error)
      && error
      .message
      .includes('timed out',);
    if (!isTimeout)
      l.warn(`LSP request failed (non-timeout): ${String(error,)}`,);
    return fallback;
  }
}

//endregion Client resolution helper

//region Feature delegations

/**
 * {@inheritDoc requestHover}
 *
 * @returns hover content, or null when no client is available or the request fails
 */
export function managerHover({
  pool,
  ...pos
}: {
  readonly pool: LspPool;
} & FilePosition,): Promise<LspHover | null> {
  return withClient({
    pool,
    serverType: 'tsc',
    path: pos.path,
    fallback: null,
    request: function doHover(client,) {
      return requestHover({
        client,
        ...pos,
      },);
    },
  },);
}

/**
 * {@inheritDoc requestCompletion}
 *
 * @returns completion items, or empty array when no client is available or the request fails
 */
export function managerCompletion({
  pool,
  ...pos
}: {
  readonly pool: LspPool;
} & FilePosition,): Promise<LspCompletionItem[]> {
  return withClient({
    pool,
    serverType: 'tsc',
    path: pos.path,
    fallback: [],
    request: function doCompletion(client,) {
      return requestCompletion({
        client,
        ...pos,
      },);
    },
  },);
}

/**
 * {@inheritDoc requestFormat}
 *
 * @returns text edits, or empty array when no client is available or the request fails
 */
export function managerFormat({
  pool,
  path,
}: {
  readonly pool: LspPool;
  readonly path: string;
},): Promise<LspTextEdit[]> {
  return withClient({
    pool,
    serverType: 'dprint',
    path,
    fallback: [],
    request: function doFormat(client,) {
      return requestFormat({
        client,
        path,
      },);
    },
  },);
}

/**
 * {@inheritDoc requestGotoDefinition}
 *
 * @returns definition location, or null when no client is available or the request fails
 */
export function managerGotoDefinition({
  pool,
  ...pos
}: {
  readonly pool: LspPool;
} & FilePosition,): Promise<FilePosition | null> {
  return withClient({
    pool,
    serverType: 'tsc',
    path: pos.path,
    fallback: null,
    request: function doGotoDef(client,) {
      return requestGotoDefinition({
        client,
        ...pos,
      },);
    },
  },);
}

/**
 * {@inheritDoc requestReferences}
 *
 * @returns reference locations, or empty array when no client is available or the request fails
 */
export function managerReferences({
  pool,
  ...pos
}: {
  readonly pool: LspPool;
} & FilePosition,): Promise<FilePosition[]> {
  return withClient({
    pool,
    serverType: 'tsc',
    path: pos.path,
    fallback: [],
    request: function doRefs(client,) {
      return requestReferences({
        client,
        ...pos,
      },);
    },
  },);
}

/**
 * {@inheritDoc requestInlayHints}
 *
 * @returns inlay hints, or empty array when no client is available or the request fails
 */
export function managerInlayHints({
  pool,
  path,
  range,
}: {
  readonly pool: LspPool;
  readonly path: string;
  readonly range: LspRange;
},): Promise<LspInlayHint[]> {
  return withClient({
    pool,
    serverType: 'tsc',
    path,
    fallback: [],
    request: function doInlayHints(client,) {
      return requestInlayHints({
        client,
        path,
        range,
      },);
    },
  },);
}

/**
 * {@inheritDoc requestSelectionRange}
 *
 * @returns selection ranges, or empty array when no client is available or the request fails
 */
export function managerSelectionRange({
  pool,
  path,
  positions,
}: {
  readonly pool: LspPool;
  readonly path: string;
  readonly positions: readonly {
    readonly line: number;
    readonly character: number;
  }[];
},): Promise<LspSelectionRange[]> {
  return withClient({
    pool,
    serverType: 'tsc',
    path,
    fallback: [],
    request: function doSelRange(client,) {
      return requestSelectionRange({
        client,
        path,
        positions,
      },);
    },
  },);
}

/**
 * {@inheritDoc requestPrepareRename}
 *
 * @returns prepare rename result, or null when no client is available or the request fails
 */
export function managerPrepareRename({
  pool,
  ...pos
}: {
  readonly pool: LspPool;
} & FilePosition,): Promise<PrepareRenameResult | null> {
  return withClient({
    pool,
    serverType: 'tsc',
    path: pos.path,
    fallback: null,
    request: function doPrepareRename(client,) {
      return requestPrepareRename({
        client,
        ...pos,
      },);
    },
  },);
}

/**
 * {@inheritDoc requestRename}
 *
 * @returns workspace edit, or null when no client is available or the request fails
 */
export function managerRename({
  pool,
  path,
  line,
  character,
  newName,
}: {
  readonly pool: LspPool;
  readonly path: string;
  readonly line: number;
  readonly character: number;
  readonly newName: string;
},): Promise<LspWorkspaceEdit | null> {
  return withClient({
    pool,
    serverType: 'tsc',
    path,
    fallback: null,
    request: function doRename(client,) {
      return requestRename({
        client,
        path,
        line,
        character,
        newName,
      },);
    },
  },);
}

//endregion Feature delegations
