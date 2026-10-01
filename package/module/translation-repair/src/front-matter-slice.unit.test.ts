/**
 Tests explicit front matter slicing and structural translation validation.
 
 @module
 */

import {
  caught,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  archiveDisputesOf,
  FrontMatterParseError,
  frontMatterRepairOutcome,
  frontMatterSlice,
  splitFrontMatter,
  validateFrontMatterTranslation,
} from '../dist/final/node/index.mjs';

/**
 Source metadata fixture.
 */
const SOURCE = {
  raw: '---\nname: 猫猫\ninfo:\n  alias: 猫\n---\n',
  data: {
    name: '猫猫',
    info: { alias: '猫', },
  },
};

/**
 Target metadata fixture.
 */
const TARGET = {
  raw: '---\nname: Maomao\ninfo:\n  alias: Cat\n---\n',
  data: {
    name: 'Maomao',
    info: { alias: 'Cat', },
  },
};

/**
 A translation of the source fixture carrying the target's shape.
 */
const TRANSLATED = '---\nname: Mao\ninfo:\n  alias: Kitty\n---\n';

/**
 Fenced metadata whose YAML the parser refuses.
 */
const BROKEN_YAML = '---\nname: [broken\n---\n';

/**
 Source metadata where visible name and alias identify same person form.
 */
const SAME_IDENTITY_SOURCE = '---\nname: 猫猫\ninfo:\n  alias: 猫猫\n---\n';

/**
 Archive metadata whose visible name is entry id rather than declared alias.
 */
const DIRECTORY_ID_TARGET = '---\nname: CatEntry\ninfo:\n  alias: Maomao\n---\n';

/**
 Source metadata carrying contributor attribution in location comment.
 */
const COMMENT_SOURCE = '---\nname: 猫猫\ninfo:\n  alias: 猫猫\n  location: 广东 #清远, by 魔骨\n---\n';

/**
 Archive metadata establishing Latin contributor attribution at same path.
 */
const COMMENT_TARGET = '---\nname: Maomao\ninfo:\n  alias: Maomao\n  location: Guangdong #Qingyuan, by MoguHandle\n---\n';

await describe({
  name: frontMatterSlice.name,
  children: [
    it({
      name: 'CREATES EXPLICIT SLICE ZERO over exact source and target metadata bytes',
      fn: async () => {
        const result = frontMatterSlice({ source: SOURCE, target: TARGET, });
        expect(result.kind,).toBe('paired',);
        if (result.kind !== 'paired')
          throw new Error('expected paired front matter fixture',);
        expect(result.slice,).toEqual({
          syntax: 'front-matter',
          source: {
            kind: 'content',
            sliceIndex: 0,
            nodes: [],
            startOffset: 0,
            endOffset: SOURCE.raw.length,
            text: SOURCE.raw,
          },
          target: {
            kind: 'content',
            sliceIndex: 0,
            nodes: [],
            startOffset: 0,
            endOffset: TARGET.raw.length,
            text: TARGET.raw,
          },
        },);
      },
    },),

    it({
      name: 'RETURNS EXPLICIT NONE when neither document declares metadata',
      fn: async () => {
        expect(frontMatterSlice({},),).toEqual({ kind: 'none', },);
      },
    },),

    it({
      name: 'CREATES INSERTION SLICE when source metadata has no target rendering',
      fn: async () => {
        const result = frontMatterSlice({ source: SOURCE, },);
        expect(result.kind,).toBe('paired',);
        if (result.kind !== 'paired')
          throw new Error('source-only metadata did not create insertion slice',);
        expect(result.slice.target,).toEqual({
          kind: 'insertion',
          sliceIndex: 0,
          nodes: [],
          startOffset: 0,
          endOffset: 0,
          text: '',
        },);
      },
    },),

    it({
      name: 'PRESERVES TARGET-ONLY METADATA outside localized slice',
      fn: async () => {
        expect(frontMatterSlice({ target: TARGET, },),).toEqual({ kind: 'none', },);
      },
    },),
  ],
},);

