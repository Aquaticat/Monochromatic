/**
 * Shared type definitions for the pi Advisor extension.
 *
 * @module
 */

import type {
  StopReason,
  Usage,
} from '@earendil-works/pi-ai';
import type {
  AgentToolResult,
  ExtensionContext,
  ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import type { ReadonlyDeep, } from 'type-fest';
import type {
  ForeignBorrowed,
  ForeignHostCapability,
} from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type {
  Static,
  TSchema,
} from 'typebox';
import type {
  DefaultModelSelection as SharedDefaultModelSelection,
  EffectiveModelScope as SharedEffectiveModelScope,
  ModelCostScore as SharedModelCostScore,
  ReadonlyModel,
  ScopedModel,
  ScopedThinkingLevel as SharedScopedThinkingLevel,
  ScopeSource as SharedScopeSource,
} from '@monochromatic-dev/pi-shared-model-selection/ts';

//region Configuration

/**
 * Source metadata for merged Advisor config.
 */
export type AdvisorConfigSource = {
  /**
   * Absolute path checked for global config.
   */
  readonly globalPath: string;
  /**
   * Absolute path checked for project config.
   */
  readonly projectPath: string;
  /**
   * Whether global config file existed and parsed.
   */
  readonly globalLoaded: boolean;
  /**
   * Whether project config file existed and parsed.
   */
  readonly projectLoaded: boolean;
};

/**
 * Runtime Advisor extension configuration.
 */
export type AdvisorConfig = {
  /**
   * Whether Advisor starts enabled for each session.
   */
  readonly enabled: boolean;
  /**
   * Provider request timeout in milliseconds.
   */
  readonly timeoutMs: number;
  /**
   * Optional hard cap for serialized context characters sent to Advisor.
   */
  readonly maxContextChars?: number;
  /**
   * Maximum output tokens requested from the advisor model.
   */
  readonly maxAdvisorOutputTokens: number;
  /**
   * Whether prior Advisor tool results stay in serialized context.
   */
  readonly includePriorAdvisorResults: boolean;
  /**
   * Project-specific prompt suffix for the advisor model.
   */
  readonly systemPrompt?: string;
  /**
   * Config source metadata surfaced by `/advisor status`.
   */
  readonly source: AdvisorConfigSource;
};

//endregion Configuration

//region Scope

/**
 * Where the effective scoped model set came from.
 */
export type ScopeSource = SharedScopeSource;

/**
 * Thinking level suffix carried by pi model scope patterns.
 */
export type ScopedThinkingLevel = SharedScopedThinkingLevel;

/**
 * Deep-readonly view of pi-ai's `Model<Api>` with `api` widened to plain `string`.
 *
 * Pi-ai's `Api` is `KnownApi | (string & {})`; the `(string & {})` brand
 * trick is treated as non-readonly by the lint rule. Hand-authoring the
 * mirror with primitive types cleans the chain reliably while remaining
 * structurally assignable from the live `Model<Api>` value.
 */
export type AdvisorReadonlyModel = ReadonlyModel;

/**
 * Model entry available to Advisor after scope resolution.
 */
export type ScopedAdvisorModel = ScopedModel;

/**
 * Effective scoped model set for a tool call or status query.
 */
export type EffectiveModelScope = SharedEffectiveModelScope;

//endregion Scope

//region Selection

/**
 * Cost inputs computed for one model during default selection.
 */
export type ModelCostScore = SharedModelCostScore;

/**
 * Default model selection result.
 */
export type DefaultModelSelection = SharedDefaultModelSelection;

/**
 * Explicit or default selection result for a tool call.
 */
export type AdvisorModelSelection = {
  /**
   * Selected scoped model.
   */
  readonly selected: ScopedAdvisorModel;
  /**
   * Requested slug, when user supplied one.
   */
  readonly requestedSlug?: string;
  /**
   * Default-selection metadata, present for empty params.
   */
  readonly defaultSelection?: DefaultModelSelection;
};

//endregion Selection

//region Context

/**
 * Serialized conversation context plus metadata.
 */
export type AdvisorContext = {
  /**
   * Serialized conversation after deterministic truncation.
   */
  readonly text: string;
  /**
   * Effective serialized-context character budget used for truncation.
   */
  readonly maxContextChars: number;
  /**
   * Serialized conversation length before truncation.
   */
  readonly originalChars: number;
  /**
   * Serialized conversation length after truncation.
   */
  readonly finalChars: number;
  /**
   * Whether middle content was omitted.
   */
  readonly truncated: boolean;
  /**
   * Number of session messages included before LLM conversion.
   */
  readonly includedMessageCount: number;
  /**
   * Estimated tokens for the advisor request.
   */
  readonly estimatedInputTokens: number;
  /**
   * Latest user prompt excerpt, when one exists.
   */
  readonly latestUserPromptExcerpt?: string;
};

//endregion Context

//region Tool and command results

/**
 * Tool parameters exposed to the primary model.
 */
export type AdvisorToolParams = {
  /**
   * Optional scoped model slug. Empty params select default non-current scoped model when possible.
   */
  readonly model?: string;
  /**
   * Optional focused question for Advisor to answer using conversation context.
   */
  readonly question?: string;
};

/**
 * Structured details stored with Advisor tool and command results.
 */
export type AdvisorDetails = {
  /**
   * User-requested slug, if supplied.
   */
  readonly requestedSlug?: string;
  /**
   * Canonical selected model slug.
   */
  readonly selectedSlug: string;
  /**
   * Selected model provider.
   */
  readonly provider: string;
  /**
   * Source of scoped model set.
   */
  readonly scopeSource: ScopeSource;
  /**
   * Canonical slugs allowed for this call.
   */
  readonly scopedSlugs: readonly string[];
  /**
   * Default-selection reason, when empty params selected the model.
   */
  readonly defaultSelectionReason?: string;
  /**
   * Duration in milliseconds for provider call and local preparation.
   */
  readonly durationMs: number;
  /**
   * Effective serialized-context character budget for selected model.
   */
  readonly contextBudgetChars: number;
  /**
   * Final serialized context character count.
   */
  readonly contextChars: number;
  /**
   * Estimated input tokens for the advisor request.
   */
  readonly estimatedInputTokens: number;
  /**
   * Whether serialized context was truncated.
   */
  readonly truncated: boolean;
  /**
   * Advisor model stop reason.
   */
  readonly stopReason: StopReason;
  /**
   * Usage metadata returned by the provider, when present.
   */
  readonly usage?: ReadonlyDeep<Usage>;
  /**
   * Default ranking scores, best first, for status and diagnostics.
   */
  readonly costRanking?: readonly ModelCostScore[];
};

/**
 * Advisor text plus details.
 */
export type AdvisorRunResult = {
  /**
   * Advisor text response.
   */
  readonly text: string;
  /**
   * Tool-compatible details object.
   */
  readonly details: AdvisorDetails;
};

/**
 * Arguments for executing Advisor.
 */
export type AdvisorRunOptions = ForeignBorrowed<{
  /**
   * Pi extension context.
   */
  readonly ctx: ForeignHostCapability<ExtensionContext>;
  /**
   * Runtime config.
   */
  readonly config: AdvisorConfig;
  /**
   * Optional user-requested model slug.
   */
  readonly requestedSlug?: string;
  /**
   * Optional focused question for Advisor to answer using conversation context.
   */
  readonly question?: string;
  /**
   * Current advisor tool call id, used to omit placeholder context.
   */
  readonly toolCallId?: string;
  /**
   * Abort signal from tool or command execution.
   */
  readonly signal?: ForeignHostCapability<AbortSignal>;
}>;

/**
 * Advisor tool definition type with concrete parameters and details.
 */
export type AdvisorToolDefinition<TParameters extends TSchema = TSchema,> =
  ToolDefinition<
    TParameters,
    AdvisorDetails
  >;

/**
 * Tool result shape returned by Advisor execution.
 */
export type AdvisorToolResult = AgentToolResult<AdvisorDetails>;

/**
 * Extracted static parameter type for typebox schemas.
 */
export type ToolParamsFor<TParameters extends TSchema,> = Static<TParameters>;

//endregion Tool and command results
