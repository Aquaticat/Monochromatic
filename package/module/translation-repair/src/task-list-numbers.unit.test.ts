/**
 Guards against task-list numbers used as references (ledger D22): a `#`
 followed by digits in the package's source, tests, docs, README or task
 descriptions. A task list is private to the session that kept it, the same
 number named different tasks in different sessions, and on GitHub each one
 names an unrelated issue, so a reader can recover none of them. 588 were
 found and rewritten from their own sentences; a rule written an hour before
 two of them did not stop them, so this reads every file instead.

 THE LIVING REPOSITORY-LEVEL DOCS are read too (ledger D26 and D30): the
 decision records, the canonical handover and its snapshot, the planning docs
 it links as current, and the runbooks and troubleshooting docs. There an
 owner quotation keeps its number verbatim, listed
 exactly; the archived documents are not read and keep theirs as written.

 THE WORD FORM is read too (ledger D31): a number written after "task" or
 "tasks". The sections the living docs carry from the sessions of 2026-09-10
 to 2026-09-15 keep that tracker's numbers under a note (ledger D26); each is
 listed by the headings that open and close it, and each case asserts both
 headings still stand, so a listed stretch cannot outlive its section.

 A REAL GITHUB ISSUE IS ALLOWED ONLY BY NUMBER, each checked with
 `gh issue view` before it was listed, and each case also asserts that every
 allowed number and quotation still occurs, so the lists cannot outlive their
 citations.

 THE FIXTURES COME FIRST, so the package-wide case is read against a scan
 shown able to find each shape (ledger M21). Fixtures are cat-themed and spell
 the sign through a constant, so this file carries no citation of its own.

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

import {
  isAsciiAlphanumeric,
  isAsciiDigit,
} from '../dist/final/node/index.mjs';
import {
  readLivingRepositoryDocs,
  REPOSITORY_ROOT,
} from './living-docs.test-fixture.ts';
import { readPackageSource, } from './source-scan.test-fixture.ts';

/**
 The sign a citation opens with, kept out of this file's own text.
 */
const HASH = String.fromCodePoint(0x23,);

/**
 Most digits the census counted as one citation; a longer run is some other
 number.
 */
const MAX_DIGITS = 4;

/**
 GitHub issue `module-logger` owns for logs every test run leaves under
 `node_modules` (ledger T9), checked with `gh issue view` on 2026-09-28.
 */
const LOGGER_LOG_ISSUE = 576;

/**
 GitHub issue that owns enforcing TypeScript indentation (ledger X9), checked
 with `gh issue view` on 2026-09-28.
 */
const INDENTATION_CHECK_ISSUE = 577;

/**
 GitHub issue asking for a check that reports unused imports (ledger B16),
 checked with `gh issue view` on 2026-09-29.
 */
const UNUSED_IMPORT_CHECK_ISSUE = 578;

/**
 GitHub issue asking the guardrail hook to deny Bash calls that break the
 repository's shell rule (ledger M1), checked with `gh issue view` on
 2026-09-29.
 */
const SHELL_RULE_HOOK_ISSUE = 579;

/**
 Real GitHub issues the package may cite by number.
 */
const GITHUB_ISSUES: ReadonlySet<number> = new Set([
  LOGGER_LOG_ISSUE,
  INDENTATION_CHECK_ISSUE,
  UNUSED_IMPORT_CHECK_ISSUE,
  SHELL_RULE_HOOK_ISSUE,
],);

/**
 GitHub issue raised against `cli-markdown-lint`'s semantic-line-breaks rule,
 which the OpenRouter pass log cites, checked with `gh issue view` on
 2026-09-29.
 */
const LINE_BREAK_RULE_ISSUE = 556;

/**
 GitHub issue on persisted definition-order member loss, which the
 root-order serialization troubleshooting doc links, checked with
 `gh issue view` on 2026-09-29.
 */
const DEFINITION_ORDER_ISSUE = 541;

/**
 Real GitHub issues the living repository-level docs may cite by number.
 */
const REPOSITORY_GITHUB_ISSUES: ReadonlySet<number> = new Set([
  DEFINITION_ORDER_ISSUE,
  LINE_BREAK_RULE_ISSUE,
],);

/**
 Owner quotations the living repository-level docs keep verbatim, number and
 all (ledger D26), each checked against the transcript or the decision sheet's
 history: the answer of 2026-09-19 choosing option 1, the two decision-sheet
 answers of 2026-08-16, and the answer of 2026-09-26 naming a real issue.
 */
