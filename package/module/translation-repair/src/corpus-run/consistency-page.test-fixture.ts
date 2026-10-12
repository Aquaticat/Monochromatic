/**
 A cat-themed page whose slices repeat source wording, for the page-level
 consistency pass: a refrain of four lines with one varying slot, rendered four
 ways, and a sentence repeated twice, rendered two ways. The shape follows the
 live case the pass was built for; every word here is invention.

 @module
 */

import {
  type ArtifactComparisonRow,
  type ArtifactDeliveryRow,
  type BudgetView,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type PreparedDocumentPair,
  prepareDocumentPair,
  type ProjectedLanes,
  type ProviderRecord,
  type RosterModelId,
  type RunClient,
} from '../../dist/final/node/index.mjs';

//region Consistency page fixture

/**
 The original page: four sections, a refrain clause closing each one and a
 sentence opening the first and standing inside the third.
 */
export const PAGE_SOURCE: string = [
  '## 一',
  '',
  '窗台上的阳光让小猫睡着了。所以这只猫一定是胖胖的小宝贝。',
  '',
  '## 二',
  '',
  '厨房里的鱼香让小猫醒过来了。所以这只猫一定是懒猫的小宝贝。',
  '',
  '## 三',
  '',
  '傍晚的时候，窗台上的阳光让小猫睡着了，小鱼干也笑了。所以这只猫一定是乖仔的小宝贝。',
  '',
  '## 四',
  '',
  '院子里的雨声让小猫跑回家了。所以这只猫一定是暖团的小宝贝。',
  '',
].join('\n',);

/**
 The English of each section as the archive holds it, one entry per section,
 the refrain and the sentence each worded differently from place to place.
 */
const ARCHIVE_SECTIONS: readonly string[] = [
  '## One\n\nThe sunny window put the kitten to sleep. So this cat must be a chubby little treasure.\n',
  '## Two\n\nThe smell of fish in the kitchen woke the kitten. So this cat is surely a lazy little treasure.\n',
  '## Three\n\nIn the evening, the sunlight on the sill lulled the kitten to sleep, and the fish snacks smiled too. '
  + 'So this cat has to be a sweet little darling.\n',
  '## Four\n\nThe rain in the yard sent the kitten running home. So this cat is certainly a warm little dumpling.\n',
];

/**
 The archive page.
 */
const PAGE_ARCHIVE: string = ARCHIVE_SECTIONS.join('\n',);

/**
 Every provider wet: the view the seat reading takes.
 */
const ALL_WET: BudgetView = {
  synthetic: false,
  bedrock: false,
  hyper: false,
  openrouter: false,
};

/**
 The page prepared as the lanes see it.

 @returns Preparation of the original and the archive

 @example
 ```ts
 const prepared = preparedCatPage();
 ```
 */
export function preparedCatPage(): PreparedDocumentPair {
  return prepareDocumentPair({
    sourceText: PAGE_SOURCE,
    targetText: PAGE_ARCHIVE,
  },);
}

/**
 The English each slice carries when the archive stands everywhere.

 @param prepared - preparation of the page

 @returns The archive's text of each slice, in slice order

 @example
 ```ts
 const english = archiveEnglishOf({ prepared: preparedCatPage(), },);
 ```
 */
export function archiveEnglishOf(
  { prepared, }: { readonly prepared: PreparedDocumentPair; },
): readonly string[] {
  return prepared.slices
    .map(function textOf(slice,): string {
      return slice.target
        .text;
    },);
}

/**
 Both lanes' rows over the page, agreeing on the English the caller states for
 each slice, so that is the wording each slice would ship.

 @param prepared - preparation the rows describe

 @param english - what each slice ships, in slice order

 @returns Rows and the comparison

 @example
 ```ts
 const projected = projectedCatPage({ prepared, english: ARCHIVE_SECTIONS, },);
 ```
 */
export function projectedCatPage(
  {
    prepared,
    english,
  }: {
    readonly prepared: PreparedDocumentPair;
    readonly english: readonly string[];
  },
): ProjectedLanes {
  /**
   Comparison row of each slice.
   */
  const comparison = prepared.slices
    .map(function rowOf(
    slice,
    position,
  ): ArtifactComparisonRow {
    /**
     Wording the slice ships.
     */
    const shipped = english[position]
      ?? slice.target
      .text;
    /**
     Whether the archive stands.
     */
    const stands = shipped
      === slice.target
      .text;
    return {
      sliceIndex: slice.target
        .sliceIndex,
      incumbentKind: 'present',
      incumbentText: slice.target
        .text,
      repairText: shipped,
      translateText: shipped,
      laneRelation: stands ? 'archive-stands' : 'both-agree',
      repairOutcome: {
        kind: 'decided',
        acceptedText: shipped,
      },
      translateOutcome: {
        kind: 'decided',
        acceptedText: shipped,
      },
      decisionComparison: {
        kind: 'comparable',
        verdict: 'same',
      },
      repairDelivery: stands ? { kind: 'incumbent-retained', } : { kind: 'replacement-shipped', },
      translateDelivery: stands ? { kind: 'incumbent-retained', } : { kind: 'replacement-shipped', },
    };
  },);
  /**
   Delivery row each lane reports, the same for both.
   */
  const delivery = comparison.map(function deliveryOf(
    row,
    position,
  ): ArtifactDeliveryRow {
    return {
      sliceIndex: row.sliceIndex,
      sourceText: prepared.slices[position]
        ?.source
        .text
        ?? '',
      incumbentKind: 'present',
      incumbentText: row.incumbentText,
      outcome: row.repairOutcome,
      shippedText: row.repairText,
      delivery: row.repairDelivery,
    };
  },);
  return {
    delivery: {
      repair: delivery,
      translate: delivery,
    },
    comparison,
  };
}

