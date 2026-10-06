/**
 Tests that the bench draw REFUSES a corpus it found no slice in.

 WHY REFUSE RATHER THAN RETURN NOTHING. The bench exists to compare roster
 widths on the same slices. Handed an empty sample it would run every width
 over no work, find no difference between them, and print that as a result;
 the widths would be reported indistinguishable on evidence that never
 existed. A width question was settled on 231 rounds, and a silent empty
 draw is exactly how that kind of answer goes wrong.

 WHAT WAS MEASURED. On 2026-08-25, inverting this guard so a corpus that DID
 yield slices is the one refused failed no test in this package.

 READ AGAINST A THROWAWAY CLONE, never the pinned one. The draw now takes its
 pin as a defaulted parameter, exactly as `censusEntry` already does and for
 the reason stated there: passed rather than read so it is testable against a
 throwaway clone instead of the unlicensed one. Each case here builds a git
 repository in a temporary directory, commits into it, and reads it back at
 that commit.

 THE SKIP LINE SAYS WHICH PAGE AND WHY. An entry that cannot be cut into
 slices is skipped with a line naming the entry, the page, the step that
 failed on it (its read or its parse) and the failure, in the words the
 refusal's class marks safe to print (`refusalText`), never a fixed-length
 opening of the refusal, whose cut fell inside the commit hash before the page
 was named. A failure aligning the pair or cutting it into slices names no
 one page, and its line says so; no case builds one, since no input is known
 to reach it (`PAIR_STEP_FAILED` in `bench-sample.ts` says what was measured).
 The lines of one draw print in the order the corpus lists the entries, and
 of an entry's two pages the original is the one named where both fail,
 whichever ended first and whether it failed its read or its parse; the cases
 that say so hand the draw a scripted reader that chooses which refusal ends
 first, or one page that cannot be read beside one that cannot be parsed.

 THE SECOND CASE IS THE CONTROL, and it does two jobs: it separates a guard
 that reads its input from one that refuses everything, and it proves the pin
 is actually threaded, since a draw still reading the run pin would come back
 with the real corpus rather than with one invented cat.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import { fileURLToPath, } from 'node:url';
import { resolveRealGit as resolveGit, } from '@monochromatic-dev/git-executable/ts';
import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  CorpusReadError,
  type CorpusPin,
  sampleBenchSlices,
  type readCorpusFile,
  sliceListedEntries,
  StatedRefusalError,
} from '../../dist/final/node/index.mjs';
import { runKeyless, } from '../child-environment.test-fixture.ts';
import { divertingConsoleLog, } from './console-log-capture.test-fixture.ts';
import { pageReadsRefusingLastFor, } from './ordered-page-reads.test-fixture.ts';
import { rejectionOf, } from '../rejecting-call.test-fixture.ts';
import { scratchDirWith, } from '../scratch-dir.test-fixture.ts';

//region Fixtures

/**
 Entry the control clone holds.
 */
const ENTRY_ID = 'mittens';

/**
 Entry carrying an original and no translation, which is what the corpus looks
 like where nobody has written the English side yet.
 */
const HALF_ENTRY_ID = 'whiskers';

/**
 Original page of that entry.
 */
const SOURCE_PAGE = '## 窗台\n\n小猫在窗台上打盹。它的尾巴垂在地板上。\n';

/**
 English page of that entry, one section against one.
 */
const TARGET_PAGE = '## The windowsill\n\nThe kitten dozes on the windowsill. '
  + 'Its tail hangs to the floor.\n';

/**
 Runs git in a directory and refuses if it did not succeed.

 @param cwd - directory to run in

 @param args - arguments after the binary

 @returns Standard output, trimmed

 @throws Error naming the arguments when git exits non-zero

 @example
 ```ts
 const sha = await git({ cwd, args: ['rev-parse', 'HEAD',], },);
 ```
 */
async function git(
  {
    cwd,
    args,
  }: {
    readonly cwd: string;
    readonly args: readonly string[];
  },
): Promise<string> {
  /**
   What git did, with its output captured rather than printed.
   */
  const done = await runKeyless({
    file: 'git',
    args,
    cwd,
  },);

  if (done.code !== 0)
    throw new Error(`git ${args.join(' ',)} exited ${String(done.code,)}: ${done.stderr}`,);

  return done.stdout
    .trim();
}