const OWNER_QUOTATIONS: readonly string[] = [
  `"Do ${HASH}1"`,
  `"do \`${HASH}84\` first"`,
  `"land \`${HASH}83\`"`,
  `"${HASH}563 is fixed in main branch`,
];

/**
 The word a task-list number follows when written out, kept out of this file's
 own text beside a number.
 */
const TASK_WORD = 'task';

/**
 One stretch of a living doc that keeps another session's tracker numbers as
 written: from the line of one heading up to the line of the next heading
 outside it.
 */
type KeptRange = {
  /**
   Doc's path from the repository root.
   */
  readonly path: string;

  /**
   Heading line that opens the stretch, exactly as written.
   */
  readonly from: string;

  /**
   Heading line that closes it, exactly as written.
   */
  readonly to: string;
};

/**
 The sections the living docs carry from the sessions of 2026-09-10 to
 2026-09-15, each under a note saying whose numbering it keeps (ledger D26).
 */
const TAKEOVER_RANGES: readonly KeptRange[] = [
  {
    path: join('doc', 'handover', 'translation-repair-handover-2026-09-06.md',),
    from: '### Latest checkpoint: V4.1 judge admission on 2026-09-11',
    to: '## Repository state',
  },
  {
    path: join('doc', 'planning', 'translation-repair-readiness-signal.md',),
    from: '## Archive correction has current-stage evidence; audit and temporal context remain (2026-09-10)',
    to: '## Naming has current-stage evidence; archive and context work remains (2026-09-10)',
  },
  {
    path: join('doc', 'planning', 'translation-repair-openrouter-2026-09-03.md',),
    from: '## Clustered panels and complete repair evidence implemented, 2026-09-10',
    to: '## Naming scope reaches a bounded production stage, 2026-09-10',
  },
];

/**
 One file the guard reads, named from the package root.
 */
type PackageText = {
  /**
   Path from the package root, which names locations.
   */
  readonly path: string;

  /**
   File text.
   */
  readonly text: string;
};

/**
 Whether a character stands inside an identifier or a word the census would
 join a citation to.

 @param character - one character, empty at a text's edge

 @returns Whether it continues a word

 @example
 ```ts
 continuesWord({ character: '_', },); // true
 ```
 */
function continuesWord({ character, }: { readonly character: string; },): boolean {
  return isAsciiAlphanumeric({ character, },) || (character === '_');
}

/**
 How many ASCII digits a text opens with.

 @param text - text read from its start

 @returns Count of leading digits, zero when it opens with none

 @example
 ```ts
 leadingDigitCount({ text: '12 naps', },); // 2
 ```
 */
function leadingDigitCount({ text, }: { readonly text: string; },): number {
  /**
   Digits read so far, which is also the index of the next character.
   */
  let count = 0;
  while ((count < text.length) && isAsciiDigit({ character: text.charAt(count,), },))
    count += 1;
  return count;
}

/**
 Every citation-shaped number in one line: a `#` that no `&`, `/` or word
 character precedes, then one to four digits that no word character continues.

 @param text - one line

 @returns Numbers cited, in order

 @example
 ```ts
 taskNumbers({ text: 'nap', },); // []
 ```
 */
function taskNumbers({ text, }: { readonly text: string; },): readonly number[] {
  /**
   Text between the signs, one more piece than there are signs.
   */
  const pieces = text.split(HASH,);
  return pieces
    .slice(1,)
    .flatMap(function cited(after, at,): readonly number[] {
      /**
       Character just before this sign.
       */
      const before = (pieces[at] ?? '').slice(-1,);
      if ((before === '&') || (before === '/') || continuesWord({ character: before, },))
        return [];
      /**
       How many digits the sign opens.
       */
      const length = leadingDigitCount({ text: after, },);
      if ((length === 0) || (length > MAX_DIGITS) || continuesWord({ character: after.charAt(length,), },))
        return [];
      return [Number(after.slice(0, length,),),];
    },);
}

/**
 Every citation in a set of files, each as `path:line number`, less those a
 listed quotation on the same line carries: one occurrence per quotation, so
 the same number cited again beside a quotation is still found.

 @param files - files read

 @param quotations - verbatim quotations whose numbers quote rather than cite

 @returns Citations in file and line order

 @example
 ```ts
 const found = citations({ files, quotations: [], },);
 ```
 */
