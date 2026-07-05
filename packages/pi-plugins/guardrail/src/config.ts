/**
 * Global configuration loading for pi guardrail.
 *
 * @module
 */

import { homedir, } from 'node:os';

import {
  DEFAULT_BLOCK_BUN_TEST,
  DEFAULT_PATH_RULES,
} from './constants.ts';
import {
  defaultReadConfigFile,
  readOptionalConfigJson,
} from './config-file.ts';
import { normalizeConfigFile, } from './config-normalize.ts';
import { configPathForHome, } from './config-paths.ts';
import type {
  GuardrailConfig,
  NormalizedConfigFile,
} from './types.ts';

//region Types

/**
 * Options for loading global guardrail config.
 */
type LoadGuardrailConfigOptions = {
  /**
   * Home directory override for tests.
   */
  readonly home?: string;
  /**
   * Config reader dependency for tests.
   */
  readonly readConfigFile?: (path: string) => Promise<string>;
};

//endregion Types

//region Public API

/**
 * Loads global pi guardrail config and merges built-in defaults.
 *
 * Config is optional. When present, it may be a direct map from gitignore-style
 * pattern to refusal message, matching the short user-facing shape, or an
 * advanced object with `pathRules` and `blockBunTest` fields.
 *
 * @param options - test overrides for home, env, and file reading
 *
 * @returns runtime guardrail config
 *
 * @example
 * ```typescript
 * const config = await loadGuardrailConfig();
 * ```
 */
async function loadGuardrailConfig(
  options: LoadGuardrailConfigOptions = {},
): Promise<GuardrailConfig> {
  /**
   * HOME environment value read separately for chain formatting.
   */
  const processHome = process.env
    .HOME;
  /**
   * Home directory used for global config lookup.
   */
  const home = options.home
    ?? processHome
    ?? homedir();
  /**
   * Config path in the pi global extension config directory.
   */
  const configPath = configPathForHome({ home, },);
  /**
   * Optional JSON config read result.
   */
  const readResult = await readOptionalConfigJson({
    configPath,
    readConfigFile: options.readConfigFile ?? defaultReadConfigFile,
  },);
  /**
   * User config normalized to ordered path rules and optional scalar settings.
   */
  const normalized = readResult.loaded
    ? normalizeConfigFile({
      value: readResult.value,
      configPath,
    },)
    : {
      pathRules: [],
    } satisfies NormalizedConfigFile;

  return {
    pathRules: [
      ...DEFAULT_PATH_RULES,
      ...normalized.pathRules,
    ],
    blockBunTest: normalized.blockBunTest ?? DEFAULT_BLOCK_BUN_TEST,
    source: {
      path: configPath,
      loaded: readResult.loaded,
    },
  };
}

//endregion Public API

export { loadGuardrailConfig, };
export type { LoadGuardrailConfigOptions, };
