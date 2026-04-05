/**
 * Creates a shadow directory for tsgo that excludes non-source files.
 *
 * tsgo's LSP panics when it encounters files with unrecognized extensions
 * (e.g. `.svg`, `.png`) during project loading. Unlike the CLI, the LSP
 * ignores `include`/`exclude` patterns when scanning the rootUri directory.
 *
 * This module creates a temporary directory that mirrors the project layout
 * using symlinks, but only includes files that match the resolved tsconfig
 * `include` patterns. tsgo is given this shadow directory as its rootUri,
 * so it never sees non-source files.
 *
 * See TROUBLESHOOTING.typescript.md "tsgo LSP panics on non-source files".
 */

import {
  mkdirSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import {
  join,
  matchesGlob,
  relative,
} from 'node:path';

import type { Logger, } from '../log.ts';

/** Extension allowlist matching tsgo's `GetScriptKindFromFileName`. */
const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.cjs',
  '.mjs',
  '.cts',
  '.mts',
  '.json',
],);

/**
 * Returns true when a filename has an extension recognized by tsgo's parser.
 *
 * @param name - filename (not full path)
 *
 * @returns true when the extension is in {@link SOURCE_EXTENSIONS}
 *
 * @example
 * ```ts
 * isSourceFile({ name: 'index.ts' });  // true
 * isSourceFile({ name: 'logo.svg' });  // false
 * ```
 */
function isSourceFile({ name, }: { name: string; },): boolean {
  const dotIndex = name.lastIndexOf('.',);
  if (dotIndex < 0)
    return false;
  return SOURCE_EXTENSIONS.has(name.slice(dotIndex,).toLowerCase(),);
}

/**
 * Checks whether a directory entry is a config or metadata file that tsgo
 * needs in the project root (tsconfig, package.json, etc.).
 *
 * @param name - filename (not full path)
 *
 * @returns true when the file should always be symlinked
 *
 * @example
 * ```ts
 * isConfigFile({ name: 'tsconfig.json' });  // true
 * isConfigFile({ name: 'README.md' });      // false
 * ```
 */
function isConfigFile({ name, }: { name: string; },): boolean {
  const lower = name.toLowerCase();
  return lower === 'tsconfig.json'
    || lower === 'package.json'
    || lower === 'jsconfig.json'
    || lower.startsWith('tsconfig.')
    || lower === 'node_modules';
}

/**
 * Recursively symlinks source files and directories from the real project
 * into the shadow directory. Non-source files are silently skipped.
 *
 * @param realDir - absolute path to the real directory
 *
 * @param shadowDir - absolute path to the shadow directory
 *
 * @param patterns - resolved tsconfig include patterns (empty = allow all)
 */
function mirrorDirectory({
  realDir,
  shadowDir,
  patterns,
}: {
  realDir: string;
  shadowDir: string;
  patterns: readonly string[];
},): void {
  const entries = readdirSync(
    realDir,
    { withFileTypes: true, },
  );

  for (const entry of entries) {
    const realPath = join(
      realDir,
      entry.name,
    );
    const shadowPath = join(
      shadowDir,
      entry.name,
    );

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') {
        /** Symlink node_modules wholesale — tsgo needs it for module resolution. */
        symlinkSync(
          realPath,
          shadowPath,
        );
      }
      else if (entry.name !== 'dist' && entry.name !== '.git') {
        mkdirSync(
          shadowPath,
          { recursive: true, },
        );
        mirrorDirectory({
          realDir: realPath,
          shadowDir: shadowPath,
          patterns,
        },);
      }
      continue;
    }

    if (!entry.isFile())
      continue;

    /** Always include config files. */
    if (isConfigFile({ name: entry.name, },)) {
      symlinkSync(
        realPath,
        shadowPath,
      );
      continue;
    }

    /** Only include files with source extensions. */
    if (isSourceFile({ name: entry.name, },)) {
      symlinkSync(
        realPath,
        shadowPath,
      );
    }
  }
}

/**
 * Creates a shadow directory that mirrors the project layout
 * but only includes files with extensions tsgo can parse.
 *
 * The shadow directory is created under `$TMPDIR/editord-tsgo-shadow/`
 * using the project root's path as a subdirectory name.
 * Existing shadow directories for the same root are removed first.
 *
 * @param root - absolute path to the real project root
 *
 * @param patterns - resolved tsconfig include patterns (for future filtering)
 *
 * @param l - logger for status messages
 *
 * @returns absolute path to the shadow directory
 *
 * @example
 * ```ts
 * const shadow = createTsgoShadowRoot({
 *   root: '/home/user/project',
 *   patterns: [],
 *   l: logger,
 * });
 * // '/tmp/editord-tsgo-shadow/home-user-project'
 * ```
 */
export function createTsgoShadowRoot({
  root,
  patterns,
  l,
}: {
  root: string;
  patterns: readonly string[];
  l: Logger;
},): string {
  const tmpBase = process.env['TMPDIR'] ?? '/tmp';
  const safeName = root.replaceAll(
    '/',
    '-',
  ).slice(1,);
  const shadowDir = join(
    tmpBase,
    'editord-tsgo-shadow',
    safeName,
  );

  /** Clean up any previous shadow for this root. */
  rmSync(
    shadowDir,
    {
      recursive: true,
      force: true,
    },
  );

  mkdirSync(
    shadowDir,
    { recursive: true, },
  );

  mirrorDirectory({
    realDir: root,
    shadowDir,
    patterns,
  },);

  l.info(`created tsgo shadow root: ${shadowDir}`,);
  return shadowDir;
}

/**
 * Removes a shadow directory previously created by {@link createTsgoShadowRoot}.
 *
 * @param shadowRoot - absolute path to the shadow directory
 *
 * @example
 * ```ts
 * removeTsgoShadowRoot({ shadowRoot: '/tmp/editord-tsgo-shadow/home-user-project' });
 * ```
 */
export function removeTsgoShadowRoot({ shadowRoot, }: { shadowRoot: string; },): void {
  rmSync(
    shadowRoot,
    {
      recursive: true,
      force: true,
    },
  );
}
