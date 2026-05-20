/**
 * Configuration loading and merging.
 *
 * Loads global and project config files, validates them
 * against valibot schemas, and merges into a runtime config.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/tagged';
import { readFileSync, } from 'node:fs';
import { join, } from 'node:path';
import * as v from 'valibot';
import {
  type AutoModeConfig,
  AutoModeConfigSchema,
  type ProjectConfig,
  ProjectConfigSchema,
} from './config-schemas.ts';
import { JUDGE_MODEL_DEFAULTS, } from './constants.ts';
import { l as parentLogger, } from './log.ts';
import type {
  CommandMatcher,
  MergedConfig,
} from './signals.ts';
import type { BudgetModelAuth, } from './types.ts';

/** Tagged logger for the config module. */
const l = tagged({
  tag: 'config',
  l: parentLogger,
},);

//region Public API

/**
 * Load and merge global + project config into a runtime config.
 *
 * Project config is additive: commands and patterns are concatenated.
 *
 * @param cwd - the current working directory
 *
 * @returns the merged runtime config
 *
 * @example
 * ```typescript
 * const config = loadMergedConfig(process.cwd());
 * ```
 */
function loadMergedConfig(
  cwd: string,
): MergedConfig {
  /** Per-call sub-logger so log lines from this entry point carry the function name as a tag. */
  const innerL = tagged({
    tag: loadMergedConfig.name,
    l,
  },);
  innerL.debug(`loading config for cwd: ${cwd}`,);
  /** Validated global config (or `GLOBAL_DEFAULTS` when the file is absent). */
  const global = loadGlobalConfig();
  /** Validated project config, or `undefined` when no project-level file exists. */
  const project = loadProjectConfig(cwd,);
  innerL.debug(
    `loaded global=${String(true,)} project=${String(project !== undefined,)} enabled=${
      String(global.enabled,)
    }`,
  );

  /** Mutable matcher list seeded from global config; project commands are appended below. */
  const commands: CommandMatcher[] = [...global.commands,];
  /** Mutable pattern-string list seeded from global config; project patterns are appended below. */
  const patternStrs = [...global.patterns,];

  if (project !== undefined) {
    commands.push(...project.commands,);
    patternStrs.push(...project.patterns,);
  }

  /** Judge-model block from the global config, with `JUDGE_MODEL_DEFAULTS` as fallback for omitted files. */
  const rawJudgeModel = global.judgeModel ?? { ...JUDGE_MODEL_DEFAULTS, };

  /** Cleaned judge-model view that drops `modelOverride` so it can be re-attached conditionally below. */
  const judgeModel: MergedConfig['judgeModel'] = {
    strategy: rawJudgeModel.strategy,
    costRatio: rawJudgeModel.costRatio,
    majorVersions: rawJudgeModel.majorVersions,
  };

  if (rawJudgeModel.modelOverride !== undefined) {
    if ((typeof rawJudgeModel.modelOverride) === 'string')
      judgeModel.modelOverride = rawJudgeModel.modelOverride;
    else {
      /** Auth object assembled field-by-field so omitted keys stay undefined rather than `null`. */
      const auth: BudgetModelAuth = {};
      if (rawJudgeModel.modelOverride.auth.apiKey !== undefined)
        auth.apiKey = rawJudgeModel.modelOverride.auth.apiKey;
      if (rawJudgeModel.modelOverride.auth.headers !== undefined)
        auth.headers = rawJudgeModel.modelOverride.auth.headers;
      judgeModel.modelOverride = {
        model: rawJudgeModel.modelOverride.model,
        auth,
      };
    }
  }

  return {
    enabled: global.enabled,
    commands,
    patterns: compilePatterns({
      patterns: patternStrs,
      label: project !== undefined ? 'global+project' : 'global',
    },),
    ...((global.instructions !== undefined) && (global.instructions !== '')
      ? { globalInstructions: global.instructions, }
      : {}),
    ...((project?.instructions !== undefined) && (project.instructions !== '')
      ? { projectInstructions: project.instructions, }
      : {}),
    judgeModel,
    judgeTimeoutMs: global.judgeTimeoutMs,
  };
}

//endregion

//region Internal loading

/** Default global config values. */
const GLOBAL_DEFAULTS: AutoModeConfig = {
  enabled: true,
  commands: [],
  patterns: [],
  judgeModel: { ...JUDGE_MODEL_DEFAULTS, },
  judgeTimeoutMs: 10_000,
};

/** Raw JSON object from config files. */
type RawJson = Record<string, unknown>;

/** Default project config values. */
const PROJECT_DEFAULTS: ProjectConfig = {
  commands: [],
  patterns: [],
};

/** Get the global config file path.
 *
 * @returns the absolute path to the global config file
 */
