/**
 * Penpot file metadata and export manifest builders.
 *
 * @module figma-to-penpot-manifest
 */

import {
  DEFAULT_FEATURES,
  PENPOT_FILE_VERSION,
} from './constants.ts';
import type {
  PenpotFile,
  PenpotManifest,
  Uuid,
} from './types.ts';

/**
 * Build the Penpot file-level metadata object.
 *
 * @param fileId - file UUID
 *
 * @param fileName - display name
 *
 * @param now - ISO timestamp for created/modified
 *
 * @returns {@link PenpotFile} metadata
 *
 * @example
 * ```ts
 * const file = makeFile({ fileId, fileName, now, });
 * ```
 */
export function makeFile(
  {
    fileId,
    fileName,
    now,
  }: Readonly<{
    fileId: Uuid;
    fileName: string;
    now: string
  }>,
): PenpotFile {
  return {
    id: fileId,
    name: fileName,
    revn: 1,
    vern: 0,
    createdAt: now,
    modifiedAt: now,
    isShared: false,
    hasMediaTrimmed: false,
    version: PENPOT_FILE_VERSION,
    features: [...DEFAULT_FEATURES,],
    options: {
      componentsV2: true,
      baseFontSize: '16px',
    },
  };
}

/**
 * Build the top-level Penpot export manifest.
 *
 * @param fileId - file UUID referenced by the manifest
 *
 * @param fileName - display name
 *
 * @param generatedBy - generator string
 *
 * @returns {@link PenpotManifest}
 *
 * @example
 * ```ts
 * const manifest = makeManifest({ fileId, fileName, generatedBy, });
 * ```
 */
export function makeManifest(
  {
    fileId,
    fileName,
    generatedBy,
  }: Readonly<{
    fileId: Uuid;
    fileName: string;
    generatedBy: string;
  }>,
): PenpotManifest {
  return {
    type: 'penpot/export-files',
    version: 1,
    generatedBy,
    referer: 'penpot',
    files: [{
      id: fileId,
      name: fileName,
      features: [...DEFAULT_FEATURES,],
    },],
    relations: [],
  };
}
