/**
 Guards against a count printed before a fixed plural (ledger B98): a report
 line wrote `${String(count,)} slices` and printed "1 slices", and a test
 pinned one such line as correct. The package chooses the noun a count takes
 with `wordForCount` (`count-word.ts`).

 WHAT THE SCAN READS, in the package's source (tests and their fixtures are
 left out): every template literal where a `String(...)` interpolation is
 followed, after one space, by a word the package already counts, that is
 the `many` form of some `wordForCount` call in the source, so the noun list
 grows as nouns are counted; a word followed by `=` is a log field's name and
 is passed over. Reads are keyed `path#site: word`, where the
 site is the nearest enclosing named function. Out of the scan's reach: a
 noun after another interpolation or after an adjective ("3 source chars"),
 a noun split from its count across a `+` between two literals, and a noun
 no `wordForCount` call names yet. The listed exemptions are counts that
 cannot be one, and verbs after an index ("slice 3 claims").

 THE FIXTURE CASE COMES FIRST, so the package-wide case is read against a
 scan shown able to find each form (ledger M21). Fixtures are cat-themed; the
 package case reads this package's own source.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  isAsciiAlphanumeric,
  isAsciiLetter,
} from '../dist/final/node/index.mjs';
import {
  childNodes,
  identifierName,
  isTreeNode,
  nodesUnder,
  parseSource,
  readPackageSource,
  type SourceText,
  type TreeNode,
  unwrapped,
} from './source-scan.test-fixture.ts';

//region Count nouns
// The scan itself: which nouns the package counts, and which template
// literals print one after a bare count.

/**
 Node kinds that open a function, which names the site of the reads inside.
 */
const FUNCTION_KINDS: ReadonlySet<string> = new Set([
  'ArrowFunctionExpression',
  'FunctionDeclaration',
  'FunctionExpression',
],);

/**
 Counts printed before a fixed plural that cannot be one, keyed
 `path#site: word`, each with why.
 */
const EXEMPT_COUNTS: ReadonlyMap<string, string> = new Map([
  [
    'assembly-contract-fault.ts#assemblySentence: claims',
    'a verb after a slice index',
  ],
  [
    'candidate-select.ts#decideBestCandidate: ballots',
    'MIN_SELECTION_BALLOTS, a constant above one',
  ],
  [
    'corpus-run/artifact-two-lane-verify.ts#assertLedgerDescribesPreparation: calls',
    'a verb after a slice index',
  ],
  [
    'corpus-run/command-line.ts#repeatRefusal: times',
    'only flags written more than once are listed',
  ],
  [
    'corpus-run/coverage-probe-args.ts#readCoverageProbeArguments: candidates',
    'DEFAULT_CANDIDATE_CAP, a constant above one',
  ],
  [
    'corpus-run/window-trial-slice.ts#runSliceArms: arms',
    'the length of TRIAL_ARM_SET, a constant above one',
  ],
  [
    'count-word.ts#howOften: times',
    'the form for every count but one',
  ],
  [
    'pair-media-adjacency.ts#toFinding: claims',
    'a verb after a section index',
  ],
  [
    'prepare-block-pairing.ts#prepareBlockPairing: pairs',
    'a verb after a section index',
  ],
  [
    'span-contiguity.ts#assertSpanContiguity: cuts',
    'a verb after a slice index',
  ],
  [
    'span-contiguity.ts#assertSpanContiguity: spans',
    'a verb after a slice index',
  ],
],);

/**
 The text a string literal node holds.

 @param node - node read

 @returns Its text, empty for any other node
 */
function literalText({ node, }: { readonly node: unknown; },): string {
  /**
   The node inside any parentheses.
   */
  const { inner, } = unwrapped({ node, },);
  return (isTreeNode(inner,) && (inner.type === 'Literal') && ((typeof inner.value) === 'string'))
    ? inner.value
    : '';
}

