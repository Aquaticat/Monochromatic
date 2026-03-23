/**
 * Feature request delegations for the LSP manager.
 *
 * Each function resolves the appropriate LSP client from the pool
 * and delegates to the corresponding feature handler.
 */

import { requestCompletion, requestFormat, requestGotoDefinition, requestHover, requestInlayHints, requestReferences, requestSelectionRange, } from './lsp-features.ts';
import type { LspPool, } from './lsp-pool.ts';
import type { LspCompletionItem, LspHover, LspInlayHint, LspSelectionRange, LspTextEdit, } from './types.ts';

/** {@inheritDoc requestHover} */
export async function managerHover({ pool, path, line, character, }: {
  pool: LspPool; path: string; line: number; character: number;
}): Promise<LspHover | null> {
  const c = await pool.resolve({ type: 'tsgo', filePath: path, },);
  return c !== null && c.initialized ? requestHover({ client: c, path, line, character, },) : null;
}

/** {@inheritDoc requestCompletion} */
export async function managerCompletion({ pool, path, line, character, }: {
  pool: LspPool; path: string; line: number; character: number;
}): Promise<LspCompletionItem[]> {
  const c = await pool.resolve({ type: 'tsgo', filePath: path, },);
  return c !== null && c.initialized ? requestCompletion({ client: c, path, line, character, },) : [];
}

/** {@inheritDoc requestFormat} */
export async function managerFormat({ pool, path, }: {
  pool: LspPool; path: string;
}): Promise<LspTextEdit[]> {
  const c = await pool.resolve({ type: 'dprint', filePath: path, },);
  return c !== null && c.initialized ? requestFormat({ client: c, path, },) : [];
}

/** {@inheritDoc requestGotoDefinition} */
export async function managerGotoDefinition({ pool, path, line, character, }: {
  pool: LspPool; path: string; line: number; character: number;
}): Promise<{ path: string; line: number; character: number } | null> {
  const c = await pool.resolve({ type: 'tsgo', filePath: path, },);
  return c !== null && c.initialized ? requestGotoDefinition({ client: c, path, line, character, },) : null;
}

/** {@inheritDoc requestReferences} */
export async function managerReferences({ pool, path, line, character, }: {
  pool: LspPool; path: string; line: number; character: number;
}): Promise<{ path: string; line: number; character: number }[]> {
  const c = await pool.resolve({ type: 'tsgo', filePath: path, },);
  return c !== null && c.initialized ? requestReferences({ client: c, path, line, character, },) : [];
}

/** {@inheritDoc requestInlayHints} */
export async function managerInlayHints({ pool, path, range, }: {
  pool: LspPool; path: string;
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
}): Promise<LspInlayHint[]> {
  const c = await pool.resolve({ type: 'tsgo', filePath: path, },);
  return c !== null && c.initialized ? requestInlayHints({ client: c, path, range, },) : [];
}

/** {@inheritDoc requestSelectionRange} */
export async function managerSelectionRange({ pool, path, positions, }: {
  pool: LspPool; path: string;
  positions: { line: number; character: number }[];
}): Promise<LspSelectionRange[]> {
  const c = await pool.resolve({ type: 'tsgo', filePath: path, },);
  return c !== null && c.initialized ? requestSelectionRange({ client: c, path, positions, },) : [];
}
