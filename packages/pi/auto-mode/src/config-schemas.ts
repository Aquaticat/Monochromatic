/**
 * Valibot schema definitions for configuration.
 *
 * Uses `v.GenericSchema` annotations for `--isolatedDeclarations` compatibility.
 *
 * @module
 */

import * as v from 'valibot';

//region Strategy enum

/**
 * Strategy literal values for the judge-model selection strategy.
 */
const STRATEGY_VALUES = [
  'same-provider',
  'any-provider',
] as const;

/**
 * Strategy literal type derived from {@link STRATEGY_VALUES}.
 */
type Strategy = (typeof STRATEGY_VALUES)[number];

/**
 * Record form retained for backwards-compatible callers that key by strategy name.
 */
const STRATEGY_ENUM = {
  'same-provider': 'same-provider',
  'any-provider': 'any-provider',
} as const;

//endregion

//region Schemas

/**
 * Auth shape for a model override.
 */
type AuthShape = {
  apiKey?: string;
  headers?: Record<string, string>;
};

/**
 * Model override shape: either a model name string, or `{model, auth}`.
 */
type ModelOverride =
  | string
  | {
    model: string;
    auth: AuthShape;
  };

/**
 * Judge model configuration shape.
 */
type JudgeModel = {
  modelOverride?: ModelOverride;
  strategy: Strategy;
  costRatio?: number;
  majorVersions: number;
};

/**
 * Auto-mode global configuration shape.
 */
type AutoModeConfig = {
  commands: (string | string[])[];
  patterns: string[];
  instructions?: string;
  enabled: boolean;
  judgeModel?: JudgeModel;
  judgeTimeoutMs: number;
};

/**
 * Auto-mode project configuration shape (subset of {@link AutoModeConfig}).
 */
type ProjectConfig = {
  commands: (string | string[])[];
  patterns: string[];
  instructions?: string;
};

/**
 * Command matcher schema: either a literal command or an array of arguments.
 */
const CommandMatcherSchema: v.GenericSchema<string | string[]> = v.union([
  v.string(),
  v.array(v.string(),),
],);

/**
 * Auth schema for model override.
 */
const AuthSchema: v.GenericSchema<AuthShape> = v.object({
  apiKey: v.exactOptional(v.string(),),
  headers: v.exactOptional(
    v.record(
      v.string(),
      v.string(),
    ),
  ),
},);

/**
 * Model override schema.
 */
const ModelOverrideSchema: v.GenericSchema<ModelOverride> = v.union([
  v.string(),
  v.object({
    model: v.string(),
    auth: AuthSchema,
  },),
],);

/**
 * Judge model configuration schema.
 */
const JudgeModelSchema: v.GenericSchema<JudgeModel> = v.object({
  modelOverride: v.exactOptional(ModelOverrideSchema,),
  strategy: v.picklist(STRATEGY_VALUES,),
  costRatio: v.exactOptional(v.number(),),
  majorVersions: v.number(),
},);

/**
 * Global config schema.
 */
const AutoModeConfigSchema: v.GenericSchema<AutoModeConfig> = v.object({
  commands: v.array(CommandMatcherSchema,),
  patterns: v.array(v.string(),),
  instructions: v.exactOptional(v.string(),),
  enabled: v.boolean(),
  judgeModel: v.exactOptional(JudgeModelSchema,),
  judgeTimeoutMs: v.number(),
},);

/**
 * Project config schema.
 */
const ProjectConfigSchema: v.GenericSchema<ProjectConfig> = v.object({
  commands: v.array(CommandMatcherSchema,),
  patterns: v.array(v.string(),),
  instructions: v.exactOptional(v.string(),),
},);

//endregion

export {
  AutoModeConfigSchema,
  ProjectConfigSchema,
  STRATEGY_ENUM,
  STRATEGY_VALUES,
};
export type {
  AuthShape,
  AutoModeConfig,
  JudgeModel,
  ModelOverride,
  ProjectConfig,
  Strategy,
};
