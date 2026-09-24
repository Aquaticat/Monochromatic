import type {
  BedrockServedId,
  HyperServedId,
  OpenRouterDecisionId,
  OpenRouterServedId,
  SyntheticServedId,
} from './roster-id.ts';

//region Model card
// ONE RECORD PER ROSTER MODEL, from which every provider catalog, the
// completion cap table, the abandoned-spend ratio table and every seat hold
// derive. The owner asked for this on 2026-09-16 ("Adding / removing /
// changing models should never be this difficult"): before it, seating one
// model meant writing it into eight files, and unseating one meant finding
// them all again. Now a model is added by writing one card and removed by
// deleting it and adding a blocklist line (`roster-blocklist.ts`).
//
// THE CARD CARRIES FACTS AND HOLDS, NOT SEAT DECISIONS. Which model holds
// the third editor seat is a measurement recorded in `run-config.ts`; a card
// says where a model is served, what each provider reports for it, what its
// replies measured, and which roles it is held out of. This file holds the
// types alone so `model-cards.ts` reads as data.

/**
 Vendor family of a Synthetic-served model, for cross-family fan-out.

 @example
 ```ts
 const family: SyntheticVendorFamily = 'moonshot';
 ```
 */
export type SyntheticVendorFamily =
  | 'zai'
  | 'qwen'
  | 'moonshot'
  | 'openai';

/**
 Route a Bedrock model answers on, measured per model.

 @example
 ```ts
 const route: BedrockRoute = 'openai-v1';
 ```
 */
export type BedrockRoute = 'openai-v1' | 'v1';

/**
 How a Bedrock stream announces that it is whole, measured per model.

 @example
 ```ts
 const end: BedrockStreamEnd = 'done-sentinel';
 ```
 */
export type BedrockStreamEnd = 'done-sentinel' | 'usage-chunk';

/**
 Role a card is held out of, each on evidence recorded where the hold is read
 (`run-config.ts`, `run-seats.ts`, `openrouter-catalog.ts`).

 @example
 ```ts
 const hold: SeatHold = 'writer-unmeasured';
 ```
 */
export type SeatHold =
  /**
   No judge fidelity probe has seated it, so it holds no seat at all.
   */
  | 'judge-unmeasured'
  /**
   No producer calibration has measured its writing: no translator or
   consolidation seat.
   */
  | 'writer-unmeasured'
  /**
   No transcription has been measured: no picture-reader seat although a
   provider reports image input.
   */
  | 'reader-unmeasured'
  /**
   A producer calibration measured it out of the translator seat.
   */
  | 'translator-dropped'
  /**
   Out of every nine-wide seat (critic, panel, judge) for wall clock or by
   the owner's decision.
   */
  | 'wide-seat-dropped'
  /**
   Out of the roster-wide rounds after the lanes (contest, slate, gate).
   */
  | 'late-judge-dropped'
  /**
   OpenRouter serves it and the run does not buy it there, on cost.
   */
  | 'openrouter-withheld'
  /**
   OpenRouter stopped serving it for this run on 2026-09-09; named so the
   seat accounting can say so rather than infer it from an absent row.
   */
  | 'openrouter-dropped'
  /**
   Synthetic serves it and the run does not route it there: measured slower
   there than on another provider serving the same model.
   */
  | 'synthetic-withheld'
  /**
   Too slow in the select seats alone while Hyper serves it.
   */
  | 'hyper-slow-select'
  /**
   Out of every seat by the owner's decision, the card kept for the catalogs
   and the unit fixture: the seats go, the identity stays typed.
   */
  | 'owner-culled';

/**
 Completion cap for a model whose own calls were never measured: the pooled
 percentile the cap table falls back to.

 @example
 ```ts
 const cap: CompletionCapPool = 'pooled-p99';
 ```
 */
export type CompletionCapPool = 'pooled-p90' | 'pooled-p99';

/**
 What every provider reports for a model it serves.

 @example
 ```ts
 const served: ServedCard<HyperServedId> = { id: 'minimax-m3', readsImages: true, maxOutputLength: 512_000, };
 ```
 */
export type ServedCard<Id extends string> = {
  /**
   Identifier sent in the request body's `model` field.
   */
  readonly id: Id;

  /**
   Whether the provider reports image input for this model.
   */
  readonly readsImages: boolean;

  /**
   Ceiling the provider reports for completion tokens.
   */
  readonly maxOutputLength: number;
};

/**
 Synthetic's side of a card.

 @example
 ```ts
 const card: SyntheticCard = { id: 'hf:openai/gpt-oss-120b', family: 'openai', readsImages: false, contextLength: 131_072, maxOutputLength: 65_536, promptDollarsPerToken: 1e-7, completionDollarsPerToken: 1e-7, };
 ```
 */
export type SyntheticCard = ServedCard<SyntheticServedId> & {
  /**
   Vendor family for cross-family fan-out and rerouting.
   */
  readonly family: SyntheticVendorFamily;

  /**
   Context window in tokens.
   */
  readonly contextLength: number;

  /**
   Input price in dollars per token; request weighting derives from ratios
   of this field.
   */
  readonly promptDollarsPerToken: number;

  /**
   Output price in dollars per token; feeds weekly-credit spend estimates.
   */
  readonly completionDollarsPerToken: number;
};