function globalConfigPath(): string {
  return join(
    process.env.HOME ?? '~',
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
function readJsonFile(
  {
    path,
    label,
  }: {
    path: string;
    label: string;
  },
): unknown {
  try {
    return JSON.parse(readFileSync(
      path,
      'utf8',
    ),);
  }
  catch (err) {
    /* oxlint-disable typescript/no-unsafe-type-assertion -- Node.js error code access */
    /** Node-style errno (`ENOENT`, etc.) when the error originated in `fs`; `undefined` for anything else. */
    const errCode = ((err instanceof Error) && ('code' in err))
      ? (err as NodeJS.ErrnoException).code
      : undefined;
    /* oxlint-enable typescript/no-unsafe-type-assertion */
    if (errCode === 'ENOENT')
      return undefined;
    throw new Error(
      `auto-mode: failed to read ${label} config at ${path}: ${
        err instanceof Error ? err.message : String(err,)
      }`,
      { cause: err, },
    );
  }
}

/**
 * Parse raw config data against a valibot schema.
 *
 * @returns parsed config data
 *
 * @throws when validation fails
 *
 * @example
 * ```typescript
 * const cfg = parseConfig({ schema: AutoModeConfigSchema, raw, path, label: 'global' });
 * ```
 */
function parseConfig<T,>(
  {
    schema,
    raw,
    path,
    label,
  }: {
    schema: v.GenericSchema<unknown, T>;
    raw: unknown;
    path: string;
    label: string;
  },
): T {
  /** valibot safe-parse outcome; `success` discriminates between the typed output and a list of issues. */
  const result = v.safeParse(
    schema,
    raw,
  );
  if (result.success)
    return result.output;
  throw new Error(
    `auto-mode: invalid ${label} config at ${path}: ${JSON.stringify(result.issues,)}`,
  );
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
    patterns: string[];
    label: string;
  },
): RegExp[] {
  return patterns.map(
    function compilePattern(p,) {
      try {
        // oxlint-disable-next-line no-restricted-syntax/no-regex -- user-supplied auto-mode config patterns: source comes from config file, compiled to RegExp for the scanner; the function's purpose IS user-pattern-to-regex compilation.
        return new RegExp(p,);
      }
      catch (err) {
        throw new Error(
          `auto-mode: invalid regex in ${label} patterns: "${p}": ${
            err instanceof Error ? err.message : String(err,)
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
function loadGlobalConfig(): AutoModeConfig {
  /** Absolute path to `~/.pi/agent/extensions/pi-auto-mode.json`. */
  const path = globalConfigPath();
  /** Parsed JSON contents, or `undefined` when the file is absent so the caller can fall back to defaults. */
  const raw = readJsonFile({
    path,
    label: 'global',
  },);
  if (raw === undefined)
    return GLOBAL_DEFAULTS;
  /* oxlint-disable typescript/no-unsafe-type-assertion -- JSON.parse returns unknown; nested config from JSON */
  /** Re-typed view of the JSON root as a record for spread/merge access. */
  const rawObj = raw as RawJson;
  /** Nested judge-model block from disk; defaults to an empty object so deep-merge below sees a record. */
  const rawJudgeModel = (rawObj.judgeModel as RawJson | undefined) ?? {};
  /* oxlint-enable typescript/no-unsafe-type-assertion */
  /** Defaults overlaid with the on-disk record, with a deeper merge for the nested judge-model. */
  const merged = {
    ...GLOBAL_DEFAULTS,
    ...rawObj,
    judgeModel: {
      ...GLOBAL_DEFAULTS.judgeModel,
      ...rawJudgeModel,
    },
  };
  return parseConfig({
    schema: AutoModeConfigSchema,
    raw: merged,
    path,
    label: 'global',
  },);
}

/** Load project config from cwd.
 *
 * Partial project config files are merged with defaults
 * before validation.
 *
 * @param cwd - the current working directory
 *
 * @returns parsed project config, or `undefined` if not found
 */
function loadProjectConfig(
  cwd: string,
): ProjectConfig | undefined {
  /** Absolute path to `<cwd>/.pi/extensions/pi-auto-mode.json`. */
  const path = projectConfigPath(cwd,);
  /** Parsed JSON contents, or `undefined` when the project file is absent. */
  const raw = readJsonFile({
    path,
    label: 'project',
  },);
  if (raw === undefined)
    return undefined;
  /* oxlint-disable typescript/no-unsafe-type-assertion -- JSON.parse returns unknown */
  /** Re-typed view of the JSON root as a record for spread/merge access. */
  const rawObj = raw as RawJson;
  /* oxlint-enable typescript/no-unsafe-type-assertion */
  /** Project defaults overlaid with the on-disk record before schema validation. */
  const merged = {
    ...PROJECT_DEFAULTS,
    ...rawObj,
  };
  return parseConfig({
    schema: ProjectConfigSchema,
    raw: merged,
    path,
    label: 'project',
  },);
}

//endregion

export {
  compilePatterns,
  loadMergedConfig,
};
