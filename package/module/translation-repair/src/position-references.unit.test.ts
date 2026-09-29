/**
 Guards against references by position (ledger D33): "the case above", "see
 below", "the paragraph before this", "the latter". A reference by position
 names nothing once a case, a paragraph or a line is added between the two, so
 the repository rule is to name what a text points at: a case by its name, a
 constant or function by its identifier, a doc by its heading or ledger entry.
 The census found 296 such phrases in the package and 79 in the living docs.

 WHAT IS READ is every text the task-number guard reads: the package's
 TypeScript under `src` (comments and strings alike, since a test's name is a
 string), its docs, README and task file, and the living repository-level
 docs. Wrapped comment and string lines are joined first, so a phrase broken
 across two lines is still one phrase.

 WHAT IS FOUND is the shapes a positional reference takes, matched over words:
 a reference verb before "above" or "below" ("see above", "described
 below"); "above" or "below" in parentheses; a text-structure noun before
 either ("the case above", "the two below", "every count below"), unless what
 follows makes it a comparison ("ranks the house rules above its own", "a
 rate above one") or names the target ("a heading above" a quoted heading);
 a structure noun before "before this" or "after it"; "earlier in this file"
 and its kin; and "the former" or "the latter".

 WHAT IS LEFT is a phrase inside double quotes, which quotes the words rather
 than using them, and the exemptions, each named with its reason: positions in
 a page's own text (a note above a letter), comparisons the shapes cannot tell
 apart, and the text of a model-facing sheet. A sheet is rendered whole, in the
 one order its builder fixes, and read once; editing one changes the cache key
 it is stored under, so a sheet's wording is exempt as a class. "The next
 heading" and "the previous section" are not read at all: this package handles
 documents, and those phrases name a unit of the data far more often than a
 unit of the text they sit in.

 THE FIXTURES COME FIRST, so the package-wide case is read against a scan
 shown able to find each shape (ledger M21). Fixtures are cat-themed.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  PACKAGE_EXEMPTIONS,
  REPOSITORY_EXEMPTIONS,
} from './position-references-exemptions.test-fixture.ts';
import {
  positionReferences,
  staleExemptions,
  unexempted,
} from './position-references.test-fixture.ts';
import {
  readPackageTexts,
  readRepositoryTexts,
} from './prose-texts.test-fixture.ts';



await describe({
  name: 'references by position',
  children: [
    it({
      name: 'FINDS a reference verb, a parenthesised position, a structure noun, a sequence noun before this, a '
        + 'position in this text and the former or the latter',
      fn: async () => {
        expect(positionReferences({
          file: {
            path: 'doc/cat.md',
            text: [
              'Naps as noted above.',
              'The bowl (see below) is full.',
              'The case above pins the bowl, and every count below is a whisker.',
              'The paragraph before this one purrs, and the note after it naps.',
              'Earlier in this file the cat napped.',
              'The kitten and the cat napped; the latter purred.',
            ].join('\n',),
          },
        },).map(function phraseOf({ phrase, },): string {
          return phrase;
        },),).toEqual([
          'noted above',
          'see below',
          'case above',
          'count below',
          'The paragraph before this',
          'the note after it',
          'Earlier in this file',
          'the latter',
        ],);
      },
    },),
    it({
      name: 'JOINS a phrase wrapped across comment lines and across a string joined by a sign, and locates it by '
        + 'the line it starts on',
      fn: async () => {
        expect(positionReferences({
          file: {
            path: 'src/cat.unit.test.ts',
            text: [
              '// The bowl case',
              '// above is a whisker.',
              'const name = \'PURRS, which the case \'',
              '  + \'above needs\';',
            ].join('\n',),
          },
        },).map(function locatedPhrase({ line, phrase, },): string {
          return `${String(line,)} ${phrase}`;
        },),).toEqual([
          '1 case above',
          '3 case \' above',
        ],);
      },
    },),
    it({
      name: 'READS QUOTES ACROSS A WRAPPED LINE, so a quotation that opens on one line and closes on the next '
        + 'is left and a phrase after it is found',
      fn: async () => {
        expect(positionReferences({
          file: {
            path: 'doc/cat.md',
            text: [
              'Never write "the note',
              'above" in a doc; the case above names nothing.',
            ].join('\n',),
          },
        },).map(function phraseOf({ phrase, },): string {
          return phrase;
        },),).toEqual(['case above',],);
      },
    },),
    it({
      name: 'LEAVES a comparison, a named target, a quoted phrase, a position in running text and a position '
        + 'with no structure noun before it',
      fn: async () => {
        expect(positionReferences({
          file: {
            path: 'doc/cat.md',
            text: [
              'The cat ranks the house rules above its own, at a rate above one.',
              'Record it under a new heading above "## Naps" and the counts above 3 and above `limit`.',
              'Never write "see above" or "the case above".',
              'The kitten leapt above the bowl and slept below.',
            ].join('\n',),
          },
        },),).toEqual([],);
      },
    },),
    it({
      name: 'FINDS NO REFERENCE BY POSITION across the package\'s source, tests, docs, README and task file outside '
        + 'the named exemptions, and every exemption still names one',
      fn: async () => {
        /**
         Every file the guard reads.
         */
        const files = await readPackageTexts();
        expect(files.some(function isLedger({ path, },): boolean {
          return path === 'doc/audit-ledger.md';
        },),).toBe(true,);
        expect(unexempted({ files, exemptions: PACKAGE_EXEMPTIONS, },),).toEqual([],);
        expect(staleExemptions({ files, exemptions: PACKAGE_EXEMPTIONS, },),).toEqual([],);
      },
    },),
    it({
      name: 'FINDS NO REFERENCE BY POSITION in the living repository-level docs outside the named exemptions, and '
        + 'every exemption still names one',
      fn: async () => {
        /**
         Every living repository-level doc.
         */
        const files = await readRepositoryTexts();
        expect(files.length,).toBeGreaterThan(0,);
        expect(unexempted({ files, exemptions: REPOSITORY_EXEMPTIONS, },),).toEqual([],);
        expect(staleExemptions({ files, exemptions: REPOSITORY_EXEMPTIONS, },),).toEqual([],);
      },
    },),
  ],
},);
