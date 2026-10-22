import type {
  AnthropicCard,
  AnthropicPrices,
  ModelCard,
} from './model-card.ts';
import type {
  AnthropicEffort,
  AnthropicServedId,
  AnthropicWireModel,
} from './roster-id.ts';

//region Claude card sides
// THE EIGHT CARDS OF THE OWNER'S CLAUDE KEY, 2026-10-22, kept beside `model-cards.ts` for the reason
// `direct-card-sides.ts` gives: that table sits at the package's line budget.
//
// THE OWNER'S GRANT: "I've added TRANSLATION_REPAIR_CLAUDE_API_KEY . You may use latest Haiku and latest Sonnet with
// this key. This key would have $200 every month so be careful what you use." The key is not model-scoped (the
// parent session read it listing Opus, Fable and older models), so the lock is in our code three ways: the wire
// model of every card is one of two literals (`roster-id.ts`), `claude-cards.unit.test.ts` fails on a third, and the
// client throws for any roster model that is not one of these eight before a request leaves (`claude-client.ts`).
//
// ONE CARD PER MODEL AND EFFORT. The owner declined to choose an effort ("Why don't you bench?"), and the bench seats
// a roster identity, so each level is a card of its own: `<model>-effort-low`, `-effort-medium` and `-effort-high`,
// each sending that level as `output_config.effort`. The card named by the model alone sends no effort, which is the
// model's own default (Sonnet `high`, Haiku `medium`), the neutral reading of no choice. THE SIX EFFORT CARDS ARE
// FOR THE BENCH. They carry `judge-unmeasured`, so no derived bench seats them, and a run seats one only after the
// bench names its level and the owner's seat table lists it. They share a wire model with the card of the same model,
// so a bench arm must never seat two cards of one model together: one model in two seats would overstate agreement
// (`roster-id.ts`, `synthetic-catalog.ts`).
//
// WHICH CARD HOLDS WHICH SEAT, from the owner's "Sonnet edits, Haiku wide":
//
//   - `claude-sonnet-5-5` (no effort) is the third editor. It holds `judge-unmeasured`, which keeps it off every
//     derived bench (the wide seats, the late judges, the checkers, the translators), and the run's editor list
//     names it directly. `writer-unmeasured` and `reader-unmeasured` say what is true: nothing has measured its
//     writing for the translate lane or a transcription from a picture.
//   - `claude-haiku-5-5` (no effort) is a wide seat (critics, adjudication panel, select judges) and takes a place on
//     the checker order. `late-judge-dropped` keeps it off the roster-wide rounds after the lanes (lane contest,
//     consolidation), which the owner did not name; `writer-unmeasured` and `reader-unmeasured` for the reason given for
//     Sonnet.
//
// THE PRICES ARE THE ANTHROPIC PRICING PAGE (`https://platform.claude.com/docs/en/about-claude/pricing`, fetched
// 2026-10-22). Its footnote 2 prices Sonnet 5.5 cache hits at 0.05 times base input, 0.10 USD a million. The bundled
// API skill's migration guide of the same day still says 0.20 for Sonnet 5.5 cache reads; the live page wins.
//
// NO ZERO DATA RETENTION is promised by this route. The owner's ruling of 2026-10-05 (the corpus is public, PII is
// allowed) and the owner's grant quoted in this note are what permit it.

/**
 Sonnet 5.5's prices: 2 USD in, 10 out, 2.50 for a five-minute cache write and 0.10 for a cache hit, per million
 tokens, at every prompt size.

 @example
 ```ts
 const prices = SONNET_5_5_PRICES;
 ```
 */
export const SONNET_5_5_PRICES: AnthropicPrices = {
  inputUsdPerMillion: 2,
  outputUsdPerMillion: 10,
  cacheWriteUsdPerMillion: 2.5,
  cacheHitUsdPerMillion: 0.1,
};

/**
 Haiku 5.5's prices: up to 100,000 prompt tokens 0.10 in, 0.50 out, 0.125 cache write and 0.01 cache hit; past them
 0.50, 2.50, 0.625 and 0.05, per million tokens, the longer tier pricing the whole call.

 @example
 ```ts
 const prices = HAIKU_5_5_PRICES;
 ```
 */
export const HAIKU_5_5_PRICES: AnthropicPrices = {
  inputUsdPerMillion: 0.1,
  outputUsdPerMillion: 0.5,
  cacheWriteUsdPerMillion: 0.125,
  cacheHitUsdPerMillion: 0.01,
  longPrompt: {
    aboveTokens: 100_000,
    inputUsdPerMillion: 0.5,
    outputUsdPerMillion: 2.5,
    cacheWriteUsdPerMillion: 0.625,
    cacheHitUsdPerMillion: 0.05,
  },
};

