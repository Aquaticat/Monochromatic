/**
 * Configuration loading and merging.
 *
 * Loads global and project config files, validates them
 * against zod/mini schemas, and merges into a runtime config.
 *
 * @module
 */

import { readFileSync, } from "node:fs";
import { join, } from "node:path";
import type {
  CommandMatcher,
  MergedConfig,
} from "./signals.ts";
import {
  AutoModeConfigSchema,
  type AutoModeConfig,
  ProjectConfigSchema,
  type ProjectConfig,
} from "./config-schemas.ts";

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
  const global = loadGlobalConfig();
  const project = loadProjectConfig(cwd);

  const commands: CommandMatcher[] = [...global.commands];
  const patternStrs = [...global.patterns];

  if (project !== undefined) {
    commands.push(...project.commands);
    patternStrs.push(...project.patterns);
  }

  const rawJudgeModel = global.judgeModel ?? {
    strategy: "same-provider" as const,
    costRatio: 0.5,
    majorVersions: 1,
  };

  const judgeModel: MergedConfig["judgeModel"] = {
    strategy: rawJudgeModel.strategy,
    costRatio: rawJudgeModel.costRatio,
    majorVersions: rawJudgeModel.majorVersions,
  };

  if (rawJudgeModel.modelOverride !== undefined) {
    if (typeof rawJudgeModel.modelOverride === "string") {
      judgeModel.modelOverride = rawJudgeModel.modelOverride;
    }
    else {
      const auth: {
        apiKey?: string;
        headers?: Record<string, string>;
      } = {};
      if (rawJudgeModel.modelOverride.auth.apiKey !== undefined) {
        auth.apiKey = rawJudgeModel.modelOverride.auth.apiKey;
      }
      if (rawJudgeModel.modelOverride.auth.headers !== undefined) {
        auth.headers = rawJudgeModel.modelOverride.auth.headers;
      }
      judgeModel.modelOverride = {
        model: rawJudgeModel.modelOverride.model,
        auth,
      };
    }
  }

  return {
    enabled: global.enabled,
    commands,
    patterns: compilePatterns(
      patternStrs,
      project !== undefined ? "global+project" : "global",
    ),
    ...(global.instructions !== undefined && global.instructions !== ""
      ? { globalInstructions: global.instructions }
      : {}),
    ...(project?.instructions !== undefined && project.instructions !== ""
      ? { projectInstructions: project.instructions }
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
  judgeModel: {
    strategy: "same-provider" as const,
    costRatio: 0.5,
    majorVersions: 1,
  },
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
    process.env.HOME ?? "~",
    ".pi",
    "agent",
    "extensions",
    "pi-auto-mode.json",
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
    ".pi",
    "extensions",
    "pi-auto-mode.json",
  );
}

/**
 * Read and parse a JSON config file.
 *
 * @param path - the file path
 *
 * @param label - human-readable label for error messages
 *
 * @returns parsed data, or `undefined` if file not found
 */
function readJsonFile(
  path: string,
  label: string,
): unknown {
  try {
    return JSON.parse(readFileSync(
      path,
      "utf8"
    ));
  }
  catch (err) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Node.js error code access
    const errCode = (err instanceof Error && "code" in err)
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Node.js error code access
      ? (err as NodeJS.ErrnoException).code
      : undefined;
    if (errCode === "ENOENT") return undefined;
    throw new Error(
      `auto-mode: failed to read ${label} config at ${path}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
}

/**
 * Parse raw config data against a zod schema.
 *
 * @param schema - the zod schema to validate against
 *
 * @param raw - the raw data to parse
 *
 * @param path - the file path (for error messages)
 *
 * @param label - human-readable label for error messages
 *
 * @returns the parsed config data
 */
function parseConfig<T>(
  schema: { safeParse: (data: unknown) => {
    success: boolean;
    data?: T;
    error?: unknown
  } },
  raw: unknown,
  path: string,
  label: string,
): T {
  const result = schema.safeParse(raw);
  if (result.success) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- zod infer requires assertion
    return result.data as T;
  }
  throw new Error(
    `auto-mode: invalid ${label} config at ${path}: ${JSON.stringify(result.error)}`,
  );
}

/**
 * Compile user-provided regex strings into RegExp objects.
 *
 * @param patterns - array of regex pattern strings
 *
 * @param label - human-readable label for error messages
 *
 * @returns array of compiled RegExp objects
 *
 * @example
 * ```typescript
 * compilePatterns(["sudo"], "global"); // [/sudo/]
 * ```
 */
function compilePatterns(
  patterns: string[],
  label: string,
): RegExp[] {
  return patterns.map(
    function compilePattern(p) {
      try {
        return new RegExp(p);
      }
      catch (err) {
        throw new Error(
          `auto-mode: invalid regex in ${label} patterns: "${p}" — ${err instanceof Error ? err.message : String(err)}`,
          { cause: err },
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
  const path = globalConfigPath();
  const raw = readJsonFile(
    path,
    "global"
  );
  if (raw === undefined) return GLOBAL_DEFAULTS;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse returns unknown
  const rawObj = raw as RawJson;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- nested config from JSON
  const rawJudgeModel = (rawObj.judgeModel as RawJson | undefined) ?? {};
  const merged = {
    ...GLOBAL_DEFAULTS,
    ...rawObj,
    judgeModel: {
      ...GLOBAL_DEFAULTS.judgeModel,
      ...rawJudgeModel,
    },
  };
  return parseConfig(
    AutoModeConfigSchema,
    merged,
    path,
    "global",
  );
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
  const path = projectConfigPath(cwd);
  const raw = readJsonFile(
    path,
    "project"
  );
  if (raw === undefined) return undefined;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse returns unknown
  const rawObj = raw as RawJson;
  const merged = {
    ...PROJECT_DEFAULTS,
    ...rawObj,
  };
  return parseConfig(
    ProjectConfigSchema,
    merged,
    path,
    "project",
  );
}

//endregion

export {
  compilePatterns,
  loadMergedConfig,
};
