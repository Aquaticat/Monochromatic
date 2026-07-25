/**
 * Configuration loading and merging.
 *
 * Loads global and project config files, validates them
 * against valibot schemas, and merges into a runtime config.
 *
 * @module
 */

import { readFile, } from 'node:fs/promises';
import { homedir, } from 'node:os';
import { join, } from 'node:path';
import * as v from 'valibot';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  type AutoModeConfig,
  AutoModeConfigSchema,
  type ProjectConfig,
  ProjectConfigSchema,
} from './config-schemas.ts';
import { JUDGE_MODEL_DEFAULTS, } from './constants.ts';
import type {
  CommandMatcher,
  MergedConfig,
} from './signals.ts';
import type {
  BudgetModelAuth,
  ModelOverride,
} from './types.ts';

/**
 * Logger root for auto-mode after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l: parentLogger, },);
 * ```
 */
const parentLogger = tagged({ tag: 'auto-mode', },);

/**
 * Tagged logger for the config module.
 */
const l = tagged({
  tag: 'config',
  l: parentLogger,
},);

/**
 * File-system locations consulted while loading auto-mode configuration.
 */
type AutoModeConfigLookup = {
  /**
   * Current working directory for project configuration.
   */
  readonly cwd: string;
  /**
   * Account home directory for optional global configuration.
   */
  readonly home?: string;
};

//region Public API

/**
 * Load and merge global + project config into a runtime config.
 *
 * Loads each half with {@link loadGlobalConfig} and {@link loadProjectConfig},
 * then compiles the merged pattern strings with {@link compilePatterns}.
 * Project config is additive: commands and patterns are concatenated.
 *
 * @param cwd - the current working directory
 *
 * @param home - account home directory containing optional global configuration
 *
 * @returns the merged runtime config
 *
 * @example
 * ```typescript
 * const config = loadMergedConfig({ cwd: process.cwd(), });
 * ```
 */
async function loadMergedConfig(
  {
    cwd,
    home,
  }: AutoModeConfigLookup,
): Promise<MergedConfig> {
  /**
   * Per-call sub-logger so log lines from this entry point carry the function name as a tag.
   */
  const innerL = tagged({
    tag: loadMergedConfig.name,
    l,
  },);
  innerL.debug(`loading config for cwd: ${cwd}`,);
  /**
   * Validated global config (or `GLOBAL_DEFAULTS` when the file is absent).
   */
  const global = await loadGlobalConfig(
    home === undefined
      ? {}
      : { home, },
  );
  /**
   * Project config lookup result; `found` discriminates whether a project-level file exists.
   */
  const project = await loadProjectConfig(cwd,);
  innerL.debug(
    `loaded global=${String(true,)} project=${String(project.found,)} enabled=${
      String(global.enabled,)
    }`,
  );

  /**
   * Mutable matcher list seeded from global config; project commands are appended below.
   */
  const commands: CommandMatcher[] = [...global.commands,];
  /**
   * Mutable pattern-string list seeded from global config; project patterns are appended below.
   */
  const patternStrs = [...global.patterns,];

  if (project.found) {
    /**
     * Project-level matchers and patterns destructured so the spreads below stay single-identifier.
     */
    const {
      commands: projectCommands,
      patterns: projectPatterns,
    } = project.config;
    commands.push(...projectCommands,);
    patternStrs.push(...projectPatterns,);
  }

  /**
   * Judge-model block from the global config, with `JUDGE_MODEL_DEFAULTS` as fallback for omitted files.
   */
  const rawJudgeModel = global.judgeModel
    ?? { ...JUDGE_MODEL_DEFAULTS, };

  /**
   * Override block re-attached to the judge model when the config pins one; an absent override stays absent.
   */
  const overrideContext = (
    function resolveOverrideContext(): {
      modelOverride?: ModelOverride;
    } {
      /**
       * Pinned-model override from the validated config, if any.
       */
      const ov = rawJudgeModel.modelOverride;
      if (ov === undefined)
        return {};
      if ((typeof ov) === 'string')
        return { modelOverride: ov, };
      /**
       * Override auth fields destructured so the conditional spreads below stay single-identifier.
       */
      const {
        apiKey,
        headers,
      } = ov.auth;
      /**
       * Inline auth assembled immutably so omitted keys stay absent rather than `undefined`.
       */
      const auth: BudgetModelAuth = {
        ...(apiKey !== undefined ? { apiKey, } : {}),
        ...(headers !== undefined ? { headers, } : {}),
      };
      return {
        modelOverride: {
          model: ov.model,
          auth,
        },
      };
    }
  )();

  /**
   * Validated judge-model block, with modelOverride re-attached only when the config pinned one.
   */
  const judgeModel: MergedConfig['judgeModel'] = {
    strategy: rawJudgeModel.strategy,
    majorVersions: rawJudgeModel.majorVersions,
    ...overrideContext,
  };

  /**
   * Project-instructions spread fragment: carries `projectInstructions` only
   * when a project config set a non-empty value, otherwise an empty object so
   * the key stays absent.
   */
  const projectInstructionsFragment = (
    function resolveProjectInstructions(): { projectInstructions?: string } {
      if (!project.found)
        return {};
      /**
       * Project-level instructions string, possibly absent or empty.
       */
      const { instructions, } = project.config;
      if ((instructions === undefined) || (instructions === ''))
        return {};
      return { projectInstructions: instructions, };
    }
  )();

  return {
    enabled: global.enabled,
    commands,
    patterns: compilePatterns({
      patterns: patternStrs,
      label: project.found ? 'global+project' : 'global',
    },),
    ...((global.instructions
      !== undefined) && (global.instructions
        !== '')
      ? { globalInstructions: global.instructions, }
      : {}),
    ...projectInstructionsFragment,
    judgeModel,
    judgeTimeoutMs: global.judgeTimeoutMs,
  };
}