/**
 What a scripted seat does when asked.

 @example
 ```ts
 const behaviour: SeatBehaviour = { kind: 'answers', text: '{}', };
 ```
 */
export type SeatBehaviour =
  | {
    /**
     The seat replies with this text.
     */
    readonly kind: 'answers';

    /**
     The reply, as a JSON string.
     */
    readonly text: string;
  }
  | {
    /**
     The seat's call throws.
     */
    readonly kind: 'throws';
  };

/**
 What a scripted client does for each call: the seat asked, how many calls the
 client has had before this one, and the sheet it was shown.

 @example
 ```ts
 const script: SeatScript = function throwsAlways() { return { kind: 'throws', }; };
 ```
 */
export type SeatScript = (
  call: {
    readonly seat: RosterModelId;
    readonly before: number;
    readonly sheet: string;
  },
) => SeatBehaviour;

/**
 The dryness view of a client whose every provider is wet.

 @returns Every provider wet

 @example
 ```ts
 const dry = await wetView();
 ```
 */
function wetView(): Promise<BudgetView> {
  return Promise.resolve(ALL_WET,);
}

/**
 Holds of a client none of whose providers is held.

 @returns Zero hold for every provider

 @example
 ```ts
 const holds = noHolds();
 ```
 */
function noHolds(): ProviderRecord<number> {
  return {
    synthetic: 0,
    bedrock: 0,
    hyper: 0,
    openrouter: 0,
  };
}

/**
 The refusal of a call the scripted client does not serve, as a rejection naming the call.

 @example
 ```ts
 await unservedCall().catch(report);
 ```
 */
function unservedCall(): Promise<never> {
  return Promise.reject(new Error('the scripted client serves only structured calls',),);
}

/**
 The user message of a request, as one text.

 @param request - request the client was handed

 @returns The text of its messages, joined

 @example
 ```ts
 const sheet = sheetOf({ request, },);
 ```
 */
function sheetOf<ValueT,>({ request, }: { readonly request: ChatJsonRequest<ValueT>; },): string {
  return request.messages
    .map(function textOf(message,): string {
      return (typeof message.content) === 'string' ? message.content : '';
    },)
    .join('\n',);
}

/**
 A run client whose every provider is wet and whose judges answer as scripted.

 @param behave - what the seat asked does, handed the seat, how many calls
 the client has had before this one and the sheet it was shown

 @param asked - sink for the seat of every structured call, in order

 @param sheets - sink for the messages of every structured call, in order

 @returns Client to drive the consistency pass with

 @example
 ```ts
 const client = scriptedJudgeClient({ behave: () => ({ kind: 'throws', }), asked: [], sheets: [], },);
 ```
 */
export function scriptedJudgeClient(
  {
    behave,
    asked,
    sheets,
  }: {
    readonly behave: SeatScript;
    readonly asked: RosterModelId[];
    readonly sheets: string[];
  },
): RunClient {
  return {
    providerDryness: wetView,
    providerHolds: noHolds,
    chatText: unservedCall,
    quotas: unservedCall,
    chatJson: function chatJson<ValueT,>(request: ChatJsonRequest<ValueT>,): Promise<ChatJsonOutcome<ValueT>> {
      /**
       Calls the client has had before this one.
       */
      const before = asked.length;
      asked.push(request.modelId,);
      /**
       The sheet this call was shown.
       */
      const sheet = sheetOf({ request, },);
      sheets.push(sheet,);
      /**
       What this seat does.
       */
      const behaviour = behave({
        seat: request.modelId,
        before,
        sheet,
      },);
      if (behaviour.kind === 'throws')
        return Promise.reject(new Error('the scripted seat throws',),);
      /**
       Reply as the sheet parses it.
       */
      const value: unknown = JSON.parse(behaviour.text,);
      return Promise.resolve(request.validate(value,)
        ? {
          kind: 'ok',
          value,
          rawText: behaviour.text,
        }
        : {
          kind: 'schema-mismatch',
          rawText: behaviour.text,
          detail: 'the fixture reply is not a usable ballot',
        },);
    },
  };
}

