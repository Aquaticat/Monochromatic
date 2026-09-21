/**
 Tests for the fault that names a flattened line-structured rendering.
 
 WHAT THESE PIN is the shape the corpus measurement forced. The recorded
 prescription was a line-count check against the original; measured over the
 211 line-structured slices of the pinned corpus, the archive's own English
 matches its Chinese line for line on only 115, and 80 of the 96 that differ
 carry MORE lines, because an English rendering of Chinese verse legitimately
 expands. So the check names a SHORTFALL and nothing else, and the case that
 proves it is the one accepting a longer rendering.
 
 The blind spot has a test of its own rather than a comment, so a later
 instrument that closes it fails here and has to say so.
 
 Fixtures are cat-themed invention, with the original in Simplified Chinese as
 every source in this corpus is. No corpus content appears here.
 
 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  compareLineCounts,
  validateTranslatedSlice,
} from '../dist/final/node/index.mjs';

/**
 One original whose six lines each stand as a unit.
 */
const ORIGINAL = [
  '猫醒了。',
  '太阳很暖。',
  '',
  '它数鸟。',
  '又数一遍。',
  '',
  '门开了。',
  '它不动。',
].join('\n',);

/**
 Rendering that kept every line apart, as the rule asks.
 */
const KEPT_APART = [
  'The cat wakes.',
  'The sun is warm.',
  '',
  'She counts birds.',
  'She counts again.',
  '',
  'A door swings.',
  'She does not move.',
].join('\n',);

/**
 Rendering that merged each pair into one line, which is the fault.
 */
const MERGED = [
  'The cat wakes. The sun is warm.',
  '',
  'She counts birds. She counts again.',
  '',
  'A door swings. She does not move.',
].join('\n',);

