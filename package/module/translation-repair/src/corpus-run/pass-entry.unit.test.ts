/**
 * Tests for settling one entry from both lanes.
 *
 * WHAT THESE COVER that neither the driver's nor the builder's tests can: that
 * an entry reaches disk as ONE version 2 artifact over ONE preparation, that a
 * failed entry keeps the slices it bought and writes nothing, and that an abort
 * landing after the lanes return stops the write rather than being noticed only
 * on the next call.
 *
 * Everything runs against throwaway directories under the system temp root, so
 * no case can reach a real artifacts directory or a real slice cache.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  messageText,
  type PipelineDigest,
  settleEntry,
  type SyntheticClient,
} from '../../dist/final/node/index.mjs';

/**
 * Built pipeline these fixtures claim to have run under.
 */
const DIGEST = `sha256-tree-v1:${'c'.repeat(64,)}` as PipelineDigest;

/**
 * Sentence every scripted translator returns for the first section.
 */
const FRESH = 'The cat naps on the windowsill.';

/**
 * Original document: two sections, each one paragraph.
 */
const SOURCE_TEXT = `## 第一节

猫猫在窗台上打盹。

## 第二节

窗台上有一只鸟。
`;

/**
 * Translation as it stands, awkward but complete.
 */
const TARGET_TEXT = `## Section one

The cat is doing the sleeping on the windowsill.

## Section two

On the windowsill there is being a bird.
`;

/**
 * Entry every case settles.
 */
const ENTRY = {
  id: 'CatEntry1',
  sourceText: SOURCE_TEXT,
  targetText: TARGET_TEXT,
};

/**
 * Entry the cleanup case settles, under its own id.
 *
 * SEPARATE because that case reads what was PRINTED, and the runner runs cases
 * concurrently in one process: a capture keyed on nothing collects whatever
 * other cases logged while it was installed. Filtering by an id no other case
 * uses is what makes the reading this case's own.
 */
const CLEANUP_ENTRY = {
  id: 'CatEntry2',
  sourceText: SOURCE_TEXT,
  targetText: TARGET_TEXT,
};

/**
 * Renders one slice the way a translator that respected block structure would.
 *
 * @param content - translator prompt, which carries the slice original
 *
 * @returns Rendering for that slice
 *
 * @example
 * ```ts
 * const rendering = renderingFor({ content, },);
 * ```
 */
function renderingFor({ content, }: { readonly content: string; },): string {
  if (content.includes('第一节',))
    return `## Section one\n\n${FRESH}`;
  if (content.includes('第二节',))
    return '## Section two\n\nA bird sits on the windowsill.';
  return FRESH;
}

/**
 * Finds the one-based candidate index whose rendering carries a needle.
 *
 * @param content - judge user message
 *
 * @returns One-based index, or zero when no candidate carries it
 *
 * @example
 * ```ts
 * const best = pickCandidate({ content, },);
 * ```
 */
function pickCandidate({ content, }: { readonly content: string; },): number {
  /**
   * Sheet split at each candidate heading; the first piece is the evidence.
   */
  const [, ...blocks] = content.split('CANDIDATE ',);
  for (const block of blocks) {
    /**
     * Heading line carrying this candidate's number.
     */
    const [heading = '',] = block.split('\n',);

    /**
     * Number the heading states.
     */
    const index = Math.trunc(Number(heading,),);
    if (Number.isInteger(index,) && block.includes(FRESH,))
      return index;
  }
  return 0;
}

/**
 * Scripted reply for one stage.
 *
 * The repair lane's critics find nothing, so that lane keeps the archive; the
 * translate lane renders each slice afresh and its judges pick that rendering.
 * The two lanes therefore disagree by construction, which is what makes the
 * artifact worth reading.
 *
 * @param schema - schema name the stage asked for
 *
 * @param content - everything the stage sent
 *
 * @returns Wire value for that stage
 *
 * @throws {@link Error} when a stage this script does not serve asks
 *
 * @example
 * ```ts
 * const value = replyFor({ schema: 'critic_report', content, },);
 * ```
 */
function replyFor(
  {
    schema,
    content,
  }: {
    readonly schema: string;
    readonly content: string;
  },
): unknown {
  // THE PAIRING ROUND RUNS BEFORE EITHER LANE, so the script has to serve it or
  // every entry falls back to scoring and, worse, a resumed entry re-buys the
  // round it could not cache. An empty pairing is a legal answer meaning nothing
  // corresponds, which keeps this fixture's slicing exactly as it was before the
  // stage existed.
  if (schema === 'block_pairing')
    return { pairs: [], };
  if (schema === 'critic_report')
    return { issues: [], };
  if (schema === 'refine_report')
    return { rewrites: [], };
  if (schema === 'translation_report')
    return { translation: renderingFor({ content, },), };
  if (schema === 'candidate_ballot') {
    return {
      best: pickCandidate({ content, },),
      reason: 'scripted',
    };
  }
  throw new Error(`no script for ${schema}`,);
}

