import { readFile, } from 'node:fs/promises';
import type { PluginOption, } from 'vite';

//region Helper Functions -- Utilities used throughout configurations

/**
 * Creates a Vite plugin that only logs a message during config resolution.
 * Useful as a placeholder when a real plugin is conditionally disabled.
 *
 * @param message - text to log during config resolution
 *
 * @returns Vite plugin that logs the message
 */
export function viteNoopPlugin(message: string = 'noop',): PluginOption {
  return {
    name: 'noop',
    configResolved(config,) {
      config.logger.info(message,);
    },
  };
}

/**
 * Determines whether a module should be treated as external by Rollup.
 * Matches built-in Node modules, build tools, and framework packages.
 *
 * @param moduleId - module specifier to check
 *
 * @returns true when the module should remain external
 */
export function rollupExternal(moduleId: string,): boolean {
  if (
    [
      'node:',
      'node_modules/',
      'oxc-',
      'eslint-plugin-',
      '@typescript-eslint/',
      '@eslint/',
      '@vitest/',
      '@elysiajs/',
    ]
      .some(function startingWithPrefix(prefix,) {
        return moduleId.startsWith(prefix,);
      },)
  ) {
    return true;
  }
  return [
    //region Build
    'vite',
    'vitest',
    'esbuild',
    'typescript-eslint',
    'lightningcss',
    //endregion Build

    //region Node
    'path',
    'fs',
    'util',
    'os',
    'constants',
    'stream',
    'assert',
    'module',
    'events',
    'url',
    'crypto',
    //endregion Node

    //region Server
    'happy-dom',
    //endregion Server
  ]
    .includes(moduleId,);
}

/**
 * Array of patterns and exact module IDs for Rolldown's `external` option.
 * Equivalent to {@link rollupExternal} but uses Rolldown's native pattern matching.
 */
export const rolldownExternal: (string | RegExp)[] = [
  // Prefix-based patterns
  /^node:/,
  /^node_modules\//,
  /^oxc-/,
  /^eslint-plugin-/,
  /^@typescript-eslint\//,
  /^@eslint\//,
  /^@vitest\//,
  /^@elysiajs\//,

  // Specific module names
  //region Build
  'vite',
  'vitest',
  'esbuild',
  'typescript-eslint',
  'lightningcss',
  //endregion Build

  //region Node
  'path',
  'fs',
  'util',
  'os',
  'constants',
  'stream',
  'assert',
  'module',
  'events',
  'url',
  'crypto',
  //endregion Node

  //region Server
  'happy-dom',
  //endregion Server
];

/**
 * Reads a file with retry logic for EPERM errors on Windows.
 * Retries with exponential backoff when the file is temporarily locked.
 *
 * @param path - file path to read
 *
 * @param options - encoding and flag options for readFile
 *
 * @param retries - remaining retry attempts before giving up
 *
 * @param delayMs - milliseconds to wait before the next retry
 *
 * @returns file contents as a UTF-8 string
 *
 * @throws When the file cannot be read after all retries
 */
async function readFileWithRetry(
  path: Parameters<typeof readFile>[0],
  options: Parameters<typeof readFile>[1],
  retries = 4,
  delayMs = 10,
): Promise<string> {
  try {
    // oxlint-disable-next-line no-unsafe-type-assertion -- readFile with utf8 encoding returns string
    return await readFile(path, options,) as string;
  }
  catch (error) {
    if (
      error instanceof Error && 'code' in error && error
          .code === 'EPERM' && retries > 0
    ) {
      // console.warn(`Retrying readFile for ${path} due to EPERM... (${retries} retries left, delay ${delayMs}ms)`);
      await wait(delayMs,);
      return readFileWithRetry(path, options, retries - 1, delayMs * 2,);
    }
    throw error;
  }
}

//endregion Helper Functions

/**
 * Creates a promise that resolves after a delay.
 *
 * @param timeInMs - milliseconds to wait before resolving
 *
 * @returns promise that resolves after the specified delay
 */
function wait(timeInMs: number,): Promise<undefined> {
  // oxlint-disable-next-line avoid-new
  return new Promise(function createTimeout(resolve,) {
    setTimeout(resolve, timeInMs,);
  },);
}