/**
 Builds a throwaway git repository holding the named files, and pins it at the
 one commit it carries.

 @param files - repository-relative paths mapped to their whole contents

 @returns Pin naming that clone and that commit, removed when its
 `await using` scope ends

 @example
 ```ts
 await using pin = await clonedCorpusHolding({ files: { 'README.md': 'nothing', }, },);
 ```
 */
async function clonedCorpusHolding(
  { files, }: { readonly files: Readonly<Record<string, string>>; },
): Promise<CorpusPin & AsyncDisposable> {
  // Throwaway clone standing in for the corpus; `scratchDirWith` removes it if
  // any step of the clone, the writes or the commit throws.
  return await scratchDirWith({
    prefix: 'translation-repair-bench-corpus-',
    setup: async function seeded({ path: cloneDir, },): Promise<{
      readonly cloneDir: string;
      readonly commitSha: string;
    }> {
      await git({
        cwd: cloneDir,
        args: [
          'init',
          '--quiet',
          '--initial-branch',
          'main',
        ],
      },);

      await Promise.all(Object.entries(files,)
        .map(async function writeOne([relPath, text,],): Promise<void> {
          /**
           Whole path of this file inside the clone.
           */
          const path = join(
            cloneDir,
            relPath,
          );

          await mkdir(
            dirname(path,),
            { recursive: true, },
          );
          await writeFile(
            path,
            text,
            'utf8',
          );
        },),);

      /**
       Every path this fixture wrote, named explicitly.

       NAMED RATHER THAN STAGED IN BULK, because the repository's own git
       guard rejects `--all` and pathspec-less commits, and it guards a
       throwaway clone exactly as it guards the real one. Naming them is
       what the guard asks for and is cheap here, since this helper wrote
       them.
       */
      const paths = Object.keys(files,);

      await git({
        cwd: cloneDir,
        args: [
          'add',
          '--',
          ...paths,
        ],
      },);
      await git({
        cwd: cloneDir,
        args: [
          '-c',
          'user.name=Bench Fixture',
          '-c',
          'user.email=bench@example.invalid',
          'commit',
          '--quiet',
          '--message',
          'fixture',
          '--',
          ...paths,
        ],
      },);

      return {
        cloneDir,
        commitSha: await git({
          cwd: cloneDir,
          args: [
            'rev-parse',
            'HEAD',
          ],
        },),
      };
    },
  },);
}

/**
 Characters in a SHA-1 object id.
 */
const OBJECT_ID_LENGTH = 40;

/**
 Commit every scripted read of the skip cases is made at.
 */
const SCRIPTED_COMMIT = 'a'.repeat(OBJECT_ID_LENGTH,);

/**
 Pin the scripted reads name, which no repository stands behind.
 */
const SCRIPTED_PIN: CorpusPin = {
  cloneDir: '/nonexistent/clone',
  commitSha: SCRIPTED_COMMIT,
};

/**
 Words the corpus reader ends every refusal with.
 */
const CLONE_ADVICE = 'check that the clone exists and the pinned commit is present.';

/**
 Makes a reader that serves both pages except one path, which it refuses.

 @param refusedPath - path whose read fails

 @param cause - what the failing read raised, whose stderr decides the failure kind

 @returns A reader to pass in place of `readCorpusFile`

 @example
 ```ts
 const readFile = readerRefusing({ refusedPath: 'people/whiskers/page.en.md', cause: new Error('no', ), },);
 ```
 */
function readerRefusing(
  {
    refusedPath,
    cause,
  }: {
    readonly refusedPath: string;
    readonly cause: unknown;
  },
): typeof readCorpusFile {
  return async function servesAllButOne(
    {
      pin,
      relPath,
    }: Parameters<typeof readCorpusFile>[0],
  ): Promise<string> {
    if (relPath === refusedPath) {
      throw new CorpusReadError({
        detail: `${pin.commitSha}:${relPath}`,
        cause,
      },);
    }
    return relPath.endsWith('/page.en.md',) ? TARGET_PAGE : SOURCE_PAGE;
  };
}

/**
 A page whose front matter fence holds YAML the parser refuses.
 */
const UNPARSABLE_PAGE = '---\ntitle: [unclosed\n---\n\n## The windowsill\n\nThe kitten dozes.\n';

