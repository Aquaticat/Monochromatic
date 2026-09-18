import type {
  BedrockCard,
  DecisionsCard,
  ModelCard,
  OpenRouterCard,
  SeatHold,
  ServedCard,
  SyntheticCard,
} from './model-card.ts';
import { MODEL_CARDS, } from './model-cards.ts';
import {
  type BedrockOnlyRosterId,
  BEDROCK_SERVED_IDS,
  type HyperOriginRosterId,
  HYPER_SERVED_IDS,
  type HyperServedId,
  type OpenRouterOnlyRosterId,
  OPENROUTER_SERVED_IDS,
  ROSTER_MODEL_IDS,
  type RosterModelId,
  SYNTHETIC_SERVED_IDS,
} from './roster-id.ts';

//region Model card derivation
// THE ONE PLACE THE CARDS ARE READ AS DATA. Every catalog, cap table and
// hold set is a projection of `MODEL_CARDS` through these helpers, so a
// card added or removed is seen everywhere at once and nowhere by hand.

/**
 Provider whose side of a card is being asked for.

 @example
 ```ts
 const provider: CardProvider = 'hyper';
 ```
 */
export type CardProvider = 'synthetic' | 'hyper' | 'openrouter' | 'bedrock';

/**
 A card beside the roster id it sits under.

 @example
 ```ts
 const card: RosterCard = cardOf({ modelId: 'minimax-m3', },);
 ```
 */
export type RosterCard = ModelCard & {
  /**
   Roster identity, one per model however many providers reach it.
   */
  readonly id: RosterModelId;
};

/**
 A roster card that carries one provider's side.

 @example
 ```ts
 const card: ServingCard<'hyper'> = cardsServing({ provider: 'hyper', },)[0];
 ```
 */
export type ServingCard<Provider extends CardProvider> = RosterCard & Required<Pick<ModelCard, Provider>>;

/**
 Spelling one provider serves a card's model under.

 @example
 ```ts
 const servedId: ServedIdOf<'hyper'> = 'minimax-m3';
 ```
 */
export type ServedIdOf<Provider extends CardProvider> = NonNullable<ModelCard[Provider]>['id'];

/**
 Every provider's served spellings, keyed by provider, for the key check
 on a derived record.
 */
type ServedIdLists = {
  readonly [Provider in CardProvider]: readonly ServedIdOf<Provider>[];
};

/**
 Reader of one provider's side off a card that carries it, keyed by
 provider, so a generic provider can reach its side without indexing a
 generic key.
 */
type SideReaders = {
  readonly [Provider in CardProvider]: (card: ServingCard<Provider>,) => NonNullable<ModelCard[Provider]>;
};

/**
 Each provider's side reader.
 */
const SIDE_OF: SideReaders = {
  synthetic: function syntheticSide(card,): SyntheticCard {
    return card.synthetic;
  },
  hyper: function hyperSide(card,): ServedCard<HyperServedId> {
    return card.hyper;
  },
  openrouter: function openRouterSide(card,): OpenRouterCard {
    return card.openrouter;
  },
  bedrock: function bedrockSide(card,): BedrockCard {
    return card.bedrock;
  },
};

/**
 Every provider's served spellings, as the roster lists them.
 */
const SERVED_IDS: ServedIdLists = {
  synthetic: SYNTHETIC_SERVED_IDS,
  hyper: HYPER_SERVED_IDS,
  openrouter: OPENROUTER_SERVED_IDS,
  bedrock: BEDROCK_SERVED_IDS,
};

/**
 Every card beside its id, in roster order.

 @example
 ```ts
 const cards = ROSTER_CARDS;
 ```
 */
export const ROSTER_CARDS: readonly RosterCard[] = ROSTER_MODEL_IDS
  .map(function withId(id,): RosterCard {
    return {
      id,
      ...MODEL_CARDS[id],
    };
  },);

/**
 Cards carrying one provider's side, in roster order.

 @param provider - whose side is wanted

 @returns Cards that provider serves, typed to carry that side

 @example
 ```ts
 const served = cardsServing({ provider: 'openrouter', },);
 ```
 */
export function cardsServing<Provider extends CardProvider>(
  { provider, }: { readonly provider: Provider; },
): readonly ServingCard<Provider>[] {
  return ROSTER_CARDS.filter(function serves(card,): card is ServingCard<Provider> {
    return card[provider] !== undefined;
  },);
}

/**
 Card of one roster model.

 @param modelId - roster model to look up

 @returns Its card beside its id

 @example
 ```ts
 const card = cardOf({ modelId: 'minimax-m3', },);
 ```
 */
