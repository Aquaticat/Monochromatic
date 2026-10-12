/**
 Guards the length of the package's Markdown docs and of the repository-level
 translation-repair docs (ledger M163). The owner ruled on 2026-10-12 that a
 Markdown file holds at most 1,000 lines, and up to 2,000 where the lead
 records why 1,000 is too tight. The audit ledger had grown to 41,252 lines and
 the OpenRouter pass log to 26,295, each appended to with no bound, so a reader
 or an agent could open neither whole.

 WHAT IS READ is every `.md` file in the package's `doc` folder, its README,
 and every doc under the repository's `doc` families whose name starts with
 `translation-repair` or with one of the other translation-repair stems
 listed in {@link OTHER_STEMS}. Lines are counted as `wc --lines` counts them.

 THE FIXTURES COME FIRST, so the docs case is read against a check shown able
 to find each shape (ledger M21). Fixtures are cat-themed.

 @module
 */

import {
  readdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { REPOSITORY_ROOT, } from './living-docs.test-fixture.ts';
import { expectNoFindings, } from './scan-findings.test-fixture.ts';

/**
 Most lines a doc holds unless it is allowed more.
 */
const LINE_LIMIT = 1_000;

/**
 Most lines any allowance reaches.
 */
const ALLOWED_CEILING = 2_000;

/**
 A doc allowed past {@link LINE_LIMIT}, with the lead's reason.
 */
type LineAllowance = {
  /**
   Doc's path from the repository root.
   */
  readonly path: string;

  /**
   Lines it may hold, at most {@link ALLOWED_CEILING}.
   */
  readonly lines: number;

  /**
   Why splitting it at 1,000 lines would read worse.
   */
  readonly reason: string;
};

/**
 Docs allowed past the limit; none is.
 */
const ALLOWANCES: readonly LineAllowance[] = [];

/**
 Stems of repository-level translation-repair docs whose names do not start
 with `translation-repair`.
 */
const OTHER_STEMS: readonly string[] = [
  'the-third-rendering',
  'two-lane-outcome-vocabulary',
  'wire-the-heading-aligner',
];

/**
 Repository `doc` families read.
 */
const FAMILIES: readonly string[] = [
  'audit',
  'decision',
  'handover',
  'planning',
  'runbook',
  'troubleshooting',
];

/**
 Lines in a text as `wc --lines` counts them: its line feeds, plus one for a
 last line with none.

 @param text - file's text

 @returns Line count

 @example
 ```ts
 lineCount({ text: 'nap\npurr\n', },); // 2
 ```
 */
function lineCount({ text, }: { readonly text: string; },): number {
  /**
   Line feeds in the text.
   */
  const feeds = text.split('\n',).length - 1;
  return ((text === '') || text.endsWith('\n',)) ? feeds : feeds + 1;
}

/**
 Every doc over its bound, and every allowance past the ceiling or no longer
 needed, each as one finding.

 @param counts - each doc's path and line count

 @param allowances - docs allowed past the limit

 @returns Findings, in the order of the counts and then the allowances

 @example
 ```ts
 const findings = lengthFindings({ counts: [{ path: 'doc/cat.md', lines: 1001, },], allowances: [], },);
 ```
 */
function lengthFindings(
  {
    counts,
    allowances,
  }: {
    readonly counts: readonly { readonly path: string; readonly lines: number; }[];
    readonly allowances: readonly LineAllowance[];
  },
): readonly string[] {
  /**
   Allowances by path.
   */
  const allowed = new Map(allowances.map(function byPath(allowance,): [string, LineAllowance,] {
    return [allowance.path, allowance,];
  },),);
  /**
   Lines each counted doc holds, by path.
   */
  const counted = new Map(counts.map(function byPath(count,): [string, number,] {
    return [count.path, count.lines,];
  },),);
  return [
    ...counts.flatMap(function over(count,): readonly string[] {
      /**
       Lines this doc may hold.
       */
      const bound = Math.min(allowed.get(count.path,)?.lines ?? LINE_LIMIT, ALLOWED_CEILING,);
      return (count.lines > bound)
        ? [`${count.path}: ${String(count.lines,)} lines, past its bound of ${String(bound,)}; split it at a heading`,]
        : [];
    },),
    ...allowances.flatMap(function stale(allowance,): readonly string[] {
      if (allowance.lines > ALLOWED_CEILING)
        return [`${allowance.path}: allowed ${String(allowance.lines,)} lines, past the ceiling of ${String(ALLOWED_CEILING,)}`,];
      /**
       Lines the allowed doc holds, absent when no doc read has that path.
       */
      const lines = counted.get(allowance.path,);
      if (lines === undefined)
        return [`${allowance.path}: allowed, but no doc read has that path`,];
      return (lines <= LINE_LIMIT) ? [`${allowance.path}: allowed, but holds ${String(lines,)} lines, within the limit`,] : [];
    },),
  ];
}

/**
 Every doc the guard reads, as paths from the repository root.

 @returns Paths, sorted within each folder

 @example
 ```ts
 const paths = await readGuardedDocs();
 ```
 */
async function readGuardedDocs(): Promise<readonly string[]> {
  /**
   Package root, from the repository root.
   */
  const pkg = join('package', 'module', 'translation-repair',);
  /**
   Docs in each repository family the guard reads.
   */
  const families = await Promise.all(FAMILIES.map(async function inFamily(family,): Promise<readonly string[]> {
    return (await readdir(join(REPOSITORY_ROOT, 'doc', family,),))
      .filter(function isTranslationRepair(name,): boolean {
        return name.endsWith('.md',) && (name.startsWith('translation-repair',) || OTHER_STEMS.some(function opens(stem,): boolean {
          return name.startsWith(stem,);
        },));
      },)
      .toSorted()
      .map(function underFamily(name,): string {
        return join('doc', family, name,);
      },);
  },),);
  return [
    ...families.flat(),
    ...(await readdir(join(REPOSITORY_ROOT, pkg, 'doc',),)).filter(function isMarkdown(name,): boolean {
      return name.endsWith('.md',);
    },).toSorted().map(function underDoc(name,): string {
      return join(pkg, 'doc', name,);
    },),
    join(pkg, 'README.md',),
  ];
}

await describe({
  name: 'Markdown docs past the line limit',
  children: [
    it({
      name: 'COUNTS lines as wc does: a last line without a line feed counts, an empty text holds none',
      fn: async () => {
        expect([
          lineCount({ text: '', },),
          lineCount({ text: 'nap', },),
          lineCount({ text: 'nap\n', },),
          lineCount({ text: 'nap\npurr', },),
          lineCount({ text: '\n\n', },),
        ],).toEqual([0, 1, 1, 2, 2,],);
      },
    },),
    it({
      name: 'FINDS a doc one line past the limit, one past its allowance, an allowance past the ceiling, one for a '
        + 'doc within the limit and one for no doc, and passes a doc at the limit and one within its allowance',
      fn: async () => {
        expect(lengthFindings({
          counts: [
            { path: 'doc/nap.md', lines: 1_000, },
            { path: 'doc/purr.md', lines: 1_001, },
            { path: 'doc/whisker.md', lines: 1_500, },
            { path: 'doc/tail.md', lines: 1_601, },
            { path: 'doc/paw.md', lines: 2_500, },
            { path: 'doc/bowl.md', lines: 900, },
          ],
          allowances: [
            { path: 'doc/whisker.md', lines: 1_500, reason: 'one table of naps', },
            { path: 'doc/tail.md', lines: 1_600, reason: 'one list of tails', },
            { path: 'doc/paw.md', lines: 2_500, reason: 'one long paw', },
            { path: 'doc/bowl.md', lines: 1_200, reason: 'a bowl since emptied', },
            { path: 'doc/vet.md', lines: 1_200, reason: 'a vet since moved', },
          ],
        },),).toEqual([
          'doc/purr.md: 1001 lines, past its bound of 1000; split it at a heading',
          'doc/tail.md: 1601 lines, past its bound of 1600; split it at a heading',
          'doc/paw.md: 2500 lines, past its bound of 2000; split it at a heading',
          'doc/paw.md: allowed 2500 lines, past the ceiling of 2000',
          'doc/bowl.md: allowed, but holds 900 lines, within the limit',
          'doc/vet.md: allowed, but no doc read has that path',
        ],);
      },
    },),
    it({
      name: 'FINDS NO DOC PAST ITS BOUND among the package\'s docs, its README and the repository-level '
        + 'translation-repair docs',
      fn: async () => {
        /**
         Every doc the guard reads.
         */
        const paths = await readGuardedDocs();
        expect([
          join('package', 'module', 'translation-repair', 'doc', 'audit-ledger.md',),
          join('doc', 'planning', 'translation-repair-openrouter-2026-09-03.md',),
          join('doc', 'planning', 'the-third-rendering.md',),
        ].filter(function isUnread(path,): boolean {
          return !paths.includes(path,);
        },),).toEqual([],);
        /**
         Each doc's line count.
         */
        const counts = await Promise.all(paths.map(async function counted(path,): Promise<{ readonly path: string; readonly lines: number; }> {
          return { path, lines: lineCount({ text: await readFile(join(REPOSITORY_ROOT, path,), 'utf8',), },), };
        },),);
        expectNoFindings({ findings: lengthFindings({ counts, allowances: ALLOWANCES, },), },);
      },
    },),
  ],
},);
