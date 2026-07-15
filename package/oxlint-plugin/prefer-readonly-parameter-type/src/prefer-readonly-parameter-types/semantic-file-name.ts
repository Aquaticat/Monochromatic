/**
 * Cross-platform source-path identity for TypeScript semantic snapshots.
 *
 * @module
 */

import { resolve, } from 'node:path';

/**
 * Normalizes source path for overlay and project lookup.
 *
 * TypeScript treats Windows source paths case-insensitively and may return a lowercased drive path with forward
 * separators even when Oxlint supplied original casing and backslashes.
 * Case folding keeps overlay callbacks and snapshot file changes on one identity while preserving case on other hosts.
 *
 * @param fileName - Host-provided absolute or relative source path.
 *
 * @returns absolute platform-normalized source path with Windows case folded for TypeScript identity.
 *
 * @example
 * ```ts
 * normalizeSemanticFileName('src/index.ts');
 * ```
 */
export function normalizeSemanticFileName(fileName: string,): string {
  /**
   * Absolute path before host case-sensitivity normalization.
   */
  const absoluteFileName = resolve(fileName,);
  return process.platform === 'win32'
    ? absoluteFileName.toLowerCase()
    : absoluteFileName;
}
