import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { CarryBlock, } from '../consistency-carry.ts';
import { ConsistencyInvariantError, } from '../consistency-invariant-error.ts';
import type { ArtifactConsistencyRepeat, } from './artifact-two-lane-consistency.ts';
import { askCarryWriters, } from './pass-consistency-carry-ask.ts';
import {
  composeSlice,
  floorRefusalOf,
  writtenParagraphsOf,
} from './pass-consistency-carry-candidates.ts';
import {
  type ConsistencyPlace,
  occurrenceViewOf,
} from './pass-consistency-group.ts';
import type {
  CarryContext,
  CarryReceiver,
  LocatedPlace,
} from './pass-consistency-types.ts';
import { RUN_PER_CALL_TIMEOUT_MS, } from './run-config.ts';

//region Pass consistency carry offers
// THE TEXTS OFFERED FOR A RECEIVING PLACE'S PARAGRAPH, apart from the current
// one: the chosen words moved in by code, where that is possible and the floors
// pass it, and the paragraphs the translate stage's writer bench writes for it.

/**
 The English of a place's slice, which a located place has.

 @param place - the place

 @returns The slice's English

 @throws {@link ConsistencyInvariantError} when the slice carries none, since a rendering is located only in English

 @example
 ```ts
 const english = englishOf({ place, },);
 ```
 */
export function englishOf({ place, }: { readonly place: ConsistencyPlace; },): string {
  if (place.slice
    .current
    .kind
    === 'absent') {
    throw new ConsistencyInvariantError({ invariant:
      `slice ${String(place.slice
        .sliceIndex,)} carries no English, and a rendering is located only in English`, },);
  }
  return place.slice
    .current
    .text;
}

/**
 The original blocks before and after the one that holds a place, in its slice.

 @param place - the place

 @returns The blocks' texts, each absent where the slice has no such block

 @example
 ```ts
 const { before, after, } = neighboursOf({ place, },);
 ```
 */
function neighboursOf(
  { place, }: { readonly place: ConsistencyPlace; },
): {
  readonly before?: string;
  readonly after?: string;
} {
  /**
   The slice's body blocks in order.
   */
  const blocks = place.slice
    .nodes
    .filter(function isBody(node,): boolean {
      return node.zone === 'body';
    },);
  /**
   Position of the block that holds the place.
   */
  const at = blocks.findIndex(function holdsIt(node,): boolean {
    return (node.startOffset <= place.startOffset) && (place.endOffset <= node.endOffset);
  },);
  /**
   The block before it.
   */
  const before = (at > 0) ? blocks[at - 1] : undefined;
  /**
   The block after it.
   */
  const after = (at === (-1)) ? undefined : blocks[at + 1];
  return {
    ...((before === undefined) ? {} : { before: before.text, }),
    ...((after === undefined) ? {} : { after: after.text, }),
  };
}

/**
 The paragraph with the chosen words moved in by code, when that is possible
 and every floor passes it.

 @param receiver - the receiving place

 @param english - its slice's English

 @param block - the block that holds it

 @param context - what the carry reads

 @returns The paragraph as a list of zero or one, and a finding where a floor refused it

 @example
 ```ts
 const { spliced, findings, } = splicedParagraphOf({ receiver, english, block, context, },);
 ```
 */