function citations({ files, quotations, }: {
  readonly files: readonly PackageText[];
  readonly quotations: readonly string[];
},): readonly string[] {
  return files.flatMap(function inFile(file,): readonly string[] {
    return file.text
      .split('\n',)
      .flatMap(function inLine(line, index,): readonly string[] {
        /**
         Numbers the quotations on this line carry.
         */
        const quoted = quotations
          .filter(function isOnLine(quotation,): boolean {
            return line.includes(quotation,);
          },)
          .flatMap(function carried(quotation,): readonly number[] {
            return taskNumbers({ text: quotation, },);
          },);
        return quoted
          .reduce(function withoutOne(left: readonly number[], number,): readonly number[] {
            /**
             First occurrence the quotation accounts for.
             */
            const at = left.indexOf(number,);
            return (at === (-1)) ? left : [...left.slice(0, at,), ...left.slice(at + 1,),];
          }, taskNumbers({ text: line, },),)
          .map(function located(number,): string {
            return `${file.path}:${String(index + 1,)} ${String(number,)}`;
          },);
      },);
  },);
}

/**
 Every number one line writes after the word "task" or "tasks", in any case:
 the word standing alone, then spaces, then one to four digits that no word
 character continues.

 @param text - one line

 @returns Numbers cited, in order

 @example
 ```ts
 wordNumbers({ text: 'nap', },); // []
 ```
 */
function wordNumbers({ text, }: { readonly text: string; },): readonly number[] {
  /**
   Text between the words, one more piece than there are words.
   */
  const pieces = text.toLowerCase().split(TASK_WORD,);
  return pieces
    .slice(1,)
    .flatMap(function cited(after, at,): readonly number[] {
      if (continuesWord({ character: (pieces[at] ?? '').slice(-1,), },))
        return [];
      /**
       Text past a plural's `s`.
       */
      const spaced = after.startsWith('s',) ? after.slice(1,) : after;
      /**
       Text past the spaces, where the number would open.
       */
      const rest = spaced.trimStart();
      if (rest.length === spaced.length)
        return [];
      /**
       How many digits open it.
       */
      const length = leadingDigitCount({ text: rest, },);
      if ((length === 0) || (length > MAX_DIGITS) || continuesWord({ character: rest.charAt(length,), },))
        return [];
      return [Number(rest.slice(0, length,),),];
    },);
}

/**
 Zero-based indices of the lines a file keeps as another session's record.

 @param file - file read

 @param ranges - kept stretches, of this file or any other

 @returns Line indices inside a stretch of this file

 @example
 ```ts
 const kept = keptLines({ file, ranges: TAKEOVER_RANGES, },);
 ```
 */
function keptLines(
  {
    file,
    ranges,
  }: {
    readonly file: PackageText;
    readonly ranges: readonly KeptRange[];
  },
): ReadonlySet<number> {
  /**
   The file's lines.
   */
  const lines = file.text.split('\n',);
  return new Set(ranges
    .filter(function isOfFile({ path, },): boolean {
      return path === file.path;
    },)
    .flatMap(function lineIndices({ from, to, },): readonly number[] {
      /**
       Line that opens the stretch.
       */
      const start = lines.indexOf(from,);
      /**
       Line that closes it, after the opening one.
       */
      const end = lines.indexOf(to, start + 1,);
      if ((start === (-1)) || (end === (-1)))
        return [];
      return Array.from(lines.slice(start, end,).keys(), function located(step,): number {
        return start + step;
      },);
    },),);
}

/**
 Every number written after "task" in a set of files, each as
 `path:line number`, less those inside a kept stretch.

 @param files - files read

 @param ranges - stretches that keep another session's numbers

 @returns Citations in file and line order

 @example
 ```ts
 const found = wordCitations({ files, ranges: [], },);
 ```
 */
function wordCitations(
  {
    files,
    ranges,
  }: {
    readonly files: readonly PackageText[];
    readonly ranges: readonly KeptRange[];
  },
): readonly string[] {
  return files.flatMap(function inFile(file,): readonly string[] {
    /**
     Lines this file keeps as written.
     */
    const kept = keptLines({ file, ranges, },);
    return file.text
      .split('\n',)
      .flatMap(function inLine(line, index,): readonly string[] {
        if (kept.has(index,))
          return [];
        return wordNumbers({ text: line, },).map(function located(number,): string {
          return `${file.path}:${String(index + 1,)} ${String(number,)}`;
        },);
      },);
  },);
}

/**
 The number a located citation carries.

 @param citation - `path:line number`

 @returns Number cited

 @example
 ```ts
 citedNumber({ citation: 'cat.md:1 12', },); // 12
 ```
 */
function citedNumber({ citation, }: { readonly citation: string; },): number {
  return Number(citation.slice(citation.lastIndexOf(' ',) + 1,),);
}

/**
 Orders two numbers from smallest.

 @param left - one number

 @param right - the other

 @returns Negative when `left` comes first

 @example
 ```ts
 [577, 576,].toSorted(ascending,); // [576, 577]
 ```
 */