export function cardOf(
  { modelId, }: { readonly modelId: RosterModelId; },
): RosterCard {
  return {
    id: modelId,
    ...MODEL_CARDS[modelId],
  };
}

/**
 Roster models held out of one role.

 @param hold - role hold to collect

 @returns Ids carrying that hold, in roster order

 @example
 ```ts
 const unmeasured = holdSet({ hold: 'writer-unmeasured', },);
 ```
 */
export function holdSet(
  { hold, }: { readonly hold: SeatHold; },
): ReadonlySet<RosterModelId> {
  return new Set(ROSTER_CARDS
    .filter(function held(card,): boolean {
      /**
       Roles this card is held out of.
       */
      const { holds, } = card;
      return holds.includes(hold,);
    },)
    .map(function toId(card,): RosterModelId {
      return card.id;
    },),);
}

/**
 Roster models only the decisions endpoint serves, in roster order: cards
 carrying a decisions side, which by construction carry no chat side.

 @example
 ```ts
 const seats = DECISION_ONLY_ROSTER_IDS;
 ```
 */
export const DECISION_ONLY_ROSTER_IDS: readonly RosterModelId[] = ROSTER_CARDS
  .filter(function decides(card,): boolean {
    return card.decisions !== undefined;
  },)
  .map(function toId(card,): RosterModelId {
    return card.id;
  },);

/**
 Whether one roster model is a decision-only seat, which no chat client can
 take and only a stage with a decision adapter asks.

 @param modelId - roster model to look up

 @returns Whether its card carries a decisions side

 @example
 ```ts
 const decides = isDecisionSeat({ modelId: 'typesafe/jev-1.13', },);
 ```
 */
export function isDecisionSeat(
  { modelId, }: { readonly modelId: RosterModelId; },
): boolean {
  /**
   Side as the card carries it, or nothing.
   */
  const side = MODEL_CARDS[modelId]
    .decisions;
  return side !== undefined;
}

/**
 Raised when a decisions side is read off a card that carries none.

 @example
 ```ts
 throw new DecisionsCardMissingError({ modelId: 'minimax-m3', },);
 ```
 */
export class DecisionsCardMissingError extends Error {
  /**
   Declares this message safe to forward: it names a roster model and nothing else.
   */
  readonly messageNamesOnly: true = true;

  /**
   Builds the refusal naming the model.

   @param modelId - roster model whose card carries no decisions side

   @example
   ```ts
   new DecisionsCardMissingError({ modelId: 'minimax-m3', },);
   ```
   */
  public constructor({ modelId, }: { readonly modelId: RosterModelId; },) {
    super(`${modelId} is not a decision seat: its card carries no decisions side`,);
    this.name = 'DecisionsCardMissingError';
  }
}

/**
 The decisions side of one roster model's card.

 @param modelId - roster model to look up

 @returns Its decisions side

 @throws {@link DecisionsCardMissingError} when the card carries none

 @example
 ```ts
 const side = decisionsCardOf({ modelId: 'typesafe/jev-1.13', },);
 ```
 */
export function decisionsCardOf(
  { modelId, }: { readonly modelId: RosterModelId; },
): DecisionsCard {
  /**
   Side as the card carries it, or nothing.
   */
  const side = MODEL_CARDS[modelId]
    .decisions;
  if (side === undefined)
    throw new DecisionsCardMissingError({ modelId, },);
  return side;
}

/**
 Makes the check that a record built by `Object.fromEntries`, whose keys
 the type system widened to `string`, carries every key on a list and no
 other, which is what lets the record be read under the list's union.

 @param keys - keys the record must carry exactly

 @returns Predicate over a record with widened keys

 @example
 ```ts
 const isRosterKeyed = keyedBy({ keys: ROSTER_MODEL_IDS, },);
 ```
 */
export function keyedBy<Key extends string, Value>(
  { keys, }: { readonly keys: readonly Key[]; },
): (record: Readonly<Record<string, Value>>,) => record is Readonly<Record<Key, Value>> {
  return function isKeyed(record: Readonly<Record<string, Value>>,): record is Readonly<Record<Key, Value>> {
    /**
     Keys the record carries.
     */
    const carried = Object.keys(record,);
    return (carried.length === keys.length) && keys.every(function present(key,): boolean {
      return Object.hasOwn(
        record,
        key,
      );
    },);
  };
}

/**
 Record over exactly the given keys, each value read off a function.

 @param keys - every key, once

 @param of - value for one key

 @returns The record, read under the keys' union

 @throws When the keys repeat, which is the one way the built record can
 miss one

 @example
 ```ts
 const caps = recordOver({ keys: ROSTER_MODEL_IDS, of: function cap(): number { return 1; }, },);
 ```
 */