/**
 Quotes of the repeated sentence's two places that stand once in the archive's
 English: the first with its closing full stop, the second without one.
 */
export const SENTENCE_QUOTES: readonly Record<string, string>[] = [
  {
    label: 'OCCURRENCE 1',
    quote: 'The sunny window put the kitten to sleep.',
  },
  {
    label: 'OCCURRENCE 2',
    quote: 'the sunlight on the sill lulled the kitten to sleep',
  },
];

/**
 Quotes of the refrain's four places that stand once in the archive's English,
 each with its slot.
 */
export const REFRAIN_QUOTES: readonly Record<string, string>[] = [
  {
    label: 'OCCURRENCE 1',
    quote: 'So this cat must be a chubby little treasure.',
    slot: 'chubby',
  },
  {
    label: 'OCCURRENCE 2',
    quote: 'So this cat is surely a lazy little treasure.',
    slot: 'lazy',
  },
  {
    label: 'OCCURRENCE 3',
    quote: 'So this cat has to be a sweet little darling.',
    slot: 'sweet',
  },
  {
    label: 'OCCURRENCE 4',
    quote: 'So this cat is certainly a warm little dumpling.',
    slot: 'warm',
  },
];

/**
 One ballot as a judge sends it, reason first.

 @param quotes - the quotes the judge gives

 @param choice - label the judge says every place should follow

 @param keep - labels the judge keeps for their surroundings

 @returns The reply text

 @example
 ```ts
 const text = ballotText({ quotes: SENTENCE_QUOTES, choice: 'OCCURRENCE 1', keep: [], },);
 ```
 */
export function ballotText(
  {
    quotes,
    choice,
    keep,
  }: {
    readonly quotes: readonly Record<string, string>[];
    readonly choice: string;
    readonly keep: readonly string[];
  },
): string {
  return JSON.stringify({
    reason: 'The first rendering is the most faithful to the original, and the others differ in wording only.',
    quotes,
    choice,
    keep,
  },);
}

/**
 Whether a sheet asks about the refrain rather than the repeated sentence.

 @param sheet - the sheet a judge was shown

 @returns Whether it shows a frame

 @example
 ```ts
 const framed = isRefrainSheet({ sheet, },);
 ```
 */
export function isRefrainSheet({ sheet, }: { readonly sheet: string; },): boolean {
  return sheet.includes('FRAME BEGINS WITH',);
}

/**
 The ballot every seat sends: the first place of each group wins and none is kept.

 @param sheet - the sheet the seat was shown

 @returns Behaviour of a seat that answers it

 @example
 ```ts
 const behaviour = firstPlaceWins({ sheet, },);
 ```
 */
export function firstPlaceWins({ sheet, }: { readonly sheet: string; },): SeatBehaviour {
  return {
    kind: 'answers',
    text: ballotText({
      quotes: isRefrainSheet({ sheet, },) ? REFRAIN_QUOTES : SENTENCE_QUOTES,
      choice: 'OCCURRENCE 1',
      keep: [],
    },),
  };
}

/**
 Seats that answer the refrain's sheet one after another as the list says, in
 the order they are asked, and throw once it runs out; the repeated sentence's
 sheet is answered with the first place winning.

 @param answers - what the k-th seat asked about the refrain does

 @returns Behaviour to hand the scripted client

 @example
 ```ts
 const behave = refrainAnsweredInOrder({ answers: [firstPlaceWins({ sheet: '', },),], },);
 ```
 */
export function refrainAnsweredInOrder(
  { answers, }: { readonly answers: readonly SeatBehaviour[]; },
): SeatScript {
  /**
   Seats asked about the refrain so far.
   */
  const counter = { asked: 0, };
  return function behave({ sheet, },): SeatBehaviour {
    if (!isRefrainSheet({ sheet, },))
      return firstPlaceWins({ sheet, },);
    /**
     What the next seat to be asked does, absent once the list has run out.
     */
    const answer = answers[counter.asked];
    counter.asked += 1;
    return answer ?? { kind: 'throws', };
  };
}

/**
 The refrain's reply of a seat that chooses a place.

 @param choice - label the seat says every place should follow

 @returns Behaviour of a seat that answers with that choice and every quote

 @example
 ```ts
 const behaviour = refrainChoosing({ choice: 'OCCURRENCE 2', },);
 ```
 */
export function refrainChoosing({ choice, }: { readonly choice: string; },): SeatBehaviour {
  return {
    kind: 'answers',
    text: ballotText({
      quotes: REFRAIN_QUOTES,
      choice,
      keep: [],
    },),
  };
}

//endregion Consistency page fixture