function ascending(left: number, right: number,): number {
  return left - right;
}

/**
 Every file the guard reads: the package's TypeScript under `src`, its docs,
 its README and its task file.

 @returns Files with their text

 @example
 ```ts
 const files = await readPackageTexts();
 ```
 */
async function readPackageTexts(): Promise<readonly PackageText[]> {
  /**
   Package root, which holds `src`.
   */
  const root = join(import.meta.dirname, '..',);
  /**
   Markdown files under `doc`.
   */
  const docs = (await readdir(join(root, 'doc',),))
    .filter(function isMarkdown(name,): boolean {
      return name.endsWith('.md',);
    },)
    .map(function underDoc(name,): string {
      return join('doc', name,);
    },);
  /**
   Non-source files, read from the package root.
   */
  const others = await Promise.all([...docs, 'README.md', 'mise.toml',].map(async function read(
    path,
  ): Promise<PackageText> {
    return {
      path,
      text: await readFile(join(root, path,), 'utf8',),
    };
  },),);
  /**
   Source and test files, named from the package root.
   */
  const source = (await readPackageSource()).map(function fromRoot(file,): PackageText {
    return {
      path: join('src', file.path,),
      text: file.text,
    };
  },);
  return [...source, ...others,];
}

/**
 Every living repository-level doc: the translation-repair decision records,
 the canonical handover and its snapshot, and the planning docs it links as
 current.

 @returns Files with their text, named from the repository root

 @example
 ```ts
 const files = await readRepositoryTexts();
 ```
 */
async function readRepositoryTexts(): Promise<readonly PackageText[]> {
  /**
   Living repository-level docs.
   */
  const { decisionRecords, handover, currentPlanning, operations, } = await readLivingRepositoryDocs();
  return Promise.all([...decisionRecords, ...handover, ...currentPlanning, ...operations,].map(async function read(
    path,
  ): Promise<PackageText> {
    return {
      path,
      text: await readFile(join(REPOSITORY_ROOT, path,), 'utf8',),
    };
  },),);
}