/**
 OpenRouter's side of a card.

 @example
 ```ts
 const card: OpenRouterCard = { id: 'minimax/minimax-m3', readsImages: true, maxOutputLength: 512_000, promptUsdPerMillion: 0.3, completionUsdPerMillion: 1.2, ignoredEndpoints: ['parasail',], preferredEndpoints: [], rawCharsPerToken: 137, };
 ```
 */
export type OpenRouterCard = ServedCard<OpenRouterServedId> & {
  /**
   USD per million prompt tokens as the public listing priced it; the
   estimate for an abandoned stream is priced off it.
   */
  readonly promptUsdPerMillion: number;

  /**
   USD per million completion tokens, from the same listing.
   */
  readonly completionUsdPerMillion: number;

  /**
   Endpoint slugs measured as serving this model badly, sent as
   `provider.ignore`; slugs as `GET /api/v1/providers` lists them.
   */
  readonly ignoredEndpoints: readonly string[];

  /**
   Endpoint slugs measured as serving this model well, sent as
   `provider.order` ahead of the price sort with fallbacks allowed, for a
   seat whose cheapest endpoints reason at length by default (class
   ninety-three); empty where the price sort alone decides. Slugs as
   `GET /api/v1/providers` lists them.
   */
  readonly preferredEndpoints: readonly string[];

  /**
   Raw stream characters per completion token, the median over completed
   streams, or `'unmeasured'` for the median of the measured models.
   */
  readonly rawCharsPerToken: number | 'unmeasured';
};

/**
 Bedrock's side of a card.

 @example
 ```ts
 const card: BedrockCard = { id: 'google.gemma-4-e2b', readsImages: false, contextLength: 131_072, maxOutputLength: 131_072, route: 'openai-v1', streamEnd: 'done-sentinel', promptUsdPerMillion: 0.04, completionUsdPerMillion: 0.08, };
 ```
 */
export type BedrockCard = ServedCard<BedrockServedId> & {
  /**
   Context window in tokens, as the model card states it.
   */
  readonly contextLength: number;

  /**
   Route this model answers on.
   */
  readonly route: BedrockRoute;

  /**
   How this model's stream announces that it is whole.
   */
  readonly streamEnd: BedrockStreamEnd;

  /**
   USD per million prompt tokens, off the public pricing page.
   */
  readonly promptUsdPerMillion: number;

  /**
   USD per million completion tokens, off the public pricing page.
   */
  readonly completionUsdPerMillion: number;
};

/**
 The decisions endpoint's side of a card: a typed-decision model reached
 through OpenRouter's `/api/alpha/decisions`, which answers a choice, a
 yes-probability or a score and never a completion. A card carrying this
 side and no chat side is a decision-only seat: no chat catalog lists it,
 no chat bench seats it, and only the stages with a decision adapter ask it.

 @example
 ```ts
 const card: DecisionsCard = { id: 'typesafe/jev-1.13', contextLength: 32_000, promptUsdPerMillion: 0.042, completionUsdPerMillion: 0, };
 ```
 */
export type DecisionsCard = {
  /**
   Identifier sent in the request body's `model` field.
   */
  readonly id: OpenRouterDecisionId;

  /**
   Tokens of state plus the longest question one request may carry, as the
   vendor's models page states it.
   */
  readonly contextLength: number;

  /**
   USD per million input tokens as the listing priced it.
   */
  readonly promptUsdPerMillion: number;

  /**
   USD per million output tokens, zero where the listing charges none.
   */
  readonly completionUsdPerMillion: number;
};

/**
 One roster model: every provider's view of it, its measured completion
 cap and the roles it is held out of. Its identity is the key it sits under
 in `MODEL_CARDS`.

 @example
 ```ts
 const card: ModelCard = MODEL_CARDS['minimax-m3'];
 ```
 */
export type ModelCard = {
  /**
   Synthetic's entry, where it serves the model.
   */
  readonly synthetic?: SyntheticCard;

  /**
   Charm Hyper's entry, where it serves the model.
   */
  readonly hyper?: ServedCard<HyperServedId>;

  /**
   OpenRouter's entry, where it serves the model.
   */
  readonly openrouter?: OpenRouterCard;

  /**
   Amazon Bedrock's entry, where it serves the model.
   */
  readonly bedrock?: BedrockCard;

  /**
   OpenRouter's decisions endpoint's entry, where it serves the model as a
   typed-decision model rather than a chat one.
   */
  readonly decisions?: DecisionsCard;

  /**
   Completion token ceiling every client sends as `max_tokens`: the highest
   99th percentile any provider measured, or a pooled percentile until the
   model's own calls are read (`completion-cap.ts` has the method).
   */
  readonly completionCap: number | CompletionCapPool;

  /**
   Roles held out of, on the evidence recorded where each hold is read.
   */
  readonly holds: readonly SeatHold[];
};

//endregion Model card
