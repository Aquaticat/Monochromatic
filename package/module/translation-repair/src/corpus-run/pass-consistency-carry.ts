import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  blockHolding,
  carryOffersOf,
} from '../consistency-carry.ts';
import {
  exchangeFailureLogText,
  exchangeFailureText,
} from '../exchange-failure-text.ts';
import type { ArtifactConsistencyRepeat, } from './artifact-two-lane-consistency.ts';
import {
  carryWithoutChoice,
  choose,
} from './pass-consistency-carry-choose.ts';
import {
  englishOf,
  splicedParagraphOf,
  writtenOffers,
} from './pass-consistency-carry-offers.ts';
import type {
  CarryContext,
  CarryReceiver,
  LocatedPlace,
  PlaceCarried,
} from './pass-consistency-types.ts';

//region Pass consistency carry
// CARRYING THE CHOSEN RENDERING TO ONE RECEIVING PLACE BY WRITING, NOT BY
// SPLICING (the lead's decision of 2026-10-12, open to the owner's veto). The
// writers of the translate stage are given the chosen place's English and its
// words, the receiving place's original paragraph with its neighbours and its
// current English paragraph, the house rules, and the tense block of an entry
// that records a death; they return the receiving paragraph with the repeated
// wording rendered as the chosen place renders it. The bench then chooses,
// reason before choice, by strict majority, among the current paragraph, the
// code splice (where the chosen words can be moved by code and the floors pass
// it) and each writer's paragraph that passes the floors
// (`pass-consistency-carry-choose.ts`). The winner's edit meets the other groups'
// edits and the floors again in `pass-consistency-apply.ts`; a place whose carry
// fails keeps its English with a finding. NO MODEL OUTPUT REACHES THE PAGE
// WITHOUT THE BENCH AND THE FLOORS.

/**
 Carries the chosen rendering to one receiving place, without containing trouble.

 @param context - what the carry reads

 @param repeat - the repeated wording or frame

 @param chosen - the chosen place and its located rendering

 @param receiver - the receiving place

 @returns The carry's record, the replacement it makes and what it reported

 @throws Whatever the asks and the readers throw, which the caller contains

 @example
 ```ts
 const carried = await carryUncontained({ context, repeat, chosen, receiver, },);
 ```
 */
async function carryUncontained(
  {
    context,
    repeat,
    chosen,
    receiver,
  }: {
    readonly context: CarryContext;
    readonly repeat: ArtifactConsistencyRepeat;
    readonly chosen: LocatedPlace;
    readonly receiver: CarryReceiver;
  },
): Promise<PlaceCarried> {
  /**
   The receiving place's slice English.
   */
  const english = englishOf({ place: receiver.place, },);
  /**
   The block of it that holds the words, as a list of zero or one.
   */
  const [block,] = blockHolding({
    english,
    start: receiver.rendering
      .start,
    end: receiver.rendering
      .start
      + receiver.rendering
      .core
      .length,
  },);
  if (block === undefined) {
    return {
      carry: carryWithoutChoice({
        label: receiver.label,
        decision: {
          kind: 'failed',
          detail: 'the words that render the repeated wording lie in no single block of the English, so no paragraph can be rewritten',
        },
        candidates: [],
      },),
      edits: [],
      findings: [],
    };
  }
  /**
   The chosen place's English paragraph, for the writers' context.
   */
  const [chosenBlock,] = blockHolding({
    english: englishOf({ place: chosen.place, },),
    start: chosen.rendering
      .start,
    end: chosen.rendering
      .start
      + chosen.rendering
      .core
      .length,
  },);
  /**
   The paragraph with the chosen words moved in by code, if that is possible.
   */
  const {
    spliced,
    findings: spliceFindings,
  } = splicedParagraphOf({
    receiver,
    english,
    block,
    context,
  },);
  /**
   The paragraphs the writers wrote that the floors pass.
   */
  const writing = await writtenOffers({
    context,
    repeat,
    chosen,
    receiver,
    english,
    block,
    chosenParagraph: chosenBlock?.text
      ?? chosen.rendering
      .core,
  },);
  return await choose({
    context,
    repeat,
    chosen,
    receiver,
    block,
    offers: carryOffersOf({
      current: block.text,
      splice: spliced,
      written: writing.written,
      lineStructured: receiver.place
        .slice
        .lineStructured,
    },),
    findings: [
      ...spliceFindings,
      ...writing.findings,
    ],
  },);
}

/**
 Carries the chosen rendering to one receiving place, containing whatever goes
 wrong: the place then keeps its English, with a finding.

 @param context - what the carry reads

 @param repeat - the repeated wording or frame

 @param chosen - the chosen place and its located rendering

 @param receiver - the receiving place

 @returns The carry's record, the replacement it makes and what it reported

 @throws The abort reason when the caller stopped the work

 @example
 ```ts
 const carried = await carryToPlace({ context, repeat, chosen, receiver, },);
 ```
 */
export async function carryToPlace(
  {
    context,
    repeat,
    chosen,
    receiver,
  }: {
    readonly context: CarryContext;
    readonly repeat: ArtifactConsistencyRepeat;
    readonly chosen: LocatedPlace;
    readonly receiver: CarryReceiver;
  },
): Promise<PlaceCarried> {
  /**
   Logger pre-tagged with this function's name.
   */
  const cl = tagged({
    tag: carryToPlace.name,
    l: context.l,
  },);
  try {
    return await carryUncontained({
      context: {
        ...context,
        l: cl,
      },
      repeat,
      chosen,
      receiver,
    },);
  }
  catch (error) {
    if (context.signal
      .aborted)
      throw error;
    cl.error(
      `the carry to ${receiver.label} could not be made (${exchangeFailureLogText({ error, },)}); the place keeps its English`,
    );
    return {
      carry: carryWithoutChoice({
        label: receiver.label,
        decision: {
          kind: 'failed',
          detail: exchangeFailureText({ error, },),
        },
        candidates: [],
      },),
      edits: [],
      findings: [`consistency-carry-failed (${receiver.label}): the place keeps its English`,],
    };
  }
}

//endregion Pass consistency carry