/**
 Whether a node calls a function by name.

 @param node - node read

 @param name - function name

 @returns Whether it is such a call, parentheses aside
 */
function callsNamed(
  {
    node,
    name,
  }: {
    readonly node: unknown;
    readonly name: string;
  },
): boolean {
  /**
   The node inside any parentheses.
   */
  const { inner, } = unwrapped({ node, },);
  return isTreeNode(inner,) && (inner.type === 'CallExpression')
    && (identifierName({ node: inner.callee, },) === name);
}

/**
 Every `many` form the source's `wordForCount` calls name.

 @param files - files read; tests among them are passed over

 @returns The plural forms
 */
function countedNouns({ files, }: { readonly files: readonly SourceText[]; },): ReadonlySet<string> {
  /**
   Forms found so far.
   */
  const found = new Set<string>();
  for (const file of files) {
    if (file.isTest)
      continue;
    for (const node of nodesUnder({ root: parseSource({ file, },).program, },)) {
      if ((node.type !== 'Property') || (identifierName({ node: node.key, },) !== 'many'))
        continue;
      /**
       The form, where the value is a plain string.
       */
      const form = literalText({ node: node.value, },);
      if (form !== '')
        found.add(form,);
    }
  }
  return found;
}

/**
 Where a word starting at the second character ends: the first character
 past it that is neither an ASCII letter nor a hyphen. Read by UTF-16 unit,
 since only ASCII is tested and a surrogate half is never ASCII.

 @param text - text whose first character is the space before the word

 @returns The index just past the word
 */
function wordEnd({ text, }: { readonly text: string; },): number {
  for (let index = 1; index < text.length; index += 1) {
    /**
     The character read.
     */
    const character = text.charAt(index,);
    if (!(isAsciiLetter({ character, },) || (character === '-')))
      return index;
  }
  return text.length;
}

/**
 The word a template literal prints after its interpolation at a position,
 where a single space separates them.

 @param template - template literal

 @param index - interpolation's position among the template's expressions

 @returns The word, empty where none follows directly
 */
function wordAfter(
  {
    template,
    index,
  }: {
    readonly template: TreeNode;
    readonly index: number;
  },
): string {
  /**
   The template's literal stretches.
   */
  const quasis = Array.isArray(template.quasis,) ? template.quasis : [];
  /**
   The stretch after the interpolation.
   */
  const after: unknown = quasis[index + 1];
  if (!isTreeNode(after,))
    return '';
  /**
   Its text as the template writes it.
   */
  const { value, } = after;
  /**
   The raw text.
   */
  const raw = ((typeof value) === 'object') && (value !== null) && ('raw' in value) ? String(value.raw,) : '';
  if (!raw.startsWith(' ',))
    return '';
  /**
   Where the word after the space ends.
   */
  const end = wordEnd({ text: raw, },);
  /**
   What follows the word: a digit, an underscore or `=` makes it part of a
   name or a log field's name rather than a noun.
   */
  const next = raw.charAt(end,);
  return (isAsciiAlphanumeric({ character: next, },) || (next === '_') || (next === '='))
    ? ''
    : raw.slice(
      1,
      end,
    );
}

/**
 Every count printed before a word the package counts with `wordForCount`,
 keyed `path#site: word`, one entry per count.

 @param files - files read; tests among them are passed over

 @param nouns - plural forms to look for

 @returns Keys sorted, repeated once per count
 */
