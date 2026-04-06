import type { PluginOption, } from 'vite';

//region Helper Functions -- Utilities used throughout configurations

/**
 * Creates a Vite plugin that only logs a message during config resolution.
 * Useful as a placeholder when a real plugin is conditionally disabled.
 *
 * @param message - text to log during config resolution
 *
 * @returns Vite plugin that logs the message
 *
 * @example
 * ```ts
 * import { viteNoopPlugin } from '\@monochromatic-dev/config-vite/utilities.ts';
 *
 * const plugin = viteNoopPlugin('CSS plugin disabled in test mode');
 * ```
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
 *
 * @example
 * ```ts
 * import { rollupExternal } from '\@monochromatic-dev/config-vite/utilities.ts';
 *
 * rollupExternal('node:fs'); // true
 * rollupExternal('vite'); // true
 * rollupExternal('./local-module'); // false
 * ```
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

//endregion Helper Functions