export function splicedParagraphOf(
  {
    receiver,
    english,
    block,
    context,
  }: {
    readonly receiver: CarryReceiver;
    readonly english: string;
    readonly block: CarryBlock;
    readonly context: CarryContext;
  },
): {
  readonly spliced: readonly string[];
  readonly findings: readonly string[];
} {
  if (receiver.plan
    .kind
    !== 'replace') {
    return {
      spliced: [],
      findings: [],
    };
  }
  /**
   The paragraph with the chosen words in place of the receiving place's.
   */
  const paragraph = `${block.text
    .slice(
    0,
    receiver.plan
      .start
      - block.start,
  )}${receiver.plan
    .text}${block.text
      .slice(receiver.plan
        .end
        - block.start,)}`;
  /**
   What the floors find against the slice carrying it, none when they pass it.
   */
  const [refusal,] = floorRefusalOf({
    facts: receiver.place
      .slice,
    currentText: english,
    candidateText: composeSlice({
      english,
      block,
      paragraph,
    },),
    declared: context.declared,
    declaredNames: context.declaredNames,
  },);
  if (refusal === undefined) {
    return {
      spliced: [paragraph,],
      findings: [],
    };
  }
  tagged({
    tag: splicedParagraphOf.name,
    l: context.l,
  },)
    .warn(`withheld the splice for ${receiver.label} from the bench: the floors refuse its paragraph: ${refusal}`,);
  return {
    spliced: [],
    findings: [`consistency-candidate-refused (splice of ${receiver.label}): ${refusal}`,],
  };
}

/**
 Asks the writer bench for the receiving place's paragraph and keeps the
 paragraphs the floors pass.

 @param context - what the carry reads

 @param repeat - the repeated wording or frame

 @param chosen - the chosen place and its located rendering

 @param receiver - the receiving place

 @param english - the receiving place's slice English

 @param block - the block of it that holds the words

 @param chosenParagraph - the chosen place's English paragraph

 @returns The surviving paragraphs and what the asking and the floors reported

 @example
 ```ts
 const { written, findings, } = await writtenOffers({ context, repeat, chosen, receiver, english, block, chosenParagraph, },);
 ```
 */
export async function writtenOffers(
  {
    context,
    repeat,
    chosen,
    receiver,
    english,
    block,
    chosenParagraph,
  }: {
    readonly context: CarryContext;
    readonly repeat: ArtifactConsistencyRepeat;
    readonly chosen: LocatedPlace;
    readonly receiver: CarryReceiver;
    readonly english: string;
    readonly block: CarryBlock;
    readonly chosenParagraph: string;
  },
): Promise<{
  readonly written: readonly {
    readonly seat: string;
    readonly text: string;
  }[];
  readonly findings: readonly string[];
}> {
  if (context.writerModelIds
    .length
    === 0) {
    return {
      written: [],
      findings: [`consistency-writers-unseated (${receiver.label})`,],
    };
  }
  /**
   The writers' replies.
   */
  const asked = await askCarryWriters({
    client: context.client,
    modelIds: context.writerModelIds,
    subject: {
      repeat,
      chosen: {
        view: occurrenceViewOf({
          place: chosen.place,
          text: context.text,
        },),
        span: chosen.rendering
          .core,
        paragraph: chosenParagraph,
      },
      receiving: {
        view: occurrenceViewOf({
          place: receiver.place,
          text: context.text,
        },),
        span: receiver.rendering
          .core,
        paragraph: block.text,
      },
      ...neighboursOf({ place: receiver.place, },),
      lineStructured: receiver.place
        .slice
        .lineStructured,
      ...((context.identityContext === undefined) ? {} : { identityContext: context.identityContext, }),
      ...((context.referenceContext === undefined) ? {} : { referenceContext: context.referenceContext, }),
      ...((context.lifeEnded === undefined) ? {} : { lifeEnded: context.lifeEnded, }),
      ...((context.subjectNames === undefined) ? {} : { subjectNames: context.subjectNames, }),
    },
    cache: context.cache,
    signal: context.signal,
    exchangeTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l: context.l,
    stageSettings: context.stageSettings,
  },);
  /**
   The paragraphs that pass the floors, and a finding per reply withheld.
   */
  const kept = writtenParagraphsOf({
    voices: asked.voices,
    english,
    block,
    facts: receiver.place
      .slice,
    declared: context.declared,
    declaredNames: context.declaredNames,
    l: context.l,
  },);
  return {
    written: kept.written,
    findings: [
      ...asked.findings,
      ...kept.findings,
    ],
  };
}

//endregion Pass consistency carry offers
