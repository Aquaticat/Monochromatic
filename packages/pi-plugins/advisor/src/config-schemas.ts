/**
 * Valibot schemas for Advisor extension configuration.
 *
 * @module
 */

import * as v from 'valibot';

//region Types

/**
 * Raw configuration file shape before defaults are applied.
 */
export type AdvisorConfigFile = {
  /**
   * Whether Advisor starts enabled.
   */
  readonly enabled?: boolean;
  /**
   * Provider timeout in milliseconds.
   */
  readonly timeoutMs?: number;
  /**
   * Maximum serialized context characters.
   */
  readonly maxContextChars?: number;
  /**
   * Maximum Advisor output tokens.
   */
  readonly maxAdvisorOutputTokens?: number;
  /**
   * Whether prior Advisor results stay in context.
   */
  readonly includePriorAdvisorResults?: boolean;
  /**
   * Project-specific Advisor prompt suffix.
   */
  readonly systemPrompt?: string;
};

/**
 * Settings file subset needed for scoped-model reconstruction.
 */
export type AdvisorSettingsFile = {
  /**
   * Pi model-cycle patterns.
   */
  readonly enabledModels?: readonly string[];
};

//endregion Types

//region Schemas

/**
 * String schema used inside settings arrays.
 */
const StringSchema: v.GenericSchema<string> = v.string();

/**
 * Positive number schema used for budget and timeout fields.
 */
const PositiveNumberSchema: v.GenericSchema<number> = v.pipe(
  v.number(),
  v.minValue(1,),
);

/**
 * Advisor configuration file schema.
 */
export const AdvisorConfigFileSchema: v.GenericSchema<AdvisorConfigFile> = v.object({
  enabled: v.exactOptional(v.boolean(),),
  timeoutMs: v.exactOptional(PositiveNumberSchema,),
  maxContextChars: v.exactOptional(PositiveNumberSchema,),
  maxAdvisorOutputTokens: v.exactOptional(PositiveNumberSchema,),
  includePriorAdvisorResults: v.exactOptional(v.boolean(),),
  systemPrompt: v.exactOptional(v.string(),),
},);

/**
 * Pi settings subset schema.
 */
export const AdvisorSettingsFileSchema: v.GenericSchema<AdvisorSettingsFile> = v.object({
  enabledModels: v.exactOptional(
    v.array(StringSchema,),
  ),
},);

//endregion Schemas