//endregion

//region Internal loading

/**
 * Default global config values.
 */
const GLOBAL_DEFAULTS: AutoModeConfig = {
  enabled: true,
  commands: [],
  patterns: [],
  judgeModel: { ...JUDGE_MODEL_DEFAULTS, },
  judgeTimeoutMs: 10_000,
};

/**
 * Raw JSON object from config files.
 */
type RawJson = Record<string, unknown>;

/**
 * Default project config values.
 */
const PROJECT_DEFAULTS: ProjectConfig = {
  commands: [],
  patterns: [],
};

/** Get the global config file path.
 *
 * @returns the absolute path to the global config file
 */
function globalConfigPath(
  {
    home = homedir(),
  }: Readonly<Pick<AutoModeConfigLookup, 'home'>>,
): string {
  return join(
    home,
    '.pi',
    'agent',
    'extensions',
    'pi-auto-mode.json',
  );
}

/** Get the project config file path.
 *
 * @param cwd - the current working directory
 *
 * @returns the absolute path to the project config file
 */
function projectConfigPath(
  cwd: string,
): string {
  return join(
    cwd,
    '.pi',
    'extensions',
    'pi-auto-mode.json',
  );
}

/**
 * Read and parse a JSON config file.
 *
 * @returns parsed data, or `undefined` if file not found
 *
 * @example
 * ```typescript
 * const data = readJsonFile({ path: '/home/user/.pi/agent/extensions/pi-auto-mode.json', label: 'global' });
 * ```
 */
async function readJsonFile(
  {
    path,
    label,
  }: {
    readonly path: string;
    readonly label: string;
  },
): Promise<unknown> {
  try {
    return JSON.parse(await readFile(
      path,
      'utf8',
    ),);
  }
  catch (err) {
    /* oxlint-disable typescript/no-unsafe-type-assertion -- Node.js error code access */
    /**
     * Node-style errno (`ENOENT`, etc.) when the error originated in `fs`; `undefined` for anything else.
     */
    const errCode = ((Error.isError(err,)) && ('code' in err))
      ? (err as NodeJS.ErrnoException).code
      : undefined;
    /* oxlint-enable typescript/no-unsafe-type-assertion */
    if (errCode === 'ENOENT')
      return undefined;
    throw new Error(
      `auto-mode: failed to read ${label} config at ${path}: ${
        caughtValueText(err,)
      }`,
      { cause: err, },
    );
  }
}

/**
 * Compile user-provided regex strings into RegExp objects.
 *
 * @returns array of compiled RegExp objects
 *
 * @example
 * ```typescript
 * compilePatterns({ patterns: ["sudo"], label: "global" }); // [/sudo/]
 * ```
 */