/**
 The parser's marked refusal of {@link UNPARSABLE_PAGE}, as it prints whole.
 */
const UNPARSABLE_REFUSAL = 'Front matter fence pair found but YAML inside refused to parse at line 1 column 17 '
  + '(BAD_INDENT); corpus metadata parses upstream, so this signals corruption.';

/**
 Makes a reader that serves both pages, one path's page holding front matter
 no parser accepts.

 @param unparsablePath - path whose page cannot be parsed, which the skip line
 must name although its read succeeded

 @returns A reader to pass in place of `readCorpusFile`

 @example
 ```ts
 const readFile = readerServingUnparsable({ unparsablePath: 'people/whiskers/page.md', },);
 ```
 */
function readerServingUnparsable(
  { unparsablePath, }: { readonly unparsablePath: string; },
): typeof readCorpusFile {
  return async function servesOneUnparsable(
    { relPath, }: Parameters<typeof readCorpusFile>[0],
  ): Promise<string> {
    if (relPath === unparsablePath)
      return UNPARSABLE_PAGE;
    return relPath.endsWith('/page.en.md',) ? TARGET_PAGE : SOURCE_PAGE;
  };
}

/**
 Makes a reader under which one page of an entry cannot be read, git having
 found it missing, and the other is served with front matter no parser
 accepts, so the two pages fail at different steps.

 @param refusedPath - path whose read fails

 @param unparsablePath - path whose page is served and cannot be parsed

 @returns A reader to pass in place of `readCorpusFile`

 @example
 ```ts
 const readFile = readerMixingFailures({ refusedPath: 'people/whiskers/page.en.md', unparsablePath: 'people/whiskers/page.md', },);
 ```
 */
function readerMixingFailures(
  {
    refusedPath,
    unparsablePath,
  }: {
    readonly refusedPath: string;
    readonly unparsablePath: string;
  },
): typeof readCorpusFile {
  /**
   Reader refusing the one path.
   */
  const refusing = readerRefusing({
    refusedPath,
    cause: { stderr: 'fatal: path does not exist in the commit', },
  },);
  /**
   Reader serving the other path's page unparsable.
   */
  const unparsable = readerServingUnparsable({ unparsablePath, },);
  return async function refusesOneServesOneUnparsable(
    request: Parameters<typeof readCorpusFile>[0],
  ): Promise<string> {
    return (request.relPath === refusedPath) ? await refusing(request,) : await unparsable(request,);
  };
}

/**
 The skip line of the entry whose original page git found missing.
 */
const ORIGINAL_MISSING_LINE = `BENCH skipping ${HALF_ENTRY_ID}: people/${HALF_ENTRY_ID}/page.md could not be read: `
  + `corpus read failed for ${SCRIPTED_COMMIT}:people/${HALF_ENTRY_ID}/page.md (missing-object); ${CLONE_ADVICE}`;

/**
 The skip line of the entry whose original page cannot be parsed.
 */
const ORIGINAL_UNPARSABLE_LINE = `BENCH skipping ${HALF_ENTRY_ID}: people/${HALF_ENTRY_ID}/page.md could not be `
  + `parsed: ${UNPARSABLE_REFUSAL}`;

//endregion Fixtures

