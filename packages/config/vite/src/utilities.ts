import { readFile, } from 'node:fs/promises';
import type { PluginOption, } from 'vite';

//region Helper Functions -- Utilities used throughout configurations

export function viteNoopPlugin(message: string = 'noop',): PluginOption {
  return {
    name: 'noop',
    configResolved(config,) {
      config.logger.info(message,);
    },
  };
}

export const rollupExternal = (moduleId: string,): boolean => {
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
};

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
 * Read file with retry logic for EPERM errors on Windows.
 */
async function readFileWithRetry(
  path: Parameters<typeof readFile>[0],
  options: Parameters<typeof readFile>[1],
  retries = 4,
  delayMs = 10,
): Promise<string> {
  try {
    // Explicitly types the return as string for `utf8` encoding
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

function wait(timeInMs: number,): Promise<undefined> {
  // oxlint-disable-next-line avoid-new
  return new Promise(function createTimeout(resolve,) {
    setTimeout(resolve, timeInMs,);
  },);
}
