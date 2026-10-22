/**
 NeuralWatt listing mapping: listing entries to the pi-ai provider profiles
 the shipped adapter serves. @module
 */

import type {
  PiAiModelProfile,
  PiAiProviderProfile,
  PiAiReasoningEfforts,
} from '@deepseek-ai/dsh-llm-pi-ai';
import {
  NEURALWATT_API,
  NEURALWATT_API_KEY_ENV,
  NEURALWATT_BASE_URL,
  NEURALWATT_ROUTE,
} from './constants.ts';

//region Types

/**
 One model entry of the NeuralWatt listing, reduced to the fields the mapping
 reads. Every field stays `unknown` because the listing is external JSON: each
 read narrows what it accepts instead of trusting a declared shape. The
 listing's `metadata.pricing` block exists but is deliberately absent here:
 this provider serves models, it does not estimate cost.
 */
export type NeuralWattListingEntry = {
  readonly id?: unknown;
  readonly max_model_len?: unknown;
  readonly deprecated?: unknown;
  readonly metadata?: unknown;
};

//endregion Types

//region External JSON narrowing

/**
 Narrow one external value to a plain record, the shape every metadata read
 starts from; arrays and null describe no object of named fields.

 @param value - value read out of external JSON

 @returns `true` when `value` carries named fields

 @example
 ```ts
 const metadata = isRecord(entry.metadata) ? entry.metadata : {};
 ```
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 Narrow one external value to a non-empty string.
 */
function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 Narrow one external value to a positive integer token count; zero and
 fractional counts describe nothing a request may size against.
 */
function positiveInt(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

/**
 Narrow one external value to an array of strings, or nothing when any member
 is not a string; a mixed list describes no set of effort spellings.
 */
function stringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value))
    return undefined;
  /**
   Narrowed members collected in list order.
   */
  const members: string[] = [];
  for (const member of value) {
    /**
     One member narrowed to its string form.
     */
    const text = nonEmptyString(member);
    if (text === undefined)
      return undefined;
    members.push(text,);
  }
  return members;
}

//endregion External JSON narrowing

//region Public API

/**
 Map one listing effort spelling to the pi-ai thinking level key that offers
 it.

 Unrecognized spellings yield nothing: the mapping never guesses a level for
 an effort it cannot express, so a listing the mapping does not know yet
 degrades to fewer offered levels instead of wrong ones.

 @param effort - effort spelling from `supported_efforts` or `accepted_efforts`

 @returns thinking level key, or nothing when the spelling is not expressible

 @example
 ```ts
 const key = thinkingLevelKeyForEffort({ effort: 'xhigh', },);
 ```
 */
export function thinkingLevelKeyForEffort(
  { effort, }: { readonly effort: string; },
): keyof PiAiReasoningEfforts | undefined {
  switch (effort) {
    case 'none':
      return 'off';
    case 'minimal':
    case 'low':
    case 'medium':
    case 'high':
    case 'xhigh':
    case 'max':
      return effort;
    default:
      return undefined;
  }
}

/**
 Map one listing entry's reasoning block to the selectable pi-ai thinking
 levels.

 Offered keys are the distinct efforts `supported_efforts` names (`none`
 becoming `off`), each level sending its own spelling, which is the set the
 listing documents the wire accepting. `accepted_efforts` serves only as the
 fallback when `supported_efforts` is missing, minus the spellings
 `effort_aliases` marks as aliases of another effort. A model the capabilities
 mark non-reasoning declares `false`; a resolvable effort set with no level
 beyond `off` declares `false` as well, since no thinking is selectable.

 @param metadata - one listing entry's `metadata` record

 @returns thinking-level dict, `false` for a non-reasoning model, or nothing
 when the entry offers efforts but does not list them

 @example
 ```ts
 const efforts = mapReasoningEfforts({ metadata: entry.metadata, },);
 ```
 */