/**
 * Client serving both lanes from one script.
 *
 * @param served - schema names appended in call order
 *
 * @param failOnSchema - schema every call of which throws, standing in for a
 * provider that is down for one stage; absent means the script never fails
 *
 * @returns Client honoring the script
 *
 * @example
 * ```ts
 * const client = entryClient({ served, },);
 * ```
 */
function entryClient(
  {
    served,
    failOnSchema,
  }: {
    readonly served: string[];
    readonly failOnSchema?: string;
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by either lane',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       * Schema the caller asked for, which names the stage.
       */
      const schema = request.responseFormat
        ?.json_schema
        .name
        ?? 'unnamed';
      served.push(schema,);
      if (schema === failOnSchema)
        throw new Error('scripted provider failure',);

      /**
       * Everything the caller sent, which carries the slice original.
       */
      const content = request.messages
        .map(function toContent(message,) {
          return messageText({ message, },);
        },)
        .join('\n',);

      /**
       * Reply for whichever stage asked, keyed by its schema.
       */
      const value: unknown = replyFor({
        schema,
        content,
      },);
      if (!request.validate(value,))
        throw new Error(`scripted ${schema} failed the wire guard`,);
      return {
        kind: 'ok',
        value,
        rawText: JSON.stringify(value,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused by either lane',);
    },
  };
}

/**
 * Throwaway artifacts and cache directories for one case.
 *
 * @returns Both directories, plus how to remove them
 *
 * @example
 * ```ts
 * await using dirs = await throwawayDirs();
 * ```
 */
async function throwawayDirs(): Promise<
  {
    readonly artifactsDir: string;
    readonly sliceCacheDir: string;
  } & AsyncDisposable
> {
  /**
   * Root nothing outside this case writes into.
   */
  const root = await mkdtemp(join(
    tmpdir(),
    'pass-entry-',
  ),);

  /**
   * Directory settled entries write into, created here because the PASS
   * creates it before settling anything: `settleEntry` writes into a directory
   * it is handed, and a case that skipped this would be testing the atomic
   * write's behavior on a missing parent instead.
   */
  const artifactsDir = join(
    root,
    'artifacts',
  );
  await mkdir(
    artifactsDir,
    { recursive: true, },
  );
  return {
    artifactsDir,
    sliceCacheDir: join(
      root,
      'cache',
    ),
    [Symbol.asyncDispose]: async () => {
      await rm(
        root,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * Reads every artifact filename a case wrote.
 *
 * @param artifactsDir - directory settled entries write into
 *
 * @returns Filenames present, or none when the directory was never created
 *
 * @example
 * ```ts
 * const written = await artifactNames({ artifactsDir, },);
 * ```
 */
async function artifactNames(
  { artifactsDir, }: { readonly artifactsDir: string; },
): Promise<readonly string[]> {
  try {
    return await readdir(artifactsDir,);
  }
  catch (error) {
    // A settled entry creates this directory on its way to writing; a failed
    // one never reaches the write, so its absence is the answer rather than a
    // problem. Logged so a real permission failure is not read as emptiness.
    console.log(`no artifacts directory: ${caughtValueText(error,)}`,);
    return [];
  }
}

/**
 * Diverts `console.log` into a list until disposed.
 *
 * @param lines - where diverted lines are appended
 *
 * @returns Capture holding those lines, which restores logging on disposal
 *
 * @example
 * ```ts
 * using capture = collectingInto({ lines, },);
 * ```
 */
function collectingInto(
  { lines, }: { readonly lines: string[]; },
): { readonly lines: readonly string[]; } & Disposable {
  /**
   * Real logger, put back on disposal.
   */
  const printed = console.log;
  console.log = (...parts: readonly unknown[]) => {
    lines.push(parts.map(String,)
      .join(' ',),);
  };
  return {
    lines,
    [Symbol.dispose]: () => {
      console.log = printed;
    },
  };
}

/**
 * Runs a body with every `console.log` line collected instead of printed.
 *
 * The lines ARE the contract here: an entry that settled and then failed to
 * retire its cache has to say so on a `CLEANUP` line, and the defect this
 * guards against is a second `TALLY` after the success line, which made every
 * reader counting statuses see one entry as both settled and errored.
 *
 * @param body - what to run while logging is captured
 *
 * @returns Every line the body logged, in order
 *
 * @example
 * ```ts
 * const lines = await capturedLines({ body: async () => { await settleEntry(...); }, },);
 * ```
 */
async function capturedLines(
  { body, }: { readonly body: () => Promise<void>; },
): Promise<readonly string[]> {
  /**
   * Lines the body logged.
   */
  const lines: string[] = [];

  using capture = collectingInto({ lines, },);
  await body();

  // Read after the body so a case cannot assert on a capture still installed;
  // disposal at return puts the real logger back.
  return capture.lines;
}

await describe({
  name: settleEntry.name,
  children: [
    it({
      name:
        'settles an entry into ONE artifact at schema version 2 carrying BOTH lanes over ONE '
        + 'preparation, which is what the whole two-lane generation is for: the two documents differ '
        + 'by lane rather than by two runs of the aligner',
      fn: async () => {
        await using dirs = await throwawayDirs();

        /**
         * Schemas the run served, in order.
         */
        const served: string[] = [];
        await settleEntry({
          client: entryClient({ served, },),
          entry: ENTRY,
          artifactsDir: dirs.artifactsDir,
          sliceCacheDir: dirs.sliceCacheDir,
          tip: 'a'.repeat(40,),
          pipelineDigest: DIGEST,
          hardCapMs: 60_000,
          baseSignal: new AbortController().signal,
        },);
        expect(await artifactNames({ artifactsDir: dirs.artifactsDir, },),).toEqual(['CatEntry1.json',],);

        /**
         * What reached disk.
         */
        const artifact: unknown = JSON.parse(await readFile(
          join(
            dirs.artifactsDir,
            'CatEntry1.json',
          ),
          'utf8',
        ),);

        // Read structurally rather than through the writer's own types, since
        // what is under test is the FILE: a reader holding only this has to
        // find both lanes nested and no lane at the top level.
        expect((artifact as { artifactSchemaVersion: number; }).artifactSchemaVersion,).toBe(2,);
        expect(Object.keys((artifact as { lanes: object; }).lanes,)
          .toSorted(),).toEqual([
          'repair',
          'translate',
        ],);
        expect((artifact as { laneSelection: object; }).laneSelection,).toEqual({
          kind: 'pending-human-decision',
        },);

        // One preparation, recorded once, which both ledgers are out of.
        expect((artifact as { preparation: { sliceCount: number; }; }).preparation
          .sliceCount,).toBeGreaterThan(0,);
        expect((artifact as { comparison: readonly unknown[]; }).comparison
          .length,).toBe((artifact as { preparation: { sliceCount: number; }; }).preparation
          .sliceCount,);

        // Both lanes were bought: the repair lane's critics and the translate
        // lane's translators each ran.
        expect(served.includes('critic_report',),).toBe(true,);
        expect(served.includes('translation_report',),).toBe(true,);
      },
    },),
    it({
      name:
        'REFUSES to write anything for an entry that raised, and keeps every slice it had already '
        + 'bought: the cache is what makes the next attempt cheaper, and a pass that discarded it on '
        + 'failure would re-buy the whole document',
      fn: async () => {
        await using dirs = await throwawayDirs();

        /**
         * Schemas the run served before the write failed.
         */
        const served: string[] = [];

        // THE WRITE is what fails here, not a model call, and that is
        // deliberate: both lanes tolerate a stage losing every voice, so a
        // scripted provider failure settles the entry rather than failing it
        // (`#112`). A directory that does not exist fails the one step every
        // settled entry has to reach, whatever the lanes did.
        await settleEntry({
          client: entryClient({ served, },),
          entry: ENTRY,
          artifactsDir: join(
            dirs.artifactsDir,
            'not-created',
          ),
          sliceCacheDir: dirs.sliceCacheDir,
          tip: 'a'.repeat(40,),
          pipelineDigest: DIGEST,
          hardCapMs: 60_000,
          baseSignal: new AbortController().signal,
        },);

        // Nothing reached the artifacts directory, which is the rule that makes
        // a settled artifact mean the entry finished.
        expect(await artifactNames({ artifactsDir: dirs.artifactsDir, },),).toEqual([],);

        // And this entry's cache directory survives the failure, holding the
        // slices both lanes had already bought.
        expect(await artifactNames({ artifactsDir: dirs.sliceCacheDir, },),).toEqual(['CatEntry1',],);
      },
    },),
    it({
      name:
        'RETURNS rather than raising for an entry that failed, because a pass over a corpus stops for '
        + 'a broken scheduler and not for a broken document: anything thrown here would end the run at '
        + 'whichever entry happened to hold the problem',
      fn: async () => {
        await using dirs = await throwawayDirs();

        /**
         * Schemas served by a run whose write cannot land.
         */
        const served: string[] = [];

        // No expect(...).rejects here on purpose: the claim is that this
        // RETURNS, and a case that asserted on a thrown value would pass
        // whether or not it did.
        await settleEntry({
          client: entryClient({ served, },),
          entry: ENTRY,
          artifactsDir: join(
            dirs.artifactsDir,
            'not-created',
          ),
          sliceCacheDir: dirs.sliceCacheDir,
          tip: 'a'.repeat(40,),
          pipelineDigest: DIGEST,
          hardCapMs: 60_000,
          baseSignal: new AbortController().signal,
        },);
        expect(served.length,).toBeGreaterThan(0,);
      },
    },),
    it({
      name:
        'SETTLES an entry whose critic stage lost every voice, and says so in the OUTCOMES rather than '
        + 'only in the findings: a slice nobody was heard about falls back to the archive, so a reader '
        + 'joining on outcomes sees the silence instead of a lane that looks like it decided',
      fn: async () => {
        await using dirs = await throwawayDirs();

        /**
         * Schemas served, with every critic call failing.
         */
        const served: string[] = [];
        await settleEntry({
          client: entryClient({
            served,
            failOnSchema: 'critic_report',
          },),
          entry: ENTRY,
          artifactsDir: dirs.artifactsDir,
          sliceCacheDir: dirs.sliceCacheDir,
          tip: 'a'.repeat(40,),
          pipelineDigest: DIGEST,
          hardCapMs: 60_000,
          baseSignal: new AbortController().signal,
        },);
        expect(await artifactNames({ artifactsDir: dirs.artifactsDir, },),).toEqual(['CatEntry1.json',],);

        /**
         * What reached disk after every critic call failed.
         */
        const artifact: unknown = JSON.parse(await readFile(
          join(
            dirs.artifactsDir,
            'CatEntry1.json',
          ),
          'utf8',
        ),);

        // Every critic was attempted and every one was lost.
        expect(served.filter(function isCritic(schema,): boolean {
          return schema === 'critic_report';
        },).length,).toBeGreaterThan(0,);
        expect((artifact as { lanes: { repair: { result: { findings: readonly string[]; }; }; }; }).lanes
          .repair
          .result
          .findings
          .some(function unmet(finding,): boolean {
            return finding.includes('stage-quorum-unmet',);
          },),).toBe(true,);

        // AND THE LEDGER SAYS IT TOO, which is the half that was missing: every
        // repair slice reads as falling back to the archive rather than as a
        // decision, so nothing downstream can read this run as the lane having
        // examined the wording and chosen to keep it.
        expect((artifact as {
          lanes: { repair: { delivery: readonly { outcome: { kind: string; }; }[]; }; };
        }).lanes
          .repair
          .delivery
          .map(function toKind(row,): string {
            return row.outcome
              .kind;
          },)
          .every(function fellBack(kind,): boolean {
            return kind === 'incumbent-fallback';
          },),).toBe(true,);
      },
    },),
    it({
      name:
        'REFUSES to write an artifact when the ceiling fired while BOTH LANES FINISHED FROM CACHE, '
        + 'which is the one window the check after the driver exists for: a resumed entry buys nothing, '
        + 'so no exchange is left to notice the abort and the run ends holding two complete documents '
        + 'it is no longer entitled to record',
      fn: async () => {
        await using dirs = await throwawayDirs();

        /**
         * First run, whose write cannot land, so both lanes complete and the
         * cache they filled survives instead of being discarded on settlement.
         */
        const bought: string[] = [];
        await settleEntry({
          client: entryClient({ served: bought, },),
          entry: ENTRY,
          artifactsDir: join(
            dirs.artifactsDir,
            'not-created',
          ),
          sliceCacheDir: dirs.sliceCacheDir,
          tip: 'a'.repeat(40,),
          pipelineDigest: DIGEST,
          hardCapMs: 60_000,
          baseSignal: new AbortController().signal,
        },);
        expect(bought.length,).toBeGreaterThan(0,);

        /**
         * Ceiling that fired before this attempt started, which is what a
         * resumed entry meets when the pass is already over its budget.
         */
        const controller = new AbortController();
        controller.abort(new Error('entry deadline reached',),);

        /**
         * Schemas the resumed run serves, which must be none.
         */
        const resumed: string[] = [];
        await settleEntry({
          client: entryClient({ served: resumed, },),
          entry: ENTRY,
          artifactsDir: dirs.artifactsDir,
          sliceCacheDir: dirs.sliceCacheDir,
          tip: 'a'.repeat(40,),
          pipelineDigest: DIGEST,
          hardCapMs: 60_000,
          baseSignal: controller.signal,
        },);

        // NOTHING WAS BOUGHT, which is what makes this the interesting case:
        // with every slice resumed, no exchange ever saw the aborted signal, so
        // the lanes returned two finished documents under an expired deadline.
        expect(resumed,).toEqual([],);

        // And no artifact was written for them.
        expect(await artifactNames({ artifactsDir: dirs.artifactsDir, },),).toEqual([],);

        // The cache is kept, so the entry can be settled properly later.
        expect(await artifactNames({ artifactsDir: dirs.sliceCacheDir, },),).toEqual(['CatEntry1',],);
      },
    },),
    it({
      name:
        'logs a CLEANUP line and NOT a second TALLY when the artifact landed but the cache could not be '
        + 'retired: the entry IS settled, so a second status line would make every reader counting '
        + 'statuses see one entry as both settled and errored',
      fn: async () => {
        await using dirs = await throwawayDirs();

        /**
         * This entry's own cache directory, which the first run fills.
         */
        const entryCacheDir = join(
          dirs.sliceCacheDir,
          CLEANUP_ENTRY.id,
        );

        // FIRST RUN: the write cannot land, so the cache survives rather than
        // being retired on settlement. There is no hook between the artifact
        // write and the discard, so the cache has to exist before the run that
        // fails to remove it.
        await settleEntry({
          client: entryClient({ served: [], },),
          entry: CLEANUP_ENTRY,
          artifactsDir: join(
            dirs.artifactsDir,
            'not-created',
          ),
          sliceCacheDir: dirs.sliceCacheDir,
          tip: 'a'.repeat(40,),
          pipelineDigest: DIGEST,
          hardCapMs: 60_000,
          baseSignal: new AbortController().signal,
        },);
        expect(await artifactNames({ artifactsDir: dirs.sliceCacheDir, },),).toEqual([CLEANUP_ENTRY.id,],);

        // Removal unlinks the entries INSIDE this directory, which needs write
        // permission on the directory itself. Read and traverse are left, so
        // the run can still resume from it.
        //
        // Permissions do not constrain a superuser, so this case reports a
        // discard that unexpectedly succeeded rather than passing quietly: run
        // as root, the injection has no effect and there is nothing to test.
        await chmod(
          entryCacheDir,
          0o500,
        );

        /**
         * Everything the settling run printed.
         */
        const lines = await capturedLines({
          body: async () => {
            await settleEntry({
              client: entryClient({ served: [], },),
              entry: CLEANUP_ENTRY,
              artifactsDir: dirs.artifactsDir,
              sliceCacheDir: dirs.sliceCacheDir,
              tip: 'a'.repeat(40,),
              pipelineDigest: DIGEST,
              hardCapMs: 60_000,
              baseSignal: new AbortController().signal,
            },);
          },
        },);

        // Put the directory back before asserting, so a failing assertion still
        // leaves a removable tree behind for the disposal.
        await chmod(
          entryCacheDir,
          0o700,
        );

        /**
         * Lines about THIS entry, since other cases log into the same capture.
         */
        const mine = lines.filter(function namesThisEntry(line,): boolean {
          return line.includes(CLEANUP_ENTRY.id,);
        },);

        /**
         * Status lines this entry produced.
         */
        const tallies = mine.filter(function isTally(line,): boolean {
          return line.startsWith('TALLY ',);
        },);

        /**
         * Cleanup lines it produced.
         */
        const cleanups = mine.filter(function isCleanup(line,): boolean {
          return line.startsWith('CLEANUP ',);
        },);
        expect(cleanups.length,).toBe(1,);
        expect(cleanups[0]?.includes('cache=retained',),).toBe(true,);

        // EXACTLY ONE status line, and it says the entry settled.
        expect(tallies.length,).toBe(1,);
        expect(tallies[0]?.includes('status=SETTLED',),).toBe(true,);

        // The artifact is on disk and the cache it could not retire is still
        // there, which costs disk and nothing else: the next run skips this
        // entry on its artifact.
        expect(await artifactNames({ artifactsDir: dirs.artifactsDir, },),).toEqual([`${CLEANUP_ENTRY.id}.json`,],);
        expect(await artifactNames({ artifactsDir: dirs.sliceCacheDir, },),).toEqual([CLEANUP_ENTRY.id,],);
      },
    },),
  ],
},);