/**
 Output ceiling both models list: 128,000 tokens (the bundled API skill's model table, 2026-10-22), thinking counted.
 */
const MAX_OUTPUT_TOKENS = 128_000;

/**
 Builds one card side.

 @param id - roster spelling of the card

 @param wireModel - model id the request carries

 @param prices - the model's prices

 @param effort - effort the card sends, absent for the model's own default

 @returns The side

 @example
 ```ts
 const side = sideOf({ id: 'claude-haiku-5-5', wireModel: 'claude-haiku-5-5', prices: HAIKU_5_5_PRICES, },);
 ```
 */
function sideOf(
  {
    id,
    wireModel,
    prices,
    effort,
  }: {
    readonly id: AnthropicServedId;
    readonly wireModel: AnthropicWireModel;
    readonly prices: AnthropicPrices;
    readonly effort?: AnthropicEffort;
  },
): AnthropicCard {
  return {
    id,
    wireModel,
    // Conditional spread keeps the member absent instead of undefined.
    ...((effort === undefined) ? {} : { effort, }),
    readsImages: true,
    maxOutputLength: MAX_OUTPUT_TOKENS,
    prices,
  };
}

/**
 Holds of every card that sits on no derived bench: the six effort cards and Sonnet's.
 */
const NO_DERIVED_BENCH = [
  'judge-unmeasured',
  'writer-unmeasured',
  'reader-unmeasured',
] as const;

/**
 The eight cards of the Claude key, keyed by roster id.

 @example
 ```ts
 const card = CLAUDE_CARDS['claude-sonnet-5-5'];
 ```
 */
export const CLAUDE_CARDS: Readonly<Record<AnthropicServedId, ModelCard>> = {
  'claude-sonnet-5-5': {
    anthropic: sideOf({
      id: 'claude-sonnet-5-5',
      wireModel: 'claude-sonnet-5-5',
      prices: SONNET_5_5_PRICES,
    },),
    completionCap: 'pooled-p99',
    holds: [...NO_DERIVED_BENCH,],
  },
  'claude-sonnet-5-5-effort-low': {
    anthropic: sideOf({
      id: 'claude-sonnet-5-5-effort-low',
      wireModel: 'claude-sonnet-5-5',
      prices: SONNET_5_5_PRICES,
      effort: 'low',
    },),
    completionCap: 'pooled-p99',
    holds: [...NO_DERIVED_BENCH,],
  },
  'claude-sonnet-5-5-effort-medium': {
    anthropic: sideOf({
      id: 'claude-sonnet-5-5-effort-medium',
      wireModel: 'claude-sonnet-5-5',
      prices: SONNET_5_5_PRICES,
      effort: 'medium',
    },),
    completionCap: 'pooled-p99',
    holds: [...NO_DERIVED_BENCH,],
  },
  'claude-sonnet-5-5-effort-high': {
    anthropic: sideOf({
      id: 'claude-sonnet-5-5-effort-high',
      wireModel: 'claude-sonnet-5-5',
      prices: SONNET_5_5_PRICES,
      effort: 'high',
    },),
    completionCap: 'pooled-p99',
    holds: [...NO_DERIVED_BENCH,],
  },
  'claude-haiku-5-5': {
    anthropic: sideOf({
      id: 'claude-haiku-5-5',
      wireModel: 'claude-haiku-5-5',
      prices: HAIKU_5_5_PRICES,
    },),
    completionCap: 'pooled-p99',
    holds: [
      'writer-unmeasured',
      'reader-unmeasured',
      'late-judge-dropped',
    ],
  },
  'claude-haiku-5-5-effort-low': {
    anthropic: sideOf({
      id: 'claude-haiku-5-5-effort-low',
      wireModel: 'claude-haiku-5-5',
      prices: HAIKU_5_5_PRICES,
      effort: 'low',
    },),
    completionCap: 'pooled-p99',
    holds: [...NO_DERIVED_BENCH,],
  },
  'claude-haiku-5-5-effort-medium': {
    anthropic: sideOf({
      id: 'claude-haiku-5-5-effort-medium',
      wireModel: 'claude-haiku-5-5',
      prices: HAIKU_5_5_PRICES,
      effort: 'medium',
    },),
    completionCap: 'pooled-p99',
    holds: [...NO_DERIVED_BENCH,],
  },
  'claude-haiku-5-5-effort-high': {
    anthropic: sideOf({
      id: 'claude-haiku-5-5-effort-high',
      wireModel: 'claude-haiku-5-5',
      prices: HAIKU_5_5_PRICES,
      effort: 'high',
    },),
    completionCap: 'pooled-p99',
    holds: [...NO_DERIVED_BENCH,],
  },
};

//endregion Claude card sides