await describe({
  name: frontMatterRepairOutcome.name,
  children: [
    it({
      name: 'EMITS EXPLICIT UNCHANGED REPAIR ROW so prose editors never touch YAML',
      fn: async () => {
        const outcome = frontMatterRepairOutcome({
          sliceIndex: 0,
          targetText: TARGET.raw,
        },);
        expect(outcome.changed,).toBe(false,);
        expect(outcome.repairedText,).toBe(TARGET.raw,);
        expect(outcome.findings,).toContain(
          'repair-front-matter-not-applicable (translate ensemble owns YAML metadata)',
        );
      },
    },),
    // LEDGER B29: the front-matter contest checks its lanes without the
    // slice's disputed wordings (`lane-contest-eligibility.ts`), which is
    // sound only while no dispute can exist at a front-matter slice.
    it({
      name: 'RAISES NO ISSUE, so no dispute and no disputed wording exists at a front-matter slice',
      fn: async () => {
        /**
         Repair row for the metadata slice.
         */
        const outcome = frontMatterRepairOutcome({
          sliceIndex: 0,
          targetText: TARGET.raw,
        },);
        expect(outcome.issues,).toEqual([],);
        expect(archiveDisputesOf({ chunks: [outcome,], },).size,).toBe(0,);
      },
    },),
  ],
},);

