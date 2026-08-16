/**
 * Cross-platform source-path identity for TypeScript semantic snapshots.
 *
 * @module
 */

import {
  dirname,
  resolve,
} from 'node:path';

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

/**
 * Keys a discovered configured project by root directory in bridge source identity.
 *
 * TypeScript spells `configFileName` its own way, which on Windows carries forward separators and
 * original casing, while every path looked up against this map has been through
 * {@link normalizeSemanticFileName} and so carries backslashes and lower case. A key written in
 * TypeScript's spelling is a key the ancestor walk in `cachedProjectForFile` cannot produce, and
 * the lookup then misses for the life of the process. Both sides pass through here instead.
 *
 * @param configFileName - Configured project path as TypeScript spells it.
 *
 * @returns project root directory in same identity as normalized source paths.
 *
 * @example
 * ```ts
 * semanticProjectRootKey('/repo/package/module/logger/tsconfig.json');
 * ```
 */
export function semanticProjectRootKey(configFileName: string,): string {
  return dirname(normalizeSemanticFileName(configFileName,),);
}
