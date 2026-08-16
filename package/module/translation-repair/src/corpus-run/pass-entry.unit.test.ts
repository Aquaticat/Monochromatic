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
          return message.content;
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
        'SETTLES an entry whose critic stage lost every voice, which is worth pinning because it is '
        + 'surprising: the lane records the archive as kept and the artifact reads like a clean run, '
        + 'with the lost voices visible only in findings (`#112` covers what that misrecords)',
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

        // Every critic was attempted and every one was lost, and the findings
        // are the only place that says so.
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
  ],
},);