await describe({
  name: validateFrontMatterTranslation.name,
  children: [
    it({
      name: 'ACCEPTS TRANSLATED SCALARS under exact archive key and container shape',
      fn: async () => {
        expect(validateFrontMatterTranslation({
          sourceText: SOURCE.raw,
          pageText: TARGET.raw,
          candidateText: '---\nname: Mao\ninfo:\n  alias: Kitty\n---\n',
        },).kind,).toBe('valid',);
      },
    },),

    it({
      name: 'ACCEPTS SOURCE-SHAPED METADATA when target page has none',
      fn: async () => {
        expect(validateFrontMatterTranslation({
          sourceText: SOURCE.raw,
          pageText: '',
          candidateText: '---\nname: Mao\ninfo:\n  alias: Kitty\n---\n',
        },).kind,).toBe('valid',);
      },
    },),

    it({
      name: 'JUDGES A CANDIDATE BY THE ORIGINAL\'S SHAPE where the page\'s front matter holds nothing, '
        + 'since an empty block has no established keys to keep',
      fn: async () => {
        /**
         Page whose fence pair holds no metadata at all.
         */
        const emptyPage = '---\n---\n\nThe cat naps.\n';
        expect(validateFrontMatterTranslation({
          sourceText: SOURCE.raw,
          pageText: emptyPage,
          candidateText: TRANSLATED,
        },).kind,).toBe('valid',);
        expect(validateFrontMatterTranslation({
          sourceText: SOURCE.raw,
          pageText: emptyPage,
          candidateText: '---\n---\n',
        },),).toEqual({
          kind: 'invalid',
          findings: ['Your translation changed YAML field names, nesting, container lengths, or scalar kinds.',],
        },);
      },
    },),

    it({
      name: 'REFUSES A LIST-SHAPED info.alias THAT DROPS THE NAME, as the comma-separated form is refused '
        + '(ledger B97)',
      fn: async () => {
        /**
         Original whose alias list holds only its name, so name and alias are one identity.
         */
        const listSource = '---\nname: 猫猫\ninfo:\n  alias:\n    - 猫猫\n---\n';
        /**
         Archive in the same list shape, which a candidate keeps.
         */
        const listPage = '---\nname: Maomao\ninfo:\n  alias:\n    - Maomao\n---\n';
        expect(validateFrontMatterTranslation({
          sourceText: listSource,
          pageText: listPage,
          candidateText: '---\nname: Maomao\ninfo:\n  alias:\n    - Kitty\n---\n',
        },),).toEqual({
          kind: 'invalid',
          findings: [
            'Your translation must carry the name among the comma-separated renderings in info.alias because ORIGINAL declares name and info.alias as the same identity.',
          ],
        },);
        expect(validateFrontMatterTranslation({
          sourceText: listSource,
          pageText: listPage,
          candidateText: listPage,
        },).kind,).toBe('valid',);
      },
    },),

    it({
      name: 'REFUSES FIELD LOSS, BODY PROSE, AND MALFORMED YAML',
      fn: async () => {
        expect(validateFrontMatterTranslation({
          sourceText: SOURCE.raw,
          pageText: TARGET.raw,
          candidateText: '---\nname: Mao\n---\n',
        },).kind,).toBe('invalid',);
        expect(validateFrontMatterTranslation({
          sourceText: SOURCE.raw,
          pageText: TARGET.raw,
          candidateText: `${TARGET.raw}explanation`,
        },).kind,).toBe('invalid',);
        expect(validateFrontMatterTranslation({
          sourceText: SOURCE.raw,
          pageText: TARGET.raw,
          candidateText: '---\nname: [broken\n---\n',
        },).kind,).toBe('invalid',);
      },
    },),

    it({
      name: 'LEAVES A CANDIDATE UNVALIDATED where the original or the page carries no fenced front matter, '
        + 'and still charges the candidate its own faults first',
      fn: async () => {
        expect(validateFrontMatterTranslation({
          sourceText: 'name: 猫猫\n',
          pageText: TARGET.raw,
          candidateText: TRANSLATED,
        },),).toEqual({
          kind: 'unknown',
          detail: 'source front matter could not be read',
        },);
        expect(validateFrontMatterTranslation({
          sourceText: SOURCE.raw,
          pageText: 'name: Maomao\n',
          candidateText: TRANSLATED,
        },),).toEqual({
          kind: 'unknown',
          detail: 'page front matter could not be read',
        },);
        expect(validateFrontMatterTranslation({
          sourceText: 'name: 猫猫\n',
          pageText: TARGET.raw,
          candidateText: `${TRANSLATED}explanation`,
        },),).toEqual({
          kind: 'invalid',
          findings: ['Your translation added text outside YAML front matter block.',],
        },);
      },
    },),

    it({
      name: 'LEAVES A CANDIDATE UNVALIDATED where the original\'s or the page\'s YAML is refused, rather than '
        + 'charging that refusal to the candidate as its own (ledger B44)',
      fn: async () => {
        /**
         What the splitter says of the refused YAML, which each side's detail
         carries.
         */
        const refusal = caught(function splitBroken(): void {
          splitFrontMatter({ text: BROKEN_YAML, },);
        },);
        if (!(refusal instanceof FrontMatterParseError))
          throw new Error('the broken fixture parsed, so it no longer exercises a refusal',);

        expect(validateFrontMatterTranslation({
          sourceText: BROKEN_YAML,
          pageText: TARGET.raw,
          candidateText: TRANSLATED,
        },),).toEqual({
          kind: 'unknown',
          detail: `source front matter could not be read: ${refusal.message}`,
        },);
        expect(validateFrontMatterTranslation({
          sourceText: SOURCE.raw,
          pageText: BROKEN_YAML,
          candidateText: TRANSLATED,
        },),).toEqual({
          kind: 'unknown',
          detail: `page front matter could not be read: ${refusal.message}`,
        },);
      },
    },),

    it({
      name: 'REFUSES SOURCE-SCRIPT COMMENT ATTRIBUTION replacing established target form',
      fn: async () => {
        expect(validateFrontMatterTranslation({
          sourceText: COMMENT_SOURCE,
          pageText: COMMENT_TARGET,
          candidateText: '---\nname: Maomao\ninfo:\n  alias: Maomao\n  location: Guangdong #Qingyuan, by 魔骨\n---\n',
        },).kind,).toBe('invalid',);
        expect(validateFrontMatterTranslation({
          sourceText: COMMENT_SOURCE,
          pageText: COMMENT_TARGET,
          candidateText: COMMENT_TARGET,
        },).kind,).toBe('valid',);
      },
    },),

    it({
      name: 'REFUSES DIRECTORY ID when source visible name and alias are same identity',
      fn: async () => {
        expect(validateFrontMatterTranslation({
          sourceText: SAME_IDENTITY_SOURCE,
          pageText: DIRECTORY_ID_TARGET,
          candidateText: DIRECTORY_ID_TARGET,
        },).kind,).toBe('invalid',);
        expect(validateFrontMatterTranslation({
          sourceText: SAME_IDENTITY_SOURCE,
          pageText: DIRECTORY_ID_TARGET,
          candidateText: '---\nname: Maomao\ninfo:\n  alias: Maomao\n---\n',
        },).kind,).toBe('valid',);
      },
    },),
  ],
},);
