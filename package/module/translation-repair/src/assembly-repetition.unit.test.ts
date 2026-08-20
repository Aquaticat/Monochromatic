/**
 * Tests for the document-scale repetition check: what it names, and the three
 * things it must NOT name.
 *
 * WHY IT EXISTS, from `#66`: the introduced-defect probe compares one edited
 * region against itself, so `lintong`'s duplicated farewell was invisible to it
 * at any setting. The duplication lives in no single region, only in the
 * assembled document. This check reads the whole document against the archive
 * the artifact now stores, which needs no model, no roster and no quota.
 *
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  findIntroducedRepetitions,
  repetitionFindings,
} from '../dist/final/node/index.mjs';

/**
 * A passage long enough to be reported, standing in for the farewell the repair
 * lane said twice.
 */
const PASSAGE = 'do come back and visit the tabby by the gate again soon';

await describe({
  name: findIntroducedRepetitions.name,
  children: [
    it({
      name: 'NAMES a passage the shipped document says twice and the archive said once',
      fn: async () => {
        const findings = findIntroducedRepetitions({
          archiveText: `The kitten dozes. ${PASSAGE}. The end.`,
          shippedText: `The kitten dozes. ${PASSAGE}. And again: ${PASSAGE}. The end.`,
        },);
        expect(findings.length,).toBe(1,);
        expect(findings[0]?.archiveCount,).toBe(1,);
        expect(findings[0]?.shippedCount,).toBe(2,);
        // The reported phrase carries whatever punctuation sits on its tokens,
        // since words are whitespace-separated, so it is checked against the
        // shipped text rather than against the bare passage.
        expect(`The kitten dozes. ${PASSAGE}. And again: ${PASSAGE}. The end.`,)
          .toContain(findings[0]?.phrase ?? 'nothing',);
      },
    },),
    it({
      name: 'IGNORES repetition the archive already carried, which is the author\'s and not ours',
      fn: async () => {
        // A refrain repeated on purpose. A check that fired on this would fire
        // on every poem and every list in the corpus.
        const findings = findIntroducedRepetitions({
          archiveText: `${PASSAGE}. The kitten dozes. ${PASSAGE}.`,
          shippedText: `${PASSAGE}. The kitten naps. ${PASSAGE}.`,
        },);
        expect(findings.length,).toBe(0,);
      },
    },),
    it({
      name: 'REPORTS THE LONGEST FORM rather than every substring of it',
      fn: async () => {
        // A repeated eleven-word passage also repeats as eight four-word ones,
        // and reporting those would bury the finding inside itself.
        const findings = findIntroducedRepetitions({
          archiveText: `${PASSAGE}.`,
          shippedText: `${PASSAGE}. ${PASSAGE}.`,
        },);
        expect(findings.length,).toBe(1,);
      },
    },),
    it({
      name: 'is UNAFFECTED by rewrapping, since shipped text is wrapped semantically',
      fn: async () => {
        /**
         * The same words, broken across lines the way the wrapper would.
         */
        const wrapped = PASSAGE.split(' ',)
          .join('\n',);
        const findings = findIntroducedRepetitions({
          archiveText: `${PASSAGE}.`,
          shippedText: `${wrapped}. ${wrapped}.`,
        },);
        expect(findings.length,).toBe(1,);
        expect(findings[0]?.shippedCount,).toBe(2,);
      },
    },),
    it({
      name: 'names wording the pipeline INVENTED twice, which the archive never had',
      fn: async () => {
        const findings = findIntroducedRepetitions({
          archiveText: 'The kitten dozes on the windowsill.',
          shippedText: `The kitten dozes. ${PASSAGE}. ${PASSAGE}.`,
        },);
        expect(findings.length,).toBe(1,);
        expect(findings[0]?.archiveCount,).toBe(0,);
      },
    },),
    it({
      name: 'renders a finding NAMING THE SHAPE and never the passage itself',
      fn: async () => {
        // Findings are counted and compared across runs. A passage of prose
        // inside one would make every tally depend on the text it happened to
        // find, so the finding carries the shape and the counts only.
        const rendered = repetitionFindings({
          archiveText: `The kitten dozes. ${PASSAGE}.`,
          shippedText: `The kitten dozes. ${PASSAGE}. Again: ${PASSAGE}.`,
        },);
        expect(rendered.length,).toBe(1,);
        expect(rendered[0],).toContain('introduced-repetition',);
        expect(rendered[0],).toContain('archive 1',);
        expect(rendered[0],).toContain('shipped 2',);
        expect(rendered[0],).not.toContain('tabby',);
      },
    },),
    it({
      name: 'stays quiet on an untouched document',
      fn: async () => {
        const findings = findIntroducedRepetitions({
          archiveText: `The kitten dozes. ${PASSAGE}.`,
          shippedText: `The kitten dozes. ${PASSAGE}.`,
        },);
        expect(findings.length,).toBe(0,);
      },
    },),
  ],
},);
