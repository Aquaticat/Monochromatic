/**
 * Located-file convenience API for pnpm workspace catalogs.
 *
 * @module
 */

import { readFile, } from 'node:fs/promises';

import { findUp, } from 'find-up';

import {
  parseCatalogFromYaml,
} from './parse.ts';
import type {
  CatalogFile,
  ReadCatalogFileOptions,
} from './types.ts';

//region Public file reader

/**
 * Locates and parses the nearest `pnpm-workspace.yaml`.
 *
 * The returned `content` is the exact UTF-8 text that was parsed, allowing a
 * caller such as catalog-tighten to perform a formatting-preserving rewrite.
 *
 * @param startDir - optional starting directory for the upward search
 *
 * @returns located path, original content, and parsed catalogs
 *
 * @throws Error when no workspace YAML file exists up from the start directory
 *
 * @example
 * ```ts
 * const workspace = await readCatalogFile({ startDir: process.cwd(), });
 * console.info(workspace.path, workspace.catalogs.defaultCatalog);
 * ```
 */
export async function readCatalogFile(
  {
    startDir,
  }: ReadCatalogFileOptions = {},
): Promise<CatalogFile> {
  /**
   * Absolute path to the nearest workspace YAML file.
   */
  const workspaceYamlPath = await findUp(
    'pnpm-workspace.yaml',
    startDir === undefined ? undefined : { cwd: startDir, },
  );
  if (workspaceYamlPath === undefined) {
    throw new Error(
      `Could not locate pnpm-workspace.yaml by walking up from ${startDir ?? process.cwd()}`,
    );
  }

  /**
   * Original workspace YAML text retained for callers that need surgical edits.
   */
  const content = await readFile(
    workspaceYamlPath,
    'utf8',
  );
  /**
   * Parsed catalog blocks derived from the retained content.
   */
  const catalogs = parseCatalogFromYaml(content,);

  return {
    path: workspaceYamlPath,
    content,
    catalogs,
  };
}

//endregion Public file reader
