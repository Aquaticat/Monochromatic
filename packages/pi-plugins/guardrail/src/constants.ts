/**
 * Constants for pi guardrail defaults and config paths.
 *
 * @module
 */

import { join, } from 'node:path';

import type { PathRule, } from './types.ts';

//region Config constants

/**
 * Directory below home that stores global pi extension configs.
 *
 * @example
 * ```typescript
 * join(home, PI_EXTENSION_CONFIG_DIR, GUARDRAIL_CONFIG_FILE_NAME);
 * ```
 */
const PI_EXTENSION_CONFIG_DIR: string = join(
  '.pi',
  'agent',
  'extensions',
);

/**
 * Global pi guardrail config file name.
 *
 * @example
 * ```typescript
 * // ~/.pi/agent/extensions/pi-guardrail.json
 * GUARDRAIL_CONFIG_FILE_NAME;
 * ```
 */
const GUARDRAIL_CONFIG_FILE_NAME = 'pi-guardrail.json';

/**
 * Whether `bun test` blocking is active when config omits an override.
 *
 * @example
 * ```typescript
 * const blockBunTest = config.blockBunTest ?? DEFAULT_BLOCK_BUN_TEST;
 * ```
 */
const DEFAULT_BLOCK_BUN_TEST = true;

/**
 * Node filesystem error code for missing config files.
 *
 * @example
 * ```typescript
 * if (error.code === FILE_NOT_FOUND_CODE) return absent;
 * ```
 */
const FILE_NOT_FOUND_CODE = 'ENOENT';

//endregion Config constants

//region Guardrail defaults

/**
 * Built-in protected-path rules active before user config is applied.
 *
 * User config rules are appended after these defaults, so gitignore negation
 * patterns can unignore a default and duplicate positive patterns can replace
 * the message selected for a final match.
 *
 * @example
 * ```typescript
 * DEFAULT_PATH_RULES[0]?.pattern; // 'pnpm-lock.yaml'
 * ```
 */
const DEFAULT_PATH_RULES: readonly PathRule[] = [
  {
    pattern: 'pnpm-lock.yaml',
    message: 'edit pnpm-workspace.yaml and package.json files then run `pnpm install`',
  },
] as const;

//endregion Guardrail defaults

export {
  DEFAULT_BLOCK_BUN_TEST,
  DEFAULT_PATH_RULES,
  FILE_NOT_FOUND_CODE,
  GUARDRAIL_CONFIG_FILE_NAME,
  PI_EXTENSION_CONFIG_DIR,
};