await describe({
  name: compareLineCounts.name,
  children: [
    it({
      name:
        'SAYS NOTHING ABOUT AN UNGOVERNED SLICE, even one whose rendering merged every line. Prose '
        + 'has no line-per-unit rule to break, and the semantic wrap still runs there, so a finding '
        + 'here would refuse renderings the pipeline goes on to wrap correctly',
      fn: async () => {
        expect(compareLineCounts({
          lineStructured: false,
          sourceText: ORIGINAL,
          candidateText: MERGED,
        },).length,).toBe(0,);
      },
    },),

    it({
      name:
        'NAMES A GOVERNED RENDERING THAT MERGED LINES, which is the whole fault. The wrap used to '
        + 'paper over this and could not: it splits at semantic boundaries and never joins, so over '
        + 'the 116 governed slices with multi-line blocks, wrapping a flattened passage returned only '
        + '3 exactly and 290 of 740 original lines',
      fn: async () => {
        const found = compareLineCounts({
          lineStructured: true,
          sourceText: ORIGINAL,
          candidateText: MERGED,
        },);

        expect(found.length,).toBe(1,);
      },
    },),

    it({
      name:
        'COUNTS BOTH SIDES IN THE FINDING and restates the rule, because a send-back is the model\'s '
        + 'only instruction on its second turn: it is told what it owes, what it wrote, and that the '
        + 'wording it chose is not what is being refused',
      fn: async () => {
        const [finding,] = compareLineCounts({
          lineStructured: true,
          sourceText: ORIGINAL,
          candidateText: MERGED,
        },);

        expect(finding?.includes('3 lines',),).toBe(true,);
        expect(finding?.includes('6',),).toBe(true,);
        expect(finding?.includes('LINE-STRUCTURED',),).toBe(true,);
      },
    },),

    it({
      name:
        'ACCEPTS A RENDERING CARRYING MORE LINES THAN ITS ORIGINAL, and this case is why the check '
        + 'is not an equality. 80 of the 211 governed slices in the pinned corpus have English '
        + 'carrying more lines than the Chinese; an equality check would send back nearly half of '
        + 'every governed rendering, on text nobody faulted',
      fn: async () => {
        expect(compareLineCounts({
          lineStructured: true,
          sourceText: ORIGINAL,
          candidateText: `${KEPT_APART}\nShe sleeps once more.`,
        },).length,).toBe(0,);
      },
    },),

    it({
      name: 'ACCEPTS A RENDERING THAT KEPT EVERY LINE APART, which is what the rule asks for',
      fn: async () => {
        expect(compareLineCounts({
          lineStructured: true,
          sourceText: ORIGINAL,
          candidateText: KEPT_APART,
        },).length,).toBe(0,);
      },
    },),

    it({
      name:
        'REFUSES A RENDERING THAT REPEATS A LINE the original carries once, and accepts a refrain the '
        + 'original itself repeats (class seventy-four, shi_Yumiaoya6, 2026-09-21): a bilingual attribution '
        + 'rendered once from its Chinese and once from its own English is the same line twice',
      fn: async () => {
        /** Original quoting a film line in Chinese with its English beside it, attribution likewise. */
        const bilingual = '> 如果再也见不到猫，祝你早安。\n>\n> And in case I don’t see the cat, good morning.\n>\n'
          + '> 出自《猫的世界》\n>\n> From *The Cat Show*';
        /** Findings on a rendering carrying the attribution twice. */
        const doubled = compareLineCounts({
          lineStructured: true,
          sourceText: bilingual,
          candidateText: '> If I never see the cat again, good morning.\n>\n'
            + '> And in case I don’t see the cat, good morning.\n>\n> From *The Cat Show*\n>\n> From *The Cat Show*',
        },);
        expect(doubled.length,).toBe(1,);
        expect(doubled[0],).toContain('repeats the line',);
        expect(doubled[0],).toContain('From *The Cat Show*',);
        expect(compareLineCounts({
          lineStructured: true,
          sourceText: '猫醒了。\n太阳很暖。\n猫醒了。',
          candidateText: 'The cat wakes.\nThe sun is warm.\nThe cat wakes.',
        },).length,).toBe(0,);
        expect(compareLineCounts({
          lineStructured: false,
          sourceText: bilingual,
          candidateText: '> From *The Cat Show*\n>\n> From *The Cat Show*',
        },).length,).toBe(0,);
      },
    },),

    it({
      name:
        'IGNORES BLANK LINES ON BOTH SIDES, since they separate blocks rather than carry text. A '
        + 'rendering that writes a different number of them has merged nothing, and faulting it would '
        + 'name a difference the line rule never spoke about',
      fn: async () => {
        expect(compareLineCounts({
          lineStructured: true,
          sourceText: ORIGINAL,
          candidateText: KEPT_APART.replaceAll('\n\n', '\n\n\n',),
        },).length,).toBe(0,);
      },
    },),

    it({
      name:
        'IGNORES A LINE THAT CARRIES ONLY A QUOTE MARKER, since a bare \'>\' separates quoted blocks '
        + 'rather than carrying text; an original writing three of them and a rendering writing one '
        + 'have merged nothing (class forty-seven)',
      fn: async () => {
        expect(compareLineCounts({
          lineStructured: true,
          sourceText: '> 猫醒了。\n>\n> 太阳很暖。\n>\n> 它数鸟。',
          candidateText: '> The cat wakes.\n> The sun is warm.\n> She counts birds.',
        },).length,).toBe(0,);
      },
    },),

    it({
      name:
        'OWES NO SEPARATE LINE FOR A HAN LINE WHOSE ENGLISH STANDS BESIDE IT in the original, since '
        + 'that line is already rendered by its neighbour and carrying both would quote it twice; '
        + 'the prose lines around the pair are still owed one each (class forty-seven, shi_Yumiaoya2)',
      fn: async () => {
        /**
         Bilingual farewell: each Chinese line stands beside its English original.
         */
        const bilingual = [
          '> 如果再也不能见到你，祝你早安。',
          '>',
          '> And in case I never see you again, good morning.',
          '>',
          '> 出自《猫的世界》',
          '>',
          '> From *The Cat Show*',
          '',
          '好了，猫，睡吧。',
          '',
          '条目贡献：[Tabby](https://example.org/tabby)',
        ].join('\n',);
        expect(compareLineCounts({
          lineStructured: true,
          sourceText: bilingual,
          candidateText: [
            '> And in case I never see you again, good morning.',
            '>',
            '> From *The Cat Show*',
            '',
            'All right, cat, sleep now.',
            '',
            'Contributor for this entry: [Tabby](https://example.org/tabby)',
          ].join('\n',),
        },).length,).toBe(0,);
        expect(compareLineCounts({
          lineStructured: true,
          sourceText: bilingual,
          candidateText: [
            '> And in case I never see you again, good morning.',
            '>',
            '> From *The Cat Show*',
            '',
            'All right, cat, sleep now. Contributor for this entry: [Tabby](https://example.org/tabby)',
          ].join('\n',),
        },).length,).toBe(1,);
      },
    },),

    it({
      name:
        'ACCEPTS A RENDERING THAT MERGED IN ONE BLOCK AND SPLIT IN ANOTHER, which is this check\'s '
        + 'one blind spot, pinned here rather than left in a comment. The count is over the whole '
        + 'slice, so the two cancel. Closing it needs per-block alignment, a larger instrument than '
        + 'the flattening this was built to catch, and an instrument that does close it should fail '
        + 'this case and say so',
      fn: async () => {
        expect(compareLineCounts({
          lineStructured: true,
          sourceText: ORIGINAL,
          candidateText: [
            'The cat wakes. The sun is warm.',
            '',
            'She counts birds.',
            'She counts again.',
            '',
            'A door swings.',
            'She does',
            'not move.',
          ].join('\n',),
        },).length,).toBe(0,);
      },
    },),
  ],
},);

await describe({
  name: `${validateTranslatedSlice.name} on a line-structured slice`,
  children: [
    it({
      name:
        'REFUSES A FLATTENED RENDERING THROUGH THE STRUCTURAL GUARD, which is the wiring the skip '
        + 'depends on. Skipping the wrap without this would reopen the hole the audit measured: verse '
        + 'lines separated by a single newline sit inside ONE block, so a producer that merged them '
        + 'passed a guard comparing blocks and atoms, and the wrap silently papered over it after',
      fn: async () => {
        const validation = validateTranslatedSlice({
          sourceText: ORIGINAL,
          candidateText: MERGED,
          lineStructured: true,
        },);

        expect(validation.kind,).toBe('invalid',);
        expect(
          (validation.kind === 'invalid')
            && validation.findings.some(function namesTheRule(finding,): boolean {
            return finding.includes('LINE-STRUCTURED',);
          },),
        ).toBe(true,);
      },
    },),

    it({
      name:
        'LEAVES THE CHECK OFF WHERE A CALLER SAID NOTHING, since the decision is a union over the '
        + 'slice AND its enclosing chunk and the slice half alone covers 55 slices where the union '
        + 'covers 211. A guard defaulting the other way would guess at that from the slice, which is '
        + 'the reading measured to be wrong',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: ORIGINAL,
          candidateText: MERGED,
        },).kind,).toBe('valid',);
      },
    },),
  ],
},);