function fixedPlurals(
  {
    files,
    nouns,
  }: {
    readonly files: readonly SourceText[];
    readonly nouns: ReadonlySet<string>;
  },
): readonly string[] {
  /**
   Keys found so far.
   */
  const found: string[] = [];
  for (const file of files) {
    if (file.isTest)
      continue;
    /**
     Nodes still to visit, each with its enclosing named function.
     */
    const pending: {
      readonly node: TreeNode;
      readonly site: string;
    }[] = [{
      node: parseSource({ file, },).program,
      site: '<module>',
    },];
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      /**
       Node visited now, and the site it sits in.
       */
      const {
        node,
        site,
      } = next;
      /**
       Enclosing named function for the node and its children.
       */
      const here = (FUNCTION_KINDS.has(node.type,) && isTreeNode(node.id,))
        ? identifierName({ node: node.id, },)
        : site;
      if (node.type === 'TemplateLiteral') {
        /**
         The template's interpolations.
         */
        const expressions = Array.isArray(node.expressions,) ? node.expressions : [];
        expressions.forEach(function readCount(expression: unknown, index: number,) {
          if (!callsNamed({
            node: expression,
            name: 'String',
          },))
            return;
          /**
           The word printed after it.
           */
          const word = wordAfter({
            template: node,
            index,
          },);
          if (nouns.has(word,))
            found.push(`${file.path}#${here}: ${word}`,);
        },);
      }
      pending.push(...childNodes({ node, },).map(function withSite(child,) {
        return {
          node: child,
          site: here,
        };
      },),);
    }
  }
  return found.toSorted();
}

//endregion Count nouns

/**
 A source file for the fixture case.

 @param path - file name

 @param text - file text

 @param isTest - whether it stands for a test

 @returns Source file

 @example
 ```ts
 const file = fixture({ path: 'cat.ts', text: 'export const nap = 1;', isTest: false, },);
 ```
 */
function fixture(
  {
    path,
    text,
    isTest,
  }: {
    readonly path: string;
    readonly text: string;
    readonly isTest: boolean;
  },
): SourceText {
  return {
    path,
    text,
    isTest,
  };
}

await describe({
  name: 'count nouns (ledger B98)',
  children: [
    it({
      name: 'FINDS a String interpolation followed by a noun some wordForCount call counts, in a function or at '
        + 'module level, and leaves other nouns, a noun after other text and tests',
      fn: async () => {
        /**
         A file counting naps once and printing them twice with a fixed plural.
         */
        const litter = fixture({
          path: 'litter.ts',
          text: [
            'export function naps(count: number,): string {',
            `  return \`\${String(count,)} naps, \${String(count,)} \${wordForCount({ count, one: 'nap', many: 'naps', },)}\`;`,
            '}',
            `export const purrs = \`\${String(2,)} naps and \${String(3,)} purrs, deep naps \${String(4,)} naps=\${String(5,)}\`;`,
          ].join('\n',),
          isTest: false,
        },);
        /**
         A test printing the same plural.
         */
        const catnip = fixture({
          path: 'catnip.unit.test.ts',
          text: `export const line = \`\${String(1,)} naps\`;`,
          isTest: true,
        },);
        /**
         The nouns the files count.
         */
        const nouns = countedNouns({
          files: [
            litter,
            catnip,
          ],
        },);
        expect([...nouns,],).toEqual(['naps',],);
        expect(fixedPlurals({
          files: [
            litter,
            catnip,
          ],
          nouns,
        },),).toEqual([
          'litter.ts#<module>: naps',
          'litter.ts#naps: naps',
        ],);
      },
    },),
    it({
      name: 'PRINTS NO BARE COUNT BEFORE A FIXED PLURAL the package counts elsewhere, outside the named exemptions, '
        + 'and every exemption still names one',
      fn: async () => {
        /**
         Every package file, tests among them.
         */
        const files = await readPackageSource();
        /**
         The nouns the package counts.
         */
        const nouns = countedNouns({ files, },);
        expect(nouns.has('slices',),).toBe(true,);
        /**
         Every bare count before one of them.
         */
        const plurals = fixedPlurals({
          files,
          nouns,
        },);
        expect(plurals.filter(function unexempt(key,): boolean {
          return !EXEMPT_COUNTS.has(key,);
        },),).toEqual([],);
        expect([...EXEMPT_COUNTS.keys(),].filter(function stale(key,): boolean {
          return !plurals.includes(key,);
        },),).toEqual([],);
      },
    },),
  ],
},);