function compilePatterns(
  {
    patterns,
    label,
  }: {
    readonly patterns: readonly string[];
    readonly label: string;
  },
): RegExp[] {
  return patterns.map(
    function compilePattern(p,) {
      try {
        // oxlint-disable-next-line no-restricted-syntax/no-regex, eslint/require-unicode-regexp -- user-supplied auto-mode config patterns: source comes from config file, compiled to RegExp for the scanner; the function's purpose IS user-pattern-to-regex compilation. The `u` flag is omitted deliberately: it enables strict escape parsing that would reject existing user patterns valid under the default (non-unicode) grammar.
        return new RegExp(p,);
      }
      catch (err) {
        throw new Error(
          `auto-mode: invalid regex in ${label} patterns: "${p}": ${
            caughtValueText(err,)
          }`,
          { cause: err, },
        );
      }
    },
  );
}

/** Load global config. Returns defaults if file doesn't exist.
 *
 * Partial config files are merged with defaults before validation,
 * so migrating from pi-safeguard (which only set `judgeModel.majorVersions`)
 * works without manually adding all fields.
 *
 * @returns the parsed global config
 */
async function loadGlobalConfig(
  options: Readonly<Pick<AutoModeConfigLookup, 'home'>>,
): Promise<AutoModeConfig> {
  /**
   * Absolute path to `~/.pi/agent/extensions/pi-auto-mode.json`.
   */
  const path = globalConfigPath(options,);
  /**
   * Parsed JSON contents, or `undefined` when the file is absent so the caller can fall back to defaults.
   */
  const raw = await readJsonFile({
    path,
    label: 'global',
  },);
  if (raw === undefined)
    return GLOBAL_DEFAULTS;
  /* oxlint-disable typescript/no-unsafe-type-assertion -- JSON.parse returns unknown; nested config from JSON */
  /**
   * Re-typed view of the JSON root as a record for spread/merge access.
   */
  const rawObj = raw as RawJson;
  /**
   * Nested judge-model block from disk; defaults to an empty object so deep-merge below sees a record.
   */
  const rawJudgeModel = (rawObj.judgeModel
    ?? {}) as RawJson;
  /* oxlint-enable typescript/no-unsafe-type-assertion */
  /**
   * Defaults overlaid with the on-disk record, with a deeper merge for the nested judge-model.
   */
  const merged = {
    ...GLOBAL_DEFAULTS,
    ...rawObj,
    judgeModel: {
      ...GLOBAL_DEFAULTS.judgeModel,
      ...rawJudgeModel,
    },
  };
  /**
   * valibot validation outcome; `success` discriminates the typed output from the issue list.
   */
  const result = v.safeParse(
    AutoModeConfigSchema,
    merged,
  );
  if (result.success)
    return result.output;
  throw new Error(
    `auto-mode: invalid global config at ${path}: ${JSON.stringify(result.issues,)}`,
  );
}

/** Load project config from cwd.
 *
 * Partial project config files are merged with defaults
 * before validation.
 *
 * @param cwd - the current working directory
 *
 * @returns `{ found: true, config }` when a project file exists, otherwise
 *   `{ found: false }`
 */
async function loadProjectConfig(
  cwd: string,
): Promise<{
  found: true;
  config: ProjectConfig;
} | { found: false }> {
  /**
   * Absolute path to `<cwd>/.pi/extensions/pi-auto-mode.json`.
   */
  const path = projectConfigPath(cwd,);
  /**
   * Parsed JSON contents, or `undefined` when the project file is absent.
   */
  const raw = await readJsonFile({
    path,
    label: 'project',
  },);
  if (raw === undefined)
    return { found: false, };
  /* oxlint-disable typescript/no-unsafe-type-assertion -- JSON.parse returns unknown */
  /**
   * Re-typed view of the JSON root as a record for spread/merge access.
   */
  const rawObj = raw as RawJson;
  /* oxlint-enable typescript/no-unsafe-type-assertion */
  /**
   * Project defaults overlaid with the on-disk record before schema validation.
   */
  const merged = {
    ...PROJECT_DEFAULTS,
    ...rawObj,
  };
  /**
   * valibot validation outcome; `success` discriminates the typed output from the issue list.
   */
  const result = v.safeParse(
    ProjectConfigSchema,
    merged,
  );
  if (!result.success)
    throw new Error(
      `auto-mode: invalid project config at ${path}: ${JSON.stringify(result.issues,)}`,
    );
  return {
    found: true,
    config: result.output,
  };
}

//endregion

export {
  compilePatterns,
  loadMergedConfig,
};
