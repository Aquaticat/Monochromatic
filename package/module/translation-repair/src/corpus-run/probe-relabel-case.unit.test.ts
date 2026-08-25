/**
 * Tests for finding the slice a recorded replacement was made in.
 *
 * THE PROBE RE-CARVES WHAT THE RUN CARVED, which is the only reason this
 * function exists: a relabelling asks a fresh reader about a region production
 * already edited, and if the re-carve landed on different text the reader would
 * be answering about a passage production never sent. So the lookup is by TEXT
 * rather than by index, and the two returned halves must come from ONE slice.
 * A function that returned the whole document for both would satisfy a
 * careless test and quietly widen every prompt the probe sends.
 *
 * THE REFUSAL IS A SECURITY BOUNDARY, not just a diagnostic.
 * `ArtifactParseError` carries `messageNamesOnly`, which `reportingRefusals`
 * reads as permission to print the whole message, and the marker's justification
 * is that the class "names the artifact path and the shape the value failed to
 * satisfy, and quotes neither the value nor the file". Until 2026-08-25 this
 * site put 80 characters of the replaced TRANSLATION into that path, so a probe
 * that could not find its slice printed a memorial page's wording to a terminal
 * and into the run's log. Sweeping the package found it was the only one of 47
 * interpolating paths that quoted text rather than a structural position. One
 * case below is that guard, and it is the reason this file is worth its length.
 *
 * FIXTURES ARE INVENTED AND CAT-THEMED, in Simplified Chinese against English,
 * because the real inputs are unlicensed corpus pages.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  ArtifactParseError,
  locateSlice,
} from '../../dist/final/node/index.mjs';

//region Relabel case location tests

/**
 * Source page, two sections, as the corpus writes one.
 */
const SOURCE_TEXT = [
  '## 第一节',
  '',
  '猫坐在垫子上。',
  '',
  '## 第二节',
  '',
  '小猫在楼梯上看着。',
  '',
].join('\n',);

/**
 * Translation of that page, section for section.
 */
const TARGET_TEXT = [
  '## Section One',
  '',
  'The cat sat on the mat.',
  '',
  '## Section Two',
  '',
  'The kitten watched from the stairs.',
  '',
].join('\n',);

/**
 * Wording the first section carries, which an edit replaced.
 */
const FIRST_WORDING = 'The cat sat on the mat.';

/**
 * Wording the second section carries, so a lookup has to choose.
 */
const SECOND_WORDING = 'The kitten watched from the stairs.';

/**
 * Source of the section holding {@link FIRST_WORDING}.
 */
const FIRST_SOURCE = '## 第一节\n\n猫坐在垫子上。';

/**
 * Source of the section holding {@link SECOND_WORDING}.
 */
const SECOND_SOURCE = '## 第二节\n\n小猫在楼梯上看着。';

/**
 * Wording no slice carries, standing in for a re-carve that drifted.
 *
 * Written as a sentence a search can find whole, so a message that quoted it
 * back could not be mistaken for a coincidence.
 */
const ABSENT_WORDING = 'the dog barked once at the gate and then lay down again';

await describe({
  name: locateSlice.name,
  children: [
    it({
      name: 'RETURNS the slice carrying the replaced text, not the whole page',
      fn: async () => {
        expect(locateSlice({
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          before: FIRST_WORDING,
        },),).toEqual({
          sourceText: FIRST_SOURCE,
          baselineText: `## Section One\n\n${FIRST_WORDING}`,
        },);
      },
    },),
    it({
      name: 'CHOOSES the slice by its text, so a later section is found as readily',
      fn: async () => {
        // The positive control for the case above: a lookup that always
        // returned the first slice would pass that one and fail this.
        expect(locateSlice({
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          before: SECOND_WORDING,
        },),).toEqual({
          sourceText: SECOND_SOURCE,
          baselineText: `## Section Two\n\n${SECOND_WORDING}`,
        },);
      },
    },),
    it({
      name: 'PAIRS the source and the translation of ONE slice, never across two',
      fn: async () => {
        /**
         * Second section's slice, found by its own wording.
         */
        const found = locateSlice({
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          before: SECOND_WORDING,
        },);

        // A prompt built from the first section's source and the second's
        // translation would ask a reader to compare unrelated passages, and
        // every claim it drew would be noise.
        expect(found.sourceText.includes('第一节',),).toBe(false,);
        expect(found.baselineText.includes('Section One',),).toBe(false,);
      },
    },),
    it({
      name: 'REFUSES when no slice carries the replaced text, since the re-carve drifted',
      fn: async () => {
        expect(() => {
          locateSlice({
            sourceText: SOURCE_TEXT,
            targetText: TARGET_TEXT,
            before: ABSENT_WORDING,
          },);
        },).toThrow(ArtifactParseError,);
      },
    },),
    it({
      name: 'REFUSES to quote the text it could not find, naming only its length',
      fn: async () => {
        /**
         * Refusal the missing lookup raised, or nothing when it did not raise.
         */
        let said = '';

        try {
          locateSlice({
            sourceText: SOURCE_TEXT,
            targetText: TARGET_TEXT,
            before: ABSENT_WORDING,
          },);
        }
        catch (refused) {
          said = String(refused,);
        }

        // The class is marked quote-free, so `reportingRefusals` prints this
        // message whole. Anything of the corpus that reaches it reaches a
        // terminal and a log.
        expect(said.includes(ABSENT_WORDING,),).toBe(false,);
        expect(said.includes('the dog barked',),).toBe(false,);
        expect(said.includes(`${String(ABSENT_WORDING.length,)} characters`,),).toBe(true,);
      },
    },),
    it({
      name: 'SAYS what a missing slice means, so the refusal is actionable',
      fn: async () => {
        expect(() => {
          locateSlice({
            sourceText: SOURCE_TEXT,
            targetText: TARGET_TEXT,
            before: ABSENT_WORDING,
          },);
        },).toThrow('slicing no longer reproduces the run',);
      },
    },),
  ],
},);

//endregion Relabel case location tests
