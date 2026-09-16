//region Roster barrel
// The model cards and everything derived from them, beside the roster's
// identity lists. Split from the provider barrel on 2026-09-16 for its line
// budget.

export {
  type BedrockOnlyRosterId,
  BEDROCK_SERVED_IDS,
  type HyperOriginRosterId,
  HYPER_SERVED_IDS,
  type OpenRouterOnlyRosterId,
  OPENROUTER_SERVED_IDS,
  SYNTHETIC_SERVED_IDS,
  type SyntheticServedId,
} from './roster-id.ts';
export type {
  BedrockCard,
  BedrockRoute,
  BedrockStreamEnd,
  CompletionCapPool,
  ModelCard,
  OpenRouterCard,
  SeatHold,
  ServedCard,
  SyntheticCard,
  SyntheticVendorFamily,
} from './model-card.ts';
export { MODEL_CARDS, } from './model-cards.ts';
export {
  BEDROCK_ONLY_ROSTER_IDS,
  cardOf,
  type CardProvider,
  cardsServing,
  holdSet,
  HYPER_ORIGIN_ROSTER_IDS,
  keyedBy,
  OPENROUTER_ONLY_ROSTER_IDS,
  recordOver,
  ROSTER_CARDS,
  type RosterCard,
  type ServedIdOf,
  servedRecord,
  type ServingCard,
} from './model-card-derive.ts';
export {
  cardFieldsFrom,
  type CardFields,
  fieldAt,
  type Listed,
  listingRowFor,
  NOT_LISTED,
  renderProviderCard,
} from './corpus-run/roster-card-render.ts';
export { readAsk, } from './corpus-run/roster-card-ask.ts';
export {
  SEAT_BEDROCK_ONLY_TEXT,
  SEAT_BEDROCK_ONLY_VISION_UNSEATED,
  SEAT_HYPER_ONLY,
  SEAT_HYPER_OPENROUTER_UNMEASURED,
  SEAT_HYPER_TEXT_BEDROCK,
  SEAT_HYPER_VISION,
  SEAT_OPENROUTER_ONLY,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  SEAT_SYNTHETIC_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
} from './roster-fixture.ts';

//endregion Roster barrel
