/**
 * Valibot schemas for Advisor extension configuration.
 *
 * @module
 */

import * as v from 'valibot';

//region Types

/** Raw configuration file shape before defaults are applied. */
export type AdvisorConfigFile = {
  /** Whether Advisor starts enabled. */
  enabled?: boolean | undefined;
  /** Provider timeout in milliseconds. */
  timeoutMs?: number | undefined;
  /** Maximum serialized context characters. */
  maxContextChars?: number | undefined;
  /** Maximum Advisor output tokens. */
  maxAdvisorOutputTokens?: number | undefined;
  /** Whether prior Advisor results stay in context. */
  includePriorAdvisorResults?: boolean | undefined;
  /** Project-specific Advisor prompt suffix. */
  systemPrompt?: string | undefined;
};

/** Settings file subset needed for scoped-model reconstruction. */
export type AdvisorSettingsFile = {
  /** Pi model-cycle patterns. */
  enabledModels?: string[] | undefined;
};

//endregion Types

//region Schemas

/** Positive number schema used for budget and timeout fields. */
const PositiveNumberSchema: v.GenericSchema<number> = v.pipe(
  v.number(),
  v.minValue(1,),
);

/** Advisor configuration file schema. */
export const AdvisorConfigFileSchema: v.GenericSchema<AdvisorConfigFile> = v.object({
  enabled: v.optional(v.boolean(),),
  timeoutMs: v.optional(PositiveNumberSchema,),
  maxContextChars: v.optional(PositiveNumberSchema,),
  maxAdvisorOutputTokens: v.optional(PositiveNumberSchema,),
  includePriorAdvisorResults: v.optional(v.boolean(),),
  systemPrompt: v.optional(v.string(),),
},);

/** Pi settings subset schema. */
export const AdvisorSettingsFileSchema: v.GenericSchema<AdvisorSettingsFile> = v.object({
  enabledModels: v.optional(v.array(v.string(),),),
},);

//endregion Schemas
