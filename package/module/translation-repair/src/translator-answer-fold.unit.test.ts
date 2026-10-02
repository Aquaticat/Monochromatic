/**
 Guards that every check a translator's answer meets reads the bytes that
 ship. The invisible-variant fold replaces U+2011 with a hyphen, U+00A0 and
 U+202F with a space, and drops U+00AD, U+200B, U+2060 and U+FEFF; the
 translate and consolidation lanes applied it only when building the slate,
 after the publication rule, the repair turn and the floor had read the
 answer as the model wrote it.

 A line holding only one of those characters is no blank line to the page
 parser, so a two-paragraph answer read as one paragraph and passed against a
 one-paragraph page, then shipped as two once folded. A disputed wording
 written with U+2011 for its hyphen was not that wording until folded, and
 then stood on the slate as it.

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  foldInvisibleVariants,
  produceConsolidations,
  produceTranslateSlate,
  repairInvalidCandidates,
  buildTranslateMessages,
  type ConsolidateSubject,
  type RosterModelId,
  validateTranslatedSlice,
} from '../dist/final/node/index.mjs';
import { SEAT_HYPER_OPENROUTER_VISION_EDITOR, } from './roster-seats.test-fixture.ts';
import { cannedClient, } from './streaming-reply-client.test-fixture.ts';

/**
 Logger the lanes under test write their progress to.
 */
const l = tagged({ tag: 'translator-answer-fold-test', },);

/**
 One translator, so the calls it makes come in a known order.
 */
const TRANSLATORS: readonly RosterModelId[] = [SEAT_HYPER_OPENROUTER_VISION_EDITOR,];

/**
 Original slice, one sentence pair in one paragraph.
 */
const SOURCE_TEXT = '小猫在窗台上晒太阳。它打了个哈欠，又睡着了。';

/**
 Page rendering of that slice, one paragraph.
 */
const PAGE_TEXT = 'The kitten basked on the windowsill. It yawned and fell asleep again.';

/**
 A rendering the page parser reads as one paragraph only because its middle
 line holds a no-break space, which the fold turns into a blank line.
 */
const HIDDEN_BREAK = 'The kitten basked on the windowsill.\n \nIt yawned and fell asleep again.';

/**
 A rendering the publication rule accepts as it stands.
 */
const PLAIN = 'The kitten sunned itself on the windowsill. It yawned and dozed off again.';

/**
 Reply body a translator sends.

 @param translation - rendering the reply carries

 @returns Body as the wire carries it

 @example
 ```ts
 const body = translationReply({ translation: PLAIN, },);
 ```
 */
function translationReply({ translation, }: { readonly translation: string; },): string {
  return JSON.stringify({ translation, },);
}

/**
 Reply body an author sends to its findings, revising the rendering.

 @param translation - revised rendering

 @returns Body as the repair wire carries it

 @example
 ```ts
 const body = revisionReply({ translation: PLAIN, },);
 ```
 */
function revisionReply({ translation, }: { readonly translation: string; },): string {
  return JSON.stringify({
    resolution: 'revised',
    translation,
    explanation: 'the paragraph is whole again',
  },);
}

/**
 Whether the publication rule refuses a text as it would ship.

 @param text - text as a lane holds it

 @param pageText - page the text would replace

 @returns Whether the folded text fails the rule

 @example
 ```ts
 const fails = failsAsShipped({ text: HIDDEN_BREAK, pageText: PAGE_TEXT, },);
 ```
 */
function failsAsShipped({
  text,
  pageText,
}: {
  readonly text: string;
  readonly pageText: string;
},): boolean {
  return validateTranslatedSlice({
    sourceText: SOURCE_TEXT,
    candidateText: foldInvisibleVariants({ text, },).text,
    pageText,
    lineStructured: false,
  },).kind === 'invalid';
}

