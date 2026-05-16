/**
 * Shared type definitions for the pi Advisor extension.
 *
 * @module
 */

import type {
  Api,
  Model,
  StopReason,
  Usage,
} from '@earendil-works/pi-ai';
import type {
  AgentToolResult,
  ExtensionContext,
  ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import type {
  Static,
  TSchema,
} from 'typebox';

//region Configuration

/** Source metadata for merged Advisor config. */
export type AdvisorConfigSource = {
  /** Absolute path checked for global config. */
  globalPath: string;
  /** Absolute path checked for project config. */
  projectPath: string;
  /** Whether global config file existed and parsed. */
  globalLoaded: boolean;
  /** Whether project config file existed and parsed. */
  projectLoaded: boolean;
};

/** Runtime Advisor extension configuration. */
export type AdvisorConfig = {
  /** Whether Advisor starts enabled for each session. */
  enabled: boolean;
  /** Provider request timeout in milliseconds. */
  timeoutMs: number;
  /** Optional hard cap for serialized context characters sent to Advisor. */
  maxContextChars?: number;
  /** Maximum output tokens requested from the advisor model. */
  maxAdvisorOutputTokens: number;
  /** Whether prior Advisor tool results stay in serialized context. */
  includePriorAdvisorResults: boolean;
  /** Project-specific prompt suffix for the advisor model. */
  systemPrompt?: string;
  /** Config source metadata surfaced by `/advisor status`. */
  source: AdvisorConfigSource;
};

//endregion Configuration

//region Scope

/** Where the effective scoped model set came from. */
export type ScopeSource = 'live' | 'argv' | 'settings' | 'available';

/** Thinking level suffix carried by pi model scope patterns. */
export type ScopedThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

/** Model entry available to Advisor after scope resolution. */
export type ScopedAdvisorModel = {
  /** Pi model object. */
  model: Model<Api>;
  /** Canonical `provider/modelId` slug. */
  canonicalSlug: string;
  /** Thinking level suffix from a scope pattern, when present. */
  thinkingLevel?: ScopedThinkingLevel;
};

/** Effective scoped model set for a tool call or status query. */
export type EffectiveModelScope = {
  /** Source that produced this scoped model set. */
  source: ScopeSource;
  /** Models available to Advisor. */
  entries: ScopedAdvisorModel[];
  /** Patterns used for argv or settings scope reconstruction. */
  patterns?: string[];
};

//endregion Scope

//region Selection

/** Cost inputs computed for one model during default selection. */
export type ModelCostScore = {
  /** Canonical model slug. */
  slug: string;
  /** Input tokens estimated for serialized Advisor request. */
  inputTokens: number;
  /** Output-token budget used for ranking. */
  maxOutputTokens: number;
  /** Expected cost score used for ordering. */
  expectedCost: number;
  /** Input-token price from model metadata. */
  inputCost: number;
  /** Output-token price from model metadata. */
  outputCost: number;
  /** Model context window used as tie-breaker. */
  contextWindow: number;
};

/** Default model selection result. */
export type DefaultModelSelection = {
  /** Selected scoped model. */
  selected: ScopedAdvisorModel;
  /** Sorted scores, best first. */
  ranking: ModelCostScore[];
  /** Human-readable reason for the top rank. */
  reason: string;
};

/** Explicit or default selection result for a tool call. */
export type AdvisorModelSelection = {
  /** Selected scoped model. */
  selected: ScopedAdvisorModel;
  /** Requested slug, when user supplied one. */
  requestedSlug?: string;
  /** Default-selection metadata, present for empty params. */
  defaultSelection?: DefaultModelSelection;
};

//endregion Selection

//region Context

/** Serialized conversation context plus metadata. */
export type AdvisorContext = {
  /** Serialized conversation after deterministic truncation. */
  text: string;
  /** Effective serialized-context character budget used for truncation. */
  maxContextChars: number;
  /** Serialized conversation length before truncation. */
  originalChars: number;
  /** Serialized conversation length after truncation. */
  finalChars: number;
  /** Whether middle content was omitted. */
  truncated: boolean;
  /** Number of session messages included before LLM conversion. */
  includedMessageCount: number;
  /** Estimated tokens for the advisor request. */
  estimatedInputTokens: number;
  /** Latest user prompt excerpt, when one exists. */
  latestUserPromptExcerpt?: string;
};

//endregion Context

//region Tool and command results

/** Tool parameters exposed to the primary model. */
export type AdvisorToolParams = {
  /** Optional scoped model slug. Empty params select default highest-cost scoped model. */
  model?: string;
};

/** Structured details stored with Advisor tool and command results. */
export type AdvisorDetails = {
  /** User-requested slug, if supplied. */
  requestedSlug?: string;
  /** Canonical selected model slug. */
  selectedSlug: string;
  /** Selected model provider. */
  provider: string;
  /** Source of scoped model set. */
  scopeSource: ScopeSource;
  /** Canonical slugs allowed for this call. */
  scopedSlugs: string[];
  /** Default-selection reason, when empty params selected the model. */
  defaultSelectionReason?: string;
  /** Duration in milliseconds for provider call and local preparation. */
  durationMs: number;
  /** Effective serialized-context character budget for selected model. */
  contextBudgetChars: number;
  /** Final serialized context character count. */
  contextChars: number;
  /** Estimated input tokens for the advisor request. */
  estimatedInputTokens: number;
  /** Whether serialized context was truncated. */
  truncated: boolean;
  /** Advisor model stop reason. */
  stopReason: StopReason;
  /** Usage metadata returned by the provider, when present. */
  usage?: Usage;
  /** Default ranking scores, best first, for status and diagnostics. */
  costRanking?: ModelCostScore[];
};

/** Advisor text plus details. */
export type AdvisorRunResult = {
  /** Advisor text response. */
  text: string;
  /** Tool-compatible details object. */
  details: AdvisorDetails;
};

/** Arguments for executing Advisor. */
export type AdvisorRunOptions = {
  /** Pi extension context. */
  ctx: ExtensionContext;
  /** Runtime config. */
  config: AdvisorConfig;
  /** Optional user-requested model slug. */
  requestedSlug?: string;
  /** Current advisor tool call id, used to omit placeholder context. */
  toolCallId?: string;
  /** Abort signal from tool or command execution. */
  signal?: AbortSignal;
};

/** Advisor tool definition type with concrete parameters and details. */
export type AdvisorToolDefinition<TParameters extends TSchema = TSchema,> =
  ToolDefinition<
    TParameters,
    AdvisorDetails
  >;

/** Tool result shape returned by Advisor execution. */
export type AdvisorToolResult = AgentToolResult<AdvisorDetails>;

/** Extracted static parameter type for typebox schemas. */
export type ToolParamsFor<TParameters extends TSchema,> = Static<TParameters>;

//endregion Tool and command results