export function recordOver<Key extends string, Value>(
  {
    keys,
    of,
  }: {
    readonly keys: readonly Key[];
    readonly of: (key: Key,) => Value;
  },
): Readonly<Record<Key, Value>> {
  /**
   Record with its keys widened to `string`, as `Object.fromEntries` types it.
   */
  const built: Readonly<Record<string, Value>> = Object.fromEntries(keys.map(function entry(key,): readonly [
    Key,
    Value,
  ] {
    return [
      key,
      of(key,),
    ];
  },),);
  if (!keyedBy<Key, Value>({ keys, },)(built,))
    throw new RangeError(`keys repeat: ${keys.join(', ',)}`,);
  return built;
}

/**
 Record over one provider's served spellings, each row read off the card
 that carries the spelling.

 @param provider - whose spellings key the record

 @param toRow - row for one card

 @returns The record, read under that provider's served-id union

 @throws When a served spelling on the roster's list has no card, or a
 card's spelling is off the list

 @example
 ```ts
 const rows = servedRecord({ provider: 'hyper', toRow: function row(card,): number { return card.hyper.maxOutputLength; }, },);
 ```
 */
export function servedRecord<Provider extends CardProvider, Row>(
  {
    provider,
    toRow,
  }: {
    readonly provider: Provider;
    readonly toRow: (card: ServingCard<Provider>,) => Row;
  },
): Readonly<Record<ServedIdOf<Provider>, Row>> {
  /**
   Cards this provider serves.
   */
  const served = cardsServing({ provider, },);
  /**
   Record with its keys widened to `string`, as `Object.fromEntries` types it.
   */
  const built: Readonly<Record<string, Row>> = Object.fromEntries(served.map(function entry(card,): readonly [
    string,
    Row,
  ] {
    /**
     This provider's side of the card.
     */
    const side = SIDE_OF[provider](card,);
    return [
      side.id,
      toRow(card,),
    ];
  },),);
  /**
   Spellings the roster lists for this provider.
   */
  const keys: readonly ServedIdOf<Provider>[] = SERVED_IDS[provider];
  if (!keyedBy<ServedIdOf<Provider>, Row>({ keys, },)(built,)) {
    /**
     Spellings the cards carry, for the message.
     */
    const carried = Object.keys(built,);
    throw new RangeError(`${provider} cards and served ids disagree: cards ${carried.join(', ',)}; list ${keys.join(', ',)}`,);
  }
  return built;
}

/**
 Hyper's spellings as plain strings, for membership tests on roster ids.
 */
const HYPER_SPELLINGS: readonly string[] = HYPER_SERVED_IDS;

/**
 Bedrock's spellings as plain strings, for membership tests on roster ids.
 */
const BEDROCK_SPELLINGS: readonly string[] = BEDROCK_SERVED_IDS;

/**
 OpenRouter's spellings as plain strings, for membership tests on roster ids.
 */
const OPENROUTER_SPELLINGS: readonly string[] = OPENROUTER_SERVED_IDS;

/**
 Roster identities introduced through Charm Hyper without a Synthetic
 spelling: by the naming rule, the roster ids spelled Hyper's way, in
 roster order.

 @example
 ```ts
 const everyone = HYPER_ORIGIN_ROSTER_IDS;
 ```
 */
export const HYPER_ORIGIN_ROSTER_IDS: readonly HyperOriginRosterId[] = ROSTER_MODEL_IDS
  .filter(function hyperSpelled(modelId,): modelId is HyperOriginRosterId {
    return HYPER_SPELLINGS.includes(modelId,);
  },);

/**
 Roster models only Amazon Bedrock serves: by the naming rule, the roster
 ids spelled Bedrock's way, in roster order.

 @example
 ```ts
 const everyone = BEDROCK_ONLY_ROSTER_IDS;
 ```
 */
export const BEDROCK_ONLY_ROSTER_IDS: readonly BedrockOnlyRosterId[] = ROSTER_MODEL_IDS
  .filter(function bedrockSpelled(modelId,): modelId is BedrockOnlyRosterId {
    return BEDROCK_SPELLINGS.includes(modelId,);
  },);

/**
 Roster models only OpenRouter serves: by the naming rule, the roster ids
 spelled OpenRouter's way, in roster order.

 @example
 ```ts
 const everyone = OPENROUTER_ONLY_ROSTER_IDS;
 ```
 */
export const OPENROUTER_ONLY_ROSTER_IDS: readonly OpenRouterOnlyRosterId[] = ROSTER_MODEL_IDS
  .filter(function openRouterSpelled(modelId,): modelId is OpenRouterOnlyRosterId {
    return OPENROUTER_SPELLINGS.includes(modelId,);
  },);

//endregion Model card derivation