await describe({
  name: 'task-list numbers used as references',
  children: [
    it({
      name: 'FINDS a number after a sign in prose, in parentheses and at a line start, and leaves an entity, '
        + 'a fragment, a sign inside a word, a run longer than four digits, a hex colour and a heading',
      fn: async () => {
        expect(taskNumbers({ text: `whiskers napped (${HASH}12) after ${HASH}7 meals`, },),).toEqual([12, 7,],);
        expect(taskNumbers({ text: `${HASH}9 tabbies`, },),).toEqual([9,],);
        expect(taskNumbers({ text: `&${HASH}123; is an entity`, },),).toEqual([],);
        expect(taskNumbers({ text: `the bowl page /${HASH}45`, },),).toEqual([],);
        expect(taskNumbers({ text: `tabby${HASH}3 and paw_${HASH}4`, },),).toEqual([],);
        expect(taskNumbers({ text: `${HASH}12345 kibbles`, },),).toEqual([],);
        expect(taskNumbers({ text: `a ${HASH}1a2b3c collar`, },),).toEqual([],);
        expect(taskNumbers({ text: `${HASH}${HASH} Naps`, },),).toEqual([],);
      },
    },),
    it({
      name: 'FINDS a number written after the word, singular or plural in any case, and leaves the word joined to '
        + 'a hyphen, inside a longer word, joined to its digits, before a longer run or before a sign',
      fn: async () => {
        expect(wordNumbers({
          text: `the ${TASK_WORD} 12 nap, ${TASK_WORD.toUpperCase()}S  7 and ${TASK_WORD}s 8 treats`,
        },),).toEqual([12, 7, 8,],);
        expect(wordNumbers({
          text: `${TASK_WORD}-list 3, sub${TASK_WORD} 4, ${TASK_WORD}12, ${TASK_WORD} 12345 and ${TASK_WORD} ${HASH}5`,
        },),).toEqual([],);
      },
    },),
    it({
      name: 'LOCATES each written-out number by path and line, and skips a kept stretch between its two headings',
      fn: async () => {
        expect(wordCitations({
          files: [
            {
              path: 'doc/cat.md',
              text: [
                `${TASK_WORD} 1 naps`,
                '## Kept',
                `${TASK_WORD} 2 naps`,
                '## After',
                `${TASK_WORD} 3 naps`,
              ].join('\n',),
            },
          ],
          ranges: [{ path: 'doc/cat.md', from: '## Kept', to: '## After', },],
        },),).toEqual(['doc/cat.md:1 1', 'doc/cat.md:5 3',],);
      },
    },),
    it({
      name: 'LOCATES each citation by path and line, and allows only the listed GitHub issues',
      fn: async () => {
        /**
         Citations in two fixture files, one allowed and two not.
         */
        const found = citations({
          files: [
            {
              path: 'doc/cat.md',
              text: `Naps:\nsee issue ${HASH}${String(LOGGER_LOG_ISSUE,)} and ${HASH}412`,
            },
            {
              path: 'src/bowl.ts',
              text: `// refilled for ${HASH}31`,
            },
          ],
          quotations: [],
        },);
        expect(found,).toEqual([
          `doc/cat.md:2 ${String(LOGGER_LOG_ISSUE,)}`,
          'doc/cat.md:2 412',
          'src/bowl.ts:1 31',
        ],);
        expect(found.filter(function isNotAllowed(citation,): boolean {
          return !GITHUB_ISSUES.has(citedNumber({ citation, },),);
        },),).toEqual(['doc/cat.md:2 412', 'src/bowl.ts:1 31',],);
      },
    },),
    it({
      name: 'FINDS NO TASK-LIST NUMBER across the package\'s source, tests, docs, README and task file, '
        + 'and every allowed GitHub issue is still cited somewhere',
      fn: async () => {
        /**
         Every file the guard reads.
         */
        const files = await readPackageTexts();
        expect(files.some(function isLedger({ path, },): boolean {
          return path === join('doc', 'audit-ledger.md',);
        },),).toBe(true,);
        expect(files.some(function isSource({ path, },): boolean {
          return path.startsWith('src',) && path.endsWith('.ts',);
        },),).toBe(true,);
        /**
         Every citation found.
         */
        const found = citations({ files, quotations: [], },);
        expect(found.filter(function isNotAllowed(citation,): boolean {
          return !GITHUB_ISSUES.has(citedNumber({ citation, },),);
        },),).toEqual([],);
        expect([...new Set(found.map(function numberOf(citation,): number {
          return citedNumber({ citation, },);
        },),),].toSorted(ascending,),).toEqual([...GITHUB_ISSUES,].toSorted(ascending,),);
        expect(wordCitations({ files, ranges: [], },),).toEqual([],);
      },
    },),
    it({
      name: 'SKIPS a number a listed quotation on its line carries, and finds the same number cited again beside it',
      fn: async () => {
        expect(citations({
          files: [
            {
              path: 'doc/cat.md',
              text: `The owner said "Feed ${HASH}2" and ${HASH}2 was fed\nthen "Feed ${HASH}2" alone`,
            },
          ],
          quotations: [`"Feed ${HASH}2"`,],
        },),).toEqual(['doc/cat.md:1 2',],);
      },
    },),
    it({
      name: 'FINDS NO TASK-LIST NUMBER in the living repository-level docs outside the owner\'s quotations, '
        + 'and every listed quotation and GitHub issue is still there',
      fn: async () => {
        /**
         Every living repository-level doc.
         */
        const files = await readRepositoryTexts();
        expect([
          'doc/decision/',
          'doc/handover/',
          'doc/planning/',
          'doc/runbook/',
          'doc/troubleshooting/',
        ].filter(function isUnread(kind,): boolean {
          return !files.some(function isOfKind({ path, },): boolean {
            return path.startsWith(kind,);
          },);
        },),).toEqual([],);
        /**
         Every citation outside the quotations.
         */
        const found = citations({ files, quotations: OWNER_QUOTATIONS, },);
        expect(found.filter(function isNotAllowed(citation,): boolean {
          return !REPOSITORY_GITHUB_ISSUES.has(citedNumber({ citation, },),);
        },),).toEqual([],);
        expect([...new Set(found.map(function numberOf(citation,): number {
          return citedNumber({ citation, },);
        },),),].toSorted(ascending,),).toEqual([...REPOSITORY_GITHUB_ISSUES,].toSorted(ascending,),);
        expect(OWNER_QUOTATIONS.filter(function isGone(quotation,): boolean {
          return !files.some(function holds({ text, },): boolean {
            return text.includes(quotation,);
          },);
        },),).toEqual([],);
        expect(TAKEOVER_RANGES.filter(function isGone(range,): boolean {
          /**
           The file the stretch belongs to, when it is read.
           */
          const file = files.find(function isOfRange({ path, },): boolean {
            return path === range.path;
          },);
          return (file === undefined) || (keptLines({ file, ranges: [range,], },).size === 0);
        },),).toEqual([],);
        expect(wordCitations({ files, ranges: TAKEOVER_RANGES, },),).toEqual([],);
      },
    },),
  ],
},);