await describe({
  name: 'every check reads a translator\'s answer as it ships',
  children: [
    it({
      name: 'SENDS BACK A TRANSLATION whose hidden break only the fold reveals, so the slate holds no '
        + 'rendering the publication rule refuses as it ships',
      fn: async () => {
        /**
         Slate over a translator whose first answer hides a paragraph break.
         */
        const slate = await produceTranslateSlate({
          client: cannedClient({
            replyByModel: [
              translationReply({ translation: HIDDEN_BREAK, },),
              revisionReply({ translation: PLAIN, },),
            ],
          },),
          translatorModelIds: TRANSLATORS,
          sourceText: SOURCE_TEXT,
          incumbentText: PAGE_TEXT,
          lineStructured: false,
          signal: AbortSignal.timeout(20_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);

        /**
         Fresh renderings the slate offers the judges.
         */
        const fresh = slate.candidates
          .filter(function isFresh(candidate,): boolean {
            return candidate.value.origin === 'fresh';
          },)
          .map(function textOf(candidate,): string {
            return candidate.value.text;
          },);
        expect(fresh.length,).toBeGreaterThan(0,);
        expect(fresh.filter(function refused(text,): boolean {
          return failsAsShipped({
            text,
            pageText: PAGE_TEXT,
          },);
        },),).toEqual([],);
      },
    },),
    it({
      name: 'SENDS BACK A DISPUTED WORDING written with a non-breaking hyphen, so it never stands on the '
        + 'slate as the wording the slice refuses',
      fn: async () => {
        /**
         Wording the slice refuses.
         */
        const disputed = 'The cat-flap swung shut behind the tabby.';

        /**
         Slate over a translator that copies it with U+2011 for its hyphen.
         */
        const slate = await produceTranslateSlate({
          client: cannedClient({
            replyByModel: [
              translationReply({ translation: 'The cat‑flap swung shut behind the tabby.', },),
              revisionReply({ translation: 'The little door clicked closed after the tabby.', },),
            ],
          },),
          translatorModelIds: TRANSLATORS,
          sourceText: '猫门在虎斑猫身后关上了。',
          incumbentText: disputed,
          incumbentEligible: false,
          disputedWordings: [
            {
              text: disputed,
              reason: 'the disputed archive rendering',
            },
          ],
          lineStructured: false,
          signal: AbortSignal.timeout(20_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);
        expect(slate.candidates
          .map(function textOf(candidate,): string {
            return candidate.value.text;
          },)
          .filter(function isDisputed(text,): boolean {
            return text === disputed;
          },),).toEqual([],);
      },
    },),
    it({
      name: 'JUDGES A CONSOLIDATION by the bytes that ship, so a proposal hiding a paragraph break is '
        + 'refused before the repair round and sent back',
      fn: async () => {
        /**
         Slice as the consolidators see it: one paragraph, prose.
         */
        const subject: ConsolidateSubject = {
          sourceText: SOURCE_TEXT,
          incumbentText: PAGE_TEXT,
          repairText: PAGE_TEXT,
          translateText: PLAIN,
          ballots: [],
          lineStructured: false,
        };

        /**
         Slate over a consolidator whose first proposal hides a paragraph break.
         */
        const produced = await produceConsolidations({
          client: cannedClient({
            replyByModel: [
              translationReply({ translation: HIDDEN_BREAK, },),
              revisionReply({ translation: PLAIN, },),
            ],
          },),
          roster: TRANSLATORS,
          subject,
          standingText: PAGE_TEXT,
          signal: AbortSignal.timeout(20_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);
        expect(produced.validityBefore
          .map(function kindOf(entry,): string {
            return entry.validation.kind;
          },),).toEqual(['invalid',],);
        expect(produced.voices
          .filter(function refused(voice,): boolean {
            return failsAsShipped({
              text: voice.value.translation,
              pageText: PAGE_TEXT,
            },);
          },),).toEqual([],);
      },
    },),
    it({
      name: 'REFUSES A REVISION whose hidden break only the fold reveals, so the repair turn never hands '
        + 'back a rendering the publication rule refuses as it ships',
      fn: async () => {
        /**
         Sheet the translator was first given.
         */
        const plan = buildTranslateMessages({
          sourceText: SOURCE_TEXT,
          existingText: PAGE_TEXT,
          lineStructured: false,
        },);

        /**
         Voices after the author answered its findings with a hidden break.
         */
        const repaired = await repairInvalidCandidates({
          client: cannedClient({
            replyByModel: [revisionReply({ translation: HIDDEN_BREAK, },),],
          },),
          voices: [
            {
              modelId: SEAT_HYPER_OPENROUTER_VISION_EDITOR,
              value: { translation: 'The kitten basked on the windowsill.\n\nIt yawned and fell asleep again.', },
            },
          ],
          sourceText: SOURCE_TEXT,
          incumbentText: PAGE_TEXT,
          lineStructured: false,
          priorMessages: plan.messages,
          signal: AbortSignal.timeout(20_000,),
          perCallTimeoutMs: 5_000,
          l,
        },);
        // THE REVISION IS NOT TAKEN: it fails the rule as it ships, so the
        // author's original stands for the floor to withhold.
        expect(repaired.voices
          .map(function textOf(voice,): string {
            return foldInvisibleVariants({ text: voice.value.translation, },).text;
          },)
          .filter(function isTheRevision(text,): boolean {
            return text === foldInvisibleVariants({ text: HIDDEN_BREAK, },).text;
          },),).toEqual([],);
        expect(repaired.findings
          .filter(function unresolved(finding,): boolean {
            return finding.startsWith('translate-repair-unresolved',);
          },)
          .length,).toBe(1,);
      },
    },),
  ],
},);