await describe({
  name: sampleBenchSlices.name,
  children: [
    it({
      name: 'pins Git after one header inspection despite later PATH drift and honors an explicit path',
      fn: async () => {
        await using pin = await clonedCorpusHolding({ files: {
          [`people/${ENTRY_ID}/page.md`]: SOURCE_PAGE,
          [`people/${ENTRY_ID}/page.en.md`]: TARGET_PAGE,
        } });
        const gitPath = await resolveGit();
        const apiPath = fileURLToPath(new URL('../../dist/final/node/index.mjs', import.meta.url));
        // The child observes header opens and changes PATH after inspection, so resolver caching cannot hide lost pin ownership.
        const program = `
import assert from 'node:assert/strict';
import files from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { pathToFileURL } from 'node:url';
const gitPath = ${JSON.stringify(gitPath)};
const pin = ${JSON.stringify(pin)};
const counts = { opens: 0, reads: 0, armed: false };
const originalRead = files.readFile;
const originalOpen = files.open;
files.readFile = async function countedRead(path, options) {
  if (path === gitPath) counts.reads += 1;
  return await originalRead(path, options);
};
files.open = async function countedOpen(path, flags, mode) {
  if (path === gitPath) {
    counts.opens += 1;
    if (counts.armed) process.env.PATH = pin.cloneDir;
  }
  return await originalOpen(path, flags, mode);
};
syncBuiltinESMExports();
const api = await import(pathToFileURL(${JSON.stringify(apiPath)}).href);
const control = await files.open(gitPath, 'r');
await control.close();
assert.equal(counts.opens, 1);
counts.opens = 0;
counts.reads = 0;
counts.armed = true;
const implicit = await api.sampleBenchSlices({ count: 1, pin });
const implicitOpens = counts.opens;
counts.opens = 0;
const explicit = await api.sampleBenchSlices({ count: 1, pin: { ...pin, gitPath } });
assert.deepEqual(explicit, implicit);
assert.equal(pin.gitPath, undefined);
assert.equal(process.env.PATH, pin.cloneDir);
await assert.rejects(api.sampleBenchSlices({ count: 1, pin }), { name: 'RealGitNotFoundError' });
console.log('BENCH_RESOLVER_PROOF ' + JSON.stringify({ implicitOpens, explicitOpens: counts.opens, readFileCalls: counts.reads, count: implicit.length }));
`;
        const done = await runKeyless({
          file: process.execPath,
          args: ['--input-type=module', '--eval', program],
          cwd: pin.cloneDir,
          extra: { HOME: pin.cloneDir },
        },);
        expect(done.code).toBe(0);
        const marker = 'BENCH_RESOLVER_PROOF ';
        const line = done.stdout.split('\n').find(value => value.startsWith(marker));
        if (line === undefined) throw new Error(`Missing resolver observation: ${done.stderr}`);
        expect(
          JSON.parse(line.slice(marker.length)),
        ).toEqual({ implicitOpens: 1, explicitOpens: 0, readFileCalls: 0, count: 1 });
      },
    }),
    it({
      name: 'REFUSES AS STATED a pinned corpus holding no entry at all, since a bench drawn over nothing would '
        + 'find every width indistinguishable and print that as a result',
      fn: async () => {
        /**
         Clone carrying a commit and no `people/` directory.
         */
        await using pin = await clonedCorpusHolding({ files: { 'README.md': 'no entries here\n', }, },);

        /**
         What the draw said about it.
         */
        const refusal = await rejectionOf(async function overAnEmptyCorpus() {
          await sampleBenchSlices({
            count: 1,
            pin,
          },);
        },);

        expect(refusal,).toBeInstanceOf(StatedRefusalError,);
        expect(String(refusal,),).toBe(
          'StatedRefusalError: the corpus at the pin yields no slice to sample: 0 entries are listed there and '
            + 'none could be sliced, so a bench drawn over it would compare on no work; check the clone and the '
            + 'commit this run reads',
        );
      },
    },),

    it({
      name: 'REFUSES AS STATED a pinned corpus whose one entry has no English page, counting it in the singular',
      fn: async () => {
        /**
         Clone holding one entry with an original and no translation.
         */
        await using pin = await clonedCorpusHolding({
          files: { [`people/${HALF_ENTRY_ID}/page.md`]: SOURCE_PAGE, },
        },);

        /**
         What the draw said about it.
         */
        const refusal = await rejectionOf(async function overAHalfWrittenCorpus() {
          await sampleBenchSlices({
            count: 1,
            pin,
          },);
        },);

        expect(refusal,).toBeInstanceOf(StatedRefusalError,);
        expect(String(refusal,),).toBe(
          'StatedRefusalError: the corpus at the pin yields no slice to sample: 1 entry is listed there and '
            + 'none could be sliced, so a bench drawn over it would compare on no work; check the clone and the '
            + 'commit this run reads',
        );
      },
    },),

    it({
      name: 'DRAWS from a pinned corpus that does hold one, which separates a guard reading its input '
        + 'from one refusing everything, and shows the pin reaching the reader rather than being ignored',
      fn: async () => {
        /**
         Clone carrying one entry with both sides present.
         */
        await using pin = await clonedCorpusHolding({
          files: {
            [`people/${ENTRY_ID}/page.md`]: SOURCE_PAGE,
            [`people/${ENTRY_ID}/page.en.md`]: TARGET_PAGE,
          },
        },);

        /**
         Slices drawn out of that one entry.
         */
        const sample = await sampleBenchSlices({
          count: 1,
          pin,
        },);

        expect(sample.length,).toBe(1,);
        expect(sample[0]?.entryId,).toBe(ENTRY_ID,);
        expect(sample[0]?.sourceText,).toContain('小猫',);
      },
    },),

    it({
      name: 'SKIPS an entry it cannot read and keeps drawing, rather than letting one unreadable '
        + 'entry refuse the whole sample, since the census reports the same gap and a bench that '
        + 'failed on it would depend on a completeness it does not need',
      fn: async () => {
        /**
         Clone carrying one readable entry beside one missing its English side.
         */
        await using pin = await clonedCorpusHolding({
          files: {
            [`people/${ENTRY_ID}/page.md`]: SOURCE_PAGE,
            [`people/${ENTRY_ID}/page.en.md`]: TARGET_PAGE,
            [`people/${HALF_ENTRY_ID}/page.md`]: SOURCE_PAGE,
          },
        },);

        /**
         Slices drawn across both entries, one of which cannot be sliced.
         */
        const sample = await sampleBenchSlices({
          count: 2,
          pin,
        },);

        // The half entry contributed nothing and cost nothing. Anything other
        // than the readable entry's own slices here means the draw either threw
        // out of the whole sample or admitted an entry with no translation to
        // repair.
        expect(sample.length,).toBe(1,);
        expect(sample.map(function toEntryId(slice,): string {
          return slice.entryId;
        },),).toStrictEqual([ENTRY_ID,],);
      },
    },),
    it({
      name: 'SKIPS AN ENTRY WITH NO ENGLISH PAGE and says the entry, the page and that git found it missing, whole',
      fn: async () => {
        /**
         Lines the draw printed.
         */
        const lines: string[] = [];
        /**
         Slices drawn over the one entry.
         */
        const slices = await sliceListedEntries({
          entryIds: [HALF_ENTRY_ID,],
          pin: SCRIPTED_PIN,
          readFile: readerRefusing({
            refusedPath: `people/${HALF_ENTRY_ID}/page.en.md`,
            cause: { stderr: 'fatal: path does not exist in the commit', },
          },),
          report: function collect(line,): void {
            lines.push(line,);
          },
        },);
        expect(slices,).toEqual([],);
        expect(lines,).toEqual([
          `BENCH skipping ${HALF_ENTRY_ID}: people/${HALF_ENTRY_ID}/page.en.md could not be read: corpus read failed for `
            + `${SCRIPTED_COMMIT}:people/${HALF_ENTRY_ID}/page.en.md (missing-object); ${CLONE_ADVICE}`,
        ],);
      },
    },),
    it({
      name: 'SKIPS AN ENTRY WITH NO ORIGINAL and says the entry, the page and that git found it missing, whole',
      fn: async () => {
        /**
         Lines the draw printed.
         */
        const lines: string[] = [];
        /**
         Slices drawn over the one entry.
         */
        const slices = await sliceListedEntries({
          entryIds: [HALF_ENTRY_ID,],
          pin: SCRIPTED_PIN,
          readFile: readerRefusing({
            refusedPath: `people/${HALF_ENTRY_ID}/page.md`,
            cause: { stderr: 'fatal: path does not exist in the commit', },
          },),
          report: function collect(line,): void {
            lines.push(line,);
          },
        },);
        expect(slices,).toEqual([],);
        expect(lines,).toEqual([ORIGINAL_MISSING_LINE,],);
      },
    },),
    it({
      name: 'SKIPS AN ENTRY UNREADABLE FOR ANOTHER REASON and says the entry, the page and that the failure was another kind, whole',
      fn: async () => {
        /**
         Lines the draw printed.
         */
        const lines: string[] = [];
        /**
         Slices drawn over the one entry.
         */
        const slices = await sliceListedEntries({
          entryIds: [HALF_ENTRY_ID,],
          pin: SCRIPTED_PIN,
          readFile: readerRefusing({
            refusedPath: `people/${HALF_ENTRY_ID}/page.en.md`,
            cause: { stderr: 'fatal: not a git repository', },
          },),
          report: function collect(line,): void {
            lines.push(line,);
          },
        },);
        expect(slices,).toEqual([],);
        expect(lines,).toEqual([
          `BENCH skipping ${HALF_ENTRY_ID}: people/${HALF_ENTRY_ID}/page.en.md could not be read: corpus read failed for `
            + `${SCRIPTED_COMMIT}:people/${HALF_ENTRY_ID}/page.en.md (other); ${CLONE_ADVICE}`,
        ],);
      },
    },),
    it({
      name: 'SKIPS AN ENTRY WHOSE READ FAILS WITH NO CORPUS READ REFUSAL and names the page and only the failure\'s '
        + 'class, quoting nothing it said',
      fn: async () => {
        /**
         Lines the draw printed.
         */
        const lines: string[] = [];
        /**
         Slices drawn over the one entry.
         */
        const slices = await sliceListedEntries({
          entryIds: [HALF_ENTRY_ID,],
          pin: SCRIPTED_PIN,
          readFile: async function knocksTheClone(): Promise<string> {
            throw new RangeError('the cat knocked the clone off the shelf',);
          },
          report: function collect(line,): void {
            lines.push(line,);
          },
        },);
        expect(slices,).toEqual([],);
        expect(lines,).toEqual([
          `BENCH skipping ${HALF_ENTRY_ID}: people/${HALF_ENTRY_ID}/page.md could not be read: refused by RangeError`,
        ],);
      },
    },),
    it({
      name: 'PRINTS THE SKIP LINES OF SEVERAL ENTRIES in the order the corpus lists them when the later entry\'s '
        + 'reads are refused first, each naming its own first page',
      fn: async () => {
        /**
         Lines the draw printed.
         */
        const lines: string[] = [];
        /**
         Slices drawn over the two entries.
         */
        const slices = await sliceListedEntries({
          entryIds: ['cat-alpha', 'cat-beta',],
          pin: SCRIPTED_PIN,
          readFile: pageReadsRefusingLastFor({ endsLast: 'people/cat-alpha/', },),
          report: function collect(line,): void {
            lines.push(line,);
          },
        },);
        expect(slices,).toEqual([],);
        expect(lines,).toEqual([
          `BENCH skipping cat-alpha: people/cat-alpha/page.md could not be read: corpus read failed for `
            + `${SCRIPTED_COMMIT}:people/cat-alpha/page.md (missing-object); ${CLONE_ADVICE}`,
          `BENCH skipping cat-beta: people/cat-beta/page.md could not be read: corpus read failed for `
            + `${SCRIPTED_COMMIT}:people/cat-beta/page.md (missing-object); ${CLONE_ADVICE}`,
        ],);
      },
    },),
    it({
      name: 'NAMES THE ORIGINAL IN THE SKIP LINE when both pages of an entry are refused, since the pair is '
        + 'reported by input order whichever refusal ends first',
      fn: async () => {
        /**
         Lines the draw printed.
         */
        const lines: string[] = [];
        /**
         Slices drawn over the one entry.
         */
        const slices = await sliceListedEntries({
          entryIds: [HALF_ENTRY_ID,],
          pin: SCRIPTED_PIN,
          readFile: pageReadsRefusingLastFor({ endsLast: '/page.md', },),
          report: function collect(line,): void {
            lines.push(line,);
          },
        },);
        expect(slices,).toEqual([],);
        expect(lines,).toEqual([ORIGINAL_MISSING_LINE,],);
      },
    },),
    it({
      name: 'SKIPS AN ENTRY WHOSE ORIGINAL CANNOT BE PARSED and names that page and the parser\'s marked refusal, '
        + 'whole, although both reads succeeded',
      fn: async () => {
        /**
         Lines the draw printed.
         */
        const lines: string[] = [];
        /**
         Slices drawn over the one entry.
         */
        const slices = await sliceListedEntries({
          entryIds: [HALF_ENTRY_ID,],
          pin: SCRIPTED_PIN,
          readFile: readerServingUnparsable({ unparsablePath: `people/${HALF_ENTRY_ID}/page.md`, },),
          report: function collect(line,): void {
            lines.push(line,);
          },
        },);
        expect(slices,).toEqual([],);
        expect(lines,).toEqual([ORIGINAL_UNPARSABLE_LINE,],);
      },
    },),
    it({
      name: 'SKIPS AN ENTRY WHOSE ENGLISH PAGE CANNOT BE PARSED and names that page and the parser\'s marked '
        + 'refusal, whole, although both reads succeeded',
      fn: async () => {
        /**
         Lines the draw printed.
         */
        const lines: string[] = [];
        /**
         Slices drawn over the one entry.
         */
        const slices = await sliceListedEntries({
          entryIds: [HALF_ENTRY_ID,],
          pin: SCRIPTED_PIN,
          readFile: readerServingUnparsable({ unparsablePath: `people/${HALF_ENTRY_ID}/page.en.md`, },),
          report: function collect(line,): void {
            lines.push(line,);
          },
        },);
        expect(slices,).toEqual([],);
        expect(lines,).toEqual([
          `BENCH skipping ${HALF_ENTRY_ID}: people/${HALF_ENTRY_ID}/page.en.md could not be parsed: ${UNPARSABLE_REFUSAL}`,
        ],);
      },
    },),
    it({
      name: 'NAMES THE ORIGINAL\'S PARSE FAILURE IN THE SKIP LINE when the original cannot be parsed and the English '
        + 'page cannot be read, since of two pages that fail the original is reported, read or parse, whichever '
        + 'ended first',
      fn: async () => {
        /**
         Lines the draw printed.
         */
        const lines: string[] = [];
        /**
         Slices drawn over the one entry.
         */
        const slices = await sliceListedEntries({
          entryIds: [HALF_ENTRY_ID,],
          pin: SCRIPTED_PIN,
          readFile: readerMixingFailures({
            refusedPath: `people/${HALF_ENTRY_ID}/page.en.md`,
            unparsablePath: `people/${HALF_ENTRY_ID}/page.md`,
          },),
          report: function collect(line,): void {
            lines.push(line,);
          },
        },);
        expect(slices,).toEqual([],);
        expect(lines,).toEqual([ORIGINAL_UNPARSABLE_LINE,],);
      },
    },),
    it({
      name: 'NAMES THE ORIGINAL\'S READ FAILURE IN THE SKIP LINE when the original cannot be read and the English '
        + 'page cannot be parsed',
      fn: async () => {
        /**
         Lines the draw printed.
         */
        const lines: string[] = [];
        /**
         Slices drawn over the one entry.
         */
        const slices = await sliceListedEntries({
          entryIds: [HALF_ENTRY_ID,],
          pin: SCRIPTED_PIN,
          readFile: readerMixingFailures({
            refusedPath: `people/${HALF_ENTRY_ID}/page.md`,
            unparsablePath: `people/${HALF_ENTRY_ID}/page.en.md`,
          },),
          report: function collect(line,): void {
            lines.push(line,);
          },
        },);
        expect(slices,).toEqual([],);
        expect(lines,).toEqual([ORIGINAL_MISSING_LINE,],);
      },
    },),
    it({
      name: 'PRINTS THE SKIP LINE OF AN ENTRY A REAL CLONE HOLDS NO ENGLISH PAGE FOR on the terminal, naming the '
        + 'entry, the page and that git found it missing, whole',
      fn: async (ctx) => {
        /**
         Entry no other case's clone holds, so its line is told apart from
         any line another case prints while this one runs.
         */
        const halfEntry = 'marmalade';
        await using pin = await clonedCorpusHolding({
          files: {
            [`people/${ENTRY_ID}/page.md`]: SOURCE_PAGE,
            [`people/${ENTRY_ID}/page.en.md`]: TARGET_PAGE,
            [`people/${halfEntry}/page.md`]: SOURCE_PAGE,
          },
        },);
        using printed = divertingConsoleLog({ sinon: ctx.sinon, },);

        await sampleBenchSlices({
          count: 2,
          pin,
        },);

        expect(printed.lines.filter(function isThisEntry(line,): boolean {
          return line.startsWith(`BENCH skipping ${halfEntry}:`,);
        },),).toEqual([
          `BENCH skipping ${halfEntry}: people/${halfEntry}/page.en.md could not be read: corpus read failed for `
            + `${pin.commitSha}:people/${halfEntry}/page.en.md (missing-object); ${CLONE_ADVICE}`,
        ],);
      },
    },),
  ],
},);
