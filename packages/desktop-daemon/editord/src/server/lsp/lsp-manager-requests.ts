/**
 * Feature request delegations for the LSP manager.
 *
 * Each function resolves the appropriate LSP client from the pool
 * and delegates to the corresponding feature handler.
 * Request failures (including timeouts for unsupported files)
 * are caught and mapped to the same fallback as "no client available",
 * so callers always receive a well-typed result.
 * Timeout errors are already logged by {@link LspClient} before
 * they propagate here, so the catch blocks do not re-log.
 */

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
  LspSelectionRange,
  LspTextEdit,
} from './types.ts';

/**
 * {@inheritDoc requestHover}
 *
 * @returns hover content, or null when no client is available or the request fails
 */
export async function managerHover({
  pool,
  path,
  line,
  character,
}: {
  pool: LspPool;
  path: string;
  line: number;
  character: number;
},): Promise<LspHover | null> {
  const c = await pool.resolve({
    type: 'tsgo',
    filePath: path,
  },);
  if (c === null || !c.initialized)
    return null;
  try {
    return await requestHover({
      client: c,
      path,
      line,
      character,
    },);
  }
  catch {
    return null;
  }
}

/**
 * {@inheritDoc requestCompletion}
 *
 * @returns completion items, or empty array when no client is available or the request fails
 */
export async function managerCompletion({
  pool,
  path,
  line,
  character,
}: {
  pool: LspPool;
  path: string;
  line: number;
  character: number;
},): Promise<LspCompletionItem[]> {
  const c = await pool.resolve({
    type: 'tsgo',
    filePath: path,
  },);
  if (c === null || !c.initialized)
    return [];
  try {
    return await requestCompletion({
      client: c,
      path,
      line,
      character,
    },);
  }
  catch {
    return [];
  }
}

/**
 * {@inheritDoc requestFormat}
 *
 * @returns text edits, or empty array when no client is available or the request fails
 */
export async function managerFormat({
  pool,
  path,
}: {
  pool: LspPool;
  path: string;
},): Promise<LspTextEdit[]> {
  const c = await pool.resolve({
    type: 'dprint',
    filePath: path,
  },);
  if (c === null || !c.initialized)
    return [];
  try {
    return await requestFormat({
      client: c,
      path,
    },);
  }
  catch {
    return [];
  }
}

/**
 * {@inheritDoc requestGotoDefinition}
 *
 * @returns definition location, or null when no client is available or the request fails
 */
export async function managerGotoDefinition({
  pool,
  path,
  line,
  character,
}: {
  pool: LspPool;
  path: string;
  line: number;
  character: number;
},): Promise<{
  path: string;
  line: number;
  character: number
} | null> {
  const c = await pool.resolve({
    type: 'tsgo',
    filePath: path,
  },);
  if (c === null || !c.initialized)
    return null;
  try {
    return await requestGotoDefinition({
      client: c,
      path,
      line,
      character,
    },);
  }
  catch {
    return null;
  }
}

/**
 * {@inheritDoc requestReferences}
 *
 * @returns reference locations, or empty array when no client is available or the request fails
 */
export async function managerReferences({
  pool,
  path,
  line,
  character,
}: {
  pool: LspPool;
  path: string;
  line: number;
  character: number;
},): Promise<{
  path: string;
  line: number;
  character: number
}[]> {
  const c = await pool.resolve({
    type: 'tsgo',
    filePath: path,
  },);
  if (c === null || !c.initialized)
    return [];
  try {
    return await requestReferences({
      client: c,
      path,
      line,
      character,
    },);
  }
  catch {
    return [];
  }
}

/**
 * {@inheritDoc requestInlayHints}
 *
 * @returns inlay hints, or empty array when no client is available or the request fails
 */
export async function managerInlayHints({
  pool,
  path,
  range,
}: {
  pool: LspPool;
  path: string;
  range: {
    start: {
      line: number;
      character: number;
    };
    end: {
      line: number;
      character: number;
    }
  };
},): Promise<LspInlayHint[]> {
  const c = await pool.resolve({
    type: 'tsgo',
    filePath: path,
  },);
  if (c === null || !c.initialized)
    return [];
  try {
    return await requestInlayHints({
      client: c,
      path,
      range,
    },);
  }
  catch {
    return [];
  }
}

/**
 * {@inheritDoc requestSelectionRange}
 *
 * @returns selection ranges, or empty array when no client is available or the request fails
 */
export async function managerSelectionRange({
  pool,
  path,
  positions,
}: {
  pool: LspPool;
  path: string;
  positions: {
    line: number;
    character: number
  }[];
},): Promise<LspSelectionRange[]> {
  const c = await pool.resolve({
    type: 'tsgo',
    filePath: path,
  },);
  if (c === null || !c.initialized)
    return [];
  try {
    return await requestSelectionRange({
      client: c,
      path,
      positions,
    },);
  }
  catch {
    return [];
  }
}