export function mapReasoningEfforts(
  { metadata, }: { readonly metadata: Record<string, unknown>; },
): false | PiAiReasoningEfforts | undefined {
  /**
   Capability flags the reasoning declaration reads.
   */
  const capabilities = isRecord(metadata.capabilities)
    ? metadata.capabilities
    : {};
  /**
   Reasoning block carrying the effort spellings.
   */
  const reasoning = isRecord(metadata.reasoning) ? metadata.reasoning : {};
  if (capabilities.reasoning === false)
    return false;
  /**
   Distinct efforts the model supports; the primary spelling source.
   */
  const supported = stringArray(reasoning.supported_efforts);
  /**
   Every spelling the wire accepts, alias spellings included.
   */
  const accepted = stringArray(reasoning.accepted_efforts);
  /**
   Alias spellings keyed by the spelling that names them.
   */
  const aliases = isRecord(reasoning.effort_aliases)
    ? reasoning.effort_aliases
    : {};
  /**
   Spellings whose levels to offer: supported efforts, else accepted efforts
   that are not aliases of another effort.
   */
  const spellings = supported
    ?? (accepted === undefined
      ? undefined
      : accepted.filter((effort) => !Object.hasOwn(aliases, effort,),));
  if (spellings === undefined)
    return undefined;
  /**
   Offered levels keyed by thinking level, each sending its own spelling.
   */
  const efforts: PiAiReasoningEfforts = {};
  for (const spelling of spellings) {
    /**
     Thinking level key this spelling offers.
     */
    const key = thinkingLevelKeyForEffort({ effort: spelling, },);
    if (key === undefined)
      continue;
    efforts[key] = spelling;
  }
  for (const key of Object.keys(efforts)) {
    if (key !== 'off')
      return efforts;
  }
  return false;
}

/**
 Map one listing entry to the pi-ai model profile the adapter serves.

 An entry the mapping cannot describe (no id, or one the listing marks
 deprecated) yields nothing and stays off the route instead of serving a model
 whose facts are wrong. Context window comes from `limits.max_context_length`
 then `max_model_len`; output tokens come from `limits.max_output_tokens` and
 are left unset when the listing discloses none.

 @param entry - one NeuralWatt listing entry

 @returns model profile, or nothing when the entry is not serviceable

 @example
 ```ts
 const model = mapNeuralWattModel({ entry: listing[0], },);
 ```
 */
export function mapNeuralWattModel(
  { entry, }: { readonly entry: NeuralWattListingEntry; },
): PiAiModelProfile | undefined {
  /**
   Model id the endpoint accepts.
   */
  const id = nonEmptyString(entry.id);
  if (id === undefined)
    return undefined;
  if (entry.deprecated === true)
    return undefined;
  /**
   Metadata record carrying the human and sizing facts.
   */
  const metadata = isRecord(entry.metadata) ? entry.metadata : {};
  /**
   Disclosed token limits.
   */
  const limits = isRecord(metadata.limits) ? metadata.limits : {};
  /**
   Capability flags the modality and reasoning declarations read.
   */
  const capabilities = isRecord(metadata.capabilities)
    ? metadata.capabilities
    : {};
  /**
   Context capacity in tokens, disclosed by limits or the endpoint's model
   length.
   */
  const contextWindow = positiveInt(limits.max_context_length)
    ?? positiveInt(entry.max_model_len);
  /**
   Output capability in tokens, only when the listing discloses one.
   */
  const maxTokens = positiveInt(limits.max_output_tokens);
  /**
   Selectable thinking levels, or `false` for a non-reasoning model.
   */
  const reasoningEfforts = mapReasoningEfforts({ metadata, },);
  return {
    id,
    name: nonEmptyString(metadata.display_name) ?? id,
    ...(contextWindow === undefined ? {} : { contextWindow, }),
    ...(maxTokens === undefined ? {} : { maxTokens, }),
    input: capabilities.vision === true ? ['text', 'image'] : ['text'],
    ...(reasoningEfforts === undefined ? {} : { reasoningEfforts, }),
  };
}

/**
 Map one listing to the provider dict the shipped adapter registers: one
 `neuralwatt` route carrying every serviceable model.

 The route keeps the credential reference, wire protocol, and endpoint the
 profile's hand-declared block used, and pins
 `compat.supportsReasoningEffort` so a selected thinking level dispatches as
 the documented `reasoning_effort` parameter instead of being dropped by
 pi-ai's URL-based detection.

 @param listing - NeuralWatt listing entries

 @returns provider dict keyed by route

 @example
 ```ts
 const providers = mapNeuralWattProviders({ listing, },);
 ```
 */
export function mapNeuralWattProviders(
  { listing, }: { readonly listing: readonly NeuralWattListingEntry[]; },
): Record<string, PiAiProviderProfile> {
  /**
   Serviceable model profiles in listing order.
   */
  const models: PiAiModelProfile[] = [];
  for (const entry of listing) {
    /**
     One entry mapped, or nothing when the entry is not serviceable.
     */
    const model = mapNeuralWattModel({ entry, },);
    if (model !== undefined)
      models.push(model,);
  }
  return {
    [NEURALWATT_ROUTE]: {
      apiKeyEnv: NEURALWATT_API_KEY_ENV,
      api: NEURALWATT_API,
      baseURL: NEURALWATT_BASE_URL,
      compat: { supportsReasoningEffort: true, },
      models,
    },
  };
}

//endregion Public API
