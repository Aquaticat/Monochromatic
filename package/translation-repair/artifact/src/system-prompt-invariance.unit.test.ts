/**
 Holds every stage's system prompt to the same text on every call (R4 of the second review of the Claude route).

 The Claude body marks the system prompt of each call for the five-minute cache. A cache write costs 2.50 USD
 a million input tokens against 2.00 uncached for Sonnet, so a system prompt that embeds the words of one call is
 paid for at the write rate on every call and is never read back. The sheets keep
 the subject in the user turn; this file renders each stage for two subjects that share a shape and differ in every word
 and requires the system text to be equal.

 A stage that has a fixed set of variants (a recorded death, a refrain against a repeated sentence, the two
 perspectives of the naturalness review) is rendered once per variant, each variant against both subjects, so the
 system text may differ between variants and never between subjects. Nothing here reaches a provider.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { systemTextOf, } from '@monochromatic-dev/translation-repair-provider';
import {
  CAT_SUBJECT,
  DOG_SUBJECT,
  type PromptMessages,
  type PromptStage,
} from '@monochromatic-dev/translation-repair-repair/ts/system-prompt-subject.test-fixture.ts';
import { PREPARATION_STAGES, } from '@monochromatic-dev/translation-repair-repair/ts/system-prompt-stages-preparation.test-fixture.ts';
import { SLATE_STAGES, } from '@monochromatic-dev/translation-repair-repair/ts/system-prompt-stages-slates.test-fixture.ts';
import { WRITER_STAGES, } from '@monochromatic-dev/translation-repair-repair/ts/system-prompt-stages-writers.test-fixture.ts';
import { CARRY_STAGES, } from './system-prompt-stages-carry.test-fixture.ts';
import { CONSISTENCY_STAGES, } from './system-prompt-stages-consistency.test-fixture.ts';
import { PAGE_STAGES, } from './system-prompt-stages-pages.test-fixture.ts';

/**
 Every stage, rendered once per variant.
 */
const STAGES: readonly PromptStage[] = [
  ...WRITER_STAGES,
  ...SLATE_STAGES,
  ...PREPARATION_STAGES,
  ...PAGE_STAGES,
  ...CONSISTENCY_STAGES,
  ...CARRY_STAGES,
];

/**
 The turns of a conversation that are not the system prompt.

 @param messages - conversation a builder handed back

 @returns Every user and assistant turn

 @example
 ```ts
 const turns = notSystem({ messages, },);
 ```
 */
function notSystem(
  { messages, }: { readonly messages: PromptMessages; },
): PromptMessages {
  return messages.filter(function isOtherTurn({ role, },): boolean {
    return role !== 'system';
  },);
}

/**
 Renders a stage for the cat and the dog and reads the system text the Claude body would cache.

 @param stage - stage and variant to render

 @returns The system text for each subject

 @example
 ```ts
 const { cat, dog, } = systemTextsOf({ stage: WRITER_STAGES[0], },);
 ```
 */
function systemTextsOf(
  { stage, }: { readonly stage: PromptStage; },
): {
  readonly cat: string;
  readonly dog: string;
} {
  return {
    cat: systemTextOf({ messages: stage.render({ subject: CAT_SUBJECT, },), },),
    dog: systemTextOf({ messages: stage.render({ subject: DOG_SUBJECT, },), },),
  };
}

/**
 Renders a stage for the cat and the dog and reads every turn that is not the system prompt.

 @param stage - stage and variant to render

 @returns The other turns for each subject, as JSON

 @example
 ```ts
 const { cat, dog, } = otherTurnsOf({ stage: WRITER_STAGES[0], },);
 ```
 */
function otherTurnsOf(
  { stage, }: { readonly stage: PromptStage; },
): {
  readonly cat: string;
  readonly dog: string;
} {
  return {
    cat: JSON.stringify(notSystem({ messages: stage.render({ subject: CAT_SUBJECT, },), },),),
    dog: JSON.stringify(notSystem({ messages: stage.render({ subject: DOG_SUBJECT, },), },),),
  };
}

await describe({
  name: 'the system prompt of every stage',
  concurrency: 1,
  children: [
    ...STAGES.map(function caseOf(stage,) {
      return it({
        name: `IS THE SAME TEXT FOR TWO SUBJECTS IN THE ${stage.name.toUpperCase()} SHEET (R4): the cache breakpoint on `
          + 'the system block is written once and read on every later call, never rewritten for each subject',
        fn: async () => {
          const { cat, dog, } = systemTextsOf({ stage, },);
          expect(cat.length,).toBeGreaterThan(0,);
          expect(dog,).toBe(cat,);
          // THE SUBJECTS REACH THE BUILDER: the turns that are not the system prompt differ, so an equal system
          // text is not the result of a render that ignored its subject.
          expect(otherTurnsOf({ stage, },).dog,).not.toBe(otherTurnsOf({ stage, },).cat,);
        },
      },);
    },),

    it({
      name: 'FAILS FOR A SYSTEM TEXT THAT EMBEDS THE SUBJECT (the positive control of R4): the comparison made for every '
        + 'stage can tell two subjects apart, so an equal pair is evidence and not a probe that reads nothing',
      fn: async () => {
        const { cat, dog, } = systemTextsOf({
          stage: {
            name: 'control',
            render: ({ subject, },) => [{ role: 'system', content: `Judge ${subject.source}`, },],
          },
        },);
        expect(dog,).not.toBe(cat,);
      },
    },),

    it({
      name: 'VARIES WITH THE SHOWN TEXTS ONLY BY THE FENCE LENGTH THE SELECTION SLATES STATE (R4, a rare variant): a '
        + 'text holding a run of five equals signs lengthens the fence to six, and the sentence naming the length is '
        + 'the only difference in the system text; no fix, since the length is part of the rules the model reads first',
      fn: async () => {
        /**
         The chunk slate, whose system text names the fence length.
         */
        const chunkSlate = SLATE_STAGES.find(function isChunk({ name, },): boolean {
          return name === 'chunk slate';
        },);
        expect(chunkSlate,).toBeDefined();
        /**
         The system text with a plain subject.
         */
        const plain = systemTextOf({ messages: chunkSlate?.render({ subject: CAT_SUBJECT, },) ?? [], },);
        /**
         The system text with a subject whose original holds a setext heading underline of five equals signs.
         */
        const underlined = systemTextOf({
          messages: chunkSlate?.render({
            subject: { ...CAT_SUBJECT, source: `${CAT_SUBJECT.source}\n=====`, },
          },) ?? [],
        },);
        expect(plain,).toContain('a line of 5 equals signs',);
        expect(underlined,).toContain('a line of 6 equals signs',);
        expect(underlined.replace('a line of 6 equals signs', 'a line of 5 equals signs',),).toBe(plain,);
      },
    },),

    it({
      name: 'NAMES EVERY STAGE ONCE: a variant renamed twice would be rendered twice and read once',
      fn: async () => {
        const names = STAGES.map(function nameOf({ name, },): string {
          return name;
        },);
        expect(new Set(names,).size,).toBe(names.length,);
      },
    },),
  ],
},);
