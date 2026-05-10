/**
 * Zod/mini schema definitions for configuration.
 *
 * Extracted from config.ts to stay within the line limit.
 * Uses explicit `z.ZodMini*` type annotations for
 * `--isolatedDeclarations` compatibility.
 *
 * @module
 */

import * as z from "zod/mini";

//region Strategy enum

/** Strategy enum values for zod/mini (Record form required by EnumLike). */
const STRATEGY_ENUM = {
  "same-provider": "same-provider",
  "any-provider": "any-provider",
} as const;

//endregion

//region Schemas

/** Command matcher schema. */
const CommandMatcherSchema: z.ZodMiniUnion<readonly [
  z.ZodMiniString,
  z.ZodMiniArray<z.ZodMiniString>,
]> = z.union([
  z.string(),
  z.array(z.string()),
]);

/** Auth schema for model override. */
const AuthSchema: z.ZodMiniObject<{
  apiKey: z.ZodMiniOptional<z.ZodMiniString>;
  headers: z.ZodMiniOptional<z.ZodMiniRecord<z.ZodMiniString, z.ZodMiniString>>;
}> = z.object({
  apiKey: z.optional(z.string()),
  headers: z.optional(
    z.record(
      z.string(),
      z.string()
    ),
  ),
});

/** Model override schema. */
const ModelOverrideSchema: z.ZodMiniUnion<readonly [
  z.ZodMiniString,
  z.ZodMiniObject<{
    model: z.ZodMiniString;
    auth: z.ZodMiniObject<{
      apiKey: z.ZodMiniOptional<z.ZodMiniString>;
      headers: z.ZodMiniOptional<z.ZodMiniRecord<z.ZodMiniString, z.ZodMiniString>>;
    }>;
  }>,
]> = z.union([
  z.string(),
  z.object({
    model: z.string(),
    auth: AuthSchema,
  }),
]);

/** Judge model configuration schema. */
const JudgeModelSchema: z.ZodMiniObject<{
  modelOverride: z.ZodMiniOptional<z.ZodMiniUnion<readonly [
    z.ZodMiniString,
    z.ZodMiniObject<{
      model: z.ZodMiniString;
      auth: z.ZodMiniObject<{
        apiKey: z.ZodMiniOptional<z.ZodMiniString>;
        headers: z.ZodMiniOptional<z.ZodMiniRecord<z.ZodMiniString, z.ZodMiniString>>;
      }>;
    }>,
  ]>>;
  strategy: z.ZodMiniEnum<typeof STRATEGY_ENUM>;
  costRatio: z.ZodMiniNumber;
  majorVersions: z.ZodMiniNumber;
}> = z.object({
  modelOverride: z.optional(ModelOverrideSchema),
  strategy: z.enum(STRATEGY_ENUM),
  costRatio: z.number(),
  majorVersions: z.number(),
});

/** Shared config fields (commands, patterns, instructions). */
const SharedConfigSchema: z.ZodMiniObject<{
  commands: z.ZodMiniArray<z.ZodMiniUnion<readonly [
    z.ZodMiniString,
    z.ZodMiniArray<z.ZodMiniString>,
  ]>>;
  patterns: z.ZodMiniArray<z.ZodMiniString>;
  instructions: z.ZodMiniOptional<z.ZodMiniString>;
}> = z.object({
  commands: z.array(CommandMatcherSchema),
  patterns: z.array(z.string()),
  instructions: z.optional(z.string()),
});

/** Global config schema. */
const AutoModeConfigSchema: z.ZodMiniObject<{
  commands: z.ZodMiniArray<z.ZodMiniUnion<readonly [
    z.ZodMiniString,
    z.ZodMiniArray<z.ZodMiniString>,
  ]>>;
  patterns: z.ZodMiniArray<z.ZodMiniString>;
  instructions: z.ZodMiniOptional<z.ZodMiniString>;
  enabled: z.ZodMiniBoolean;
  judgeModel: z.ZodMiniOptional<typeof JudgeModelSchema>;
  judgeTimeoutMs: z.ZodMiniNumber;
}> = z.object({
  commands: z.array(CommandMatcherSchema),
  patterns: z.array(z.string()),
  instructions: z.optional(z.string()),
  enabled: z.boolean(),
  judgeModel: z.optional(JudgeModelSchema),
  judgeTimeoutMs: z.number(),
});

/** Project config schema. */
const ProjectConfigSchema: typeof SharedConfigSchema = SharedConfigSchema;

/** Inferred type from the global config schema. */
type AutoModeConfig = z.infer<typeof AutoModeConfigSchema>;
/** Inferred type from the project config schema. */
type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

//endregion

export {
  AutoModeConfigSchema,
  ProjectConfigSchema,
  STRATEGY_ENUM,
};
export type {
  AutoModeConfig,
  ProjectConfig,
};
