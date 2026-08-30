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

import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  fixedPagePath,
  messageText,
  parseSettledTwoLaneArtifact,
  type PipelineDigest,
  settleEntry,
  type SyntheticClient,
} from '../../dist/final/node/index.mjs';

/**
 * Built pipeline these fixtures claim to have run under.
 */
const DIGEST = `sha256-tree-v1:${'c'.repeat(64,)}` as PipelineDigest;

/**
 * Environment variable selecting pass slice overlap.
 */
const OVERLAP_VAR = 'TRANSLATION_REPAIR_SLICE_OVERLAP';

/**
 * Successful model calls in flight for one pass stage.
 */
type PassStageConcurrency = {
  now: number;
  peak: number;
};

/**
 * Per-slice driver activity observed at shared client boundary.
 */
type PassConcurrency = {
  readonly repair: PassStageConcurrency;
  readonly refine: PassStageConcurrency;
  readonly translate: PassStageConcurrency;
  readonly contest: PassStageConcurrency;
  readonly consolidate: PassStageConcurrency;
};

/**
 * Sets overlap dial until disposal and restores invoking value.
 *
 * @param says - value one measurement arm requests
 *
 * @returns Disposable restoring prior environment
 *
 * @example
 * ```ts
 * using dial = overlapDial({ says: '2', },);
 * ```
 */
function overlapDial(
  { says, }: { readonly says: string; },
): Disposable {
  /**
   * Invoking environment value restored on disposal.
   */
  const before = process.env[OVERLAP_VAR];
  process.env[OVERLAP_VAR] = says;
  return {
    [Symbol.dispose]: () => {
      if (before === undefined)
        delete process.env.TRANSLATION_REPAIR_SLICE_OVERLAP;
      else
        process.env[OVERLAP_VAR] = before;
    },
  };
}

/**
 * Builds zeroed instruments for one pass arm.
 *
 * @returns Independent activity counters per per-slice driver
 *
 * @example
 * ```ts
 * const activity = emptyPassConcurrency();
 * ```
 */
function emptyPassConcurrency(): PassConcurrency {
  return {
    repair: {
      now: 0,
      peak: 0,
    },
    refine: {
      now: 0,
      peak: 0,
    },
    translate: {
      now: 0,
      peak: 0,
    },
    contest: {
      now: 0,
      peak: 0,
    },
    consolidate: {
      now: 0,
      peak: 0,
    },
  };
}

/**
 * Sentence every scripted translator returns for the first section.
 */
const FRESH = 'The cat naps on the windowsill.';

/**
 * Sentence every translator returns for second section.
 */
const BIRD_FRESH = 'A bird sits on the windowsill.';

/**
 * Literal consolidation paragraph long enough for naturalness stage.
 */
const POLISH_BASE_PARAGRAPH = 'The cat faced life proactively and spent a good time with everyone, while doing her best to stay hopeful and connected to the people around her.';

/**
 * Idiomatic final paragraph approved by polish gate.
 */
const POLISH_FINAL_PARAGRAPH = 'The cat maintained a positive outlook on life and spent some good times with everyone, doing her best to stay hopeful and connected to those around her.';

/**
 * Stable phrase identifying literal consolidation after semantic wrapping.
 */
const POLISH_BASE_NEEDLE = 'faced life proactively';

/**
 * Stable phrase identifying idiomatic polish after semantic wrapping.
 */
const POLISH_FINAL_NEEDLE = 'maintained a positive outlook on life';

/**
 * Complete consolidated slice before naturalness stage.
 */
const POLISH_BASE = `## Section one\n\n${POLISH_BASE_PARAGRAPH}`;

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

The cat is doing the sleeping on the windowsill throughout the quiet afternoon while the sunlight is moving slowly across the room.

## Section two

On the windowsill there is being a bird that is watching the garden for a long time while the cat continues sleeping nearby.
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
 * Source page made entirely of visible metadata.
 */
const FRONT_MATTER_SOURCE = '---\nname: 猫猫\ninfo:\n  alias: 猫猫\n---\n';

/**
 * Archive metadata carrying entry id as visible name.
 */
const FRONT_MATTER_TARGET = '---\nname: CatFrontMatter\ninfo:\n  alias: Maomao\n---\n';

/**
 * Source-faithful metadata rendering scripted for ensemble.
 */
const FRONT_MATTER_FRESH = '---\nname: Maomao\ninfo:\n  alias: Maomao\n---\n';

/**
 * Entry exercising complete metadata publication path.
 */
const FRONT_MATTER_ENTRY = {
  id: 'CatFrontMatter',
  sourceText: FRONT_MATTER_SOURCE,
  targetText: FRONT_MATTER_TARGET,
};

/**
 * Entry inserting source metadata into target page that has none.
 */
const FRONT_MATTER_SOURCE_ONLY_ENTRY = {
  id: 'CatFrontMatterInsertion',
  sourceText: `${FRONT_MATTER_SOURCE}${SOURCE_TEXT}`,
  targetText: TARGET_TEXT,
};

/**
 * Entry whose archive carries invisible separator outside replacements.
 */
const INVISIBLE_ENTRY = {
  id: 'CatEntryInvisible',
  sourceText: SOURCE_TEXT,
  targetText: TARGET_TEXT.replace('## Section two', '\uFEFF## Section two',),
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
 * Visual reference whose asset is intentionally absent from pinned corpus.
 */
const MISSING_VISUAL = `<PhotoScroll photos={[ '\${path}/photos/missing.webp' ]} />`;

/**
 * Entry proving unresolved referenced visual stops before lanes.
 */
const MISSING_VISUAL_ENTRY = {
  id: 'CatEntryMissingVisual',
  sourceText: `${SOURCE_TEXT}\n\n${MISSING_VISUAL}\n`,
  targetText: `${TARGET_TEXT}\n\n${MISSING_VISUAL}\n`,
};

/**
 * Original carrying a linked factual paragraph absent from archive.
 */
const GAP_SOURCE_TEXT = `${SOURCE_TEXT}
> The cat said goodbye.
>
> Thank you all.

The cat's final [record](https://example.test/cat-record) says she died at age 26.
`;

/**
 * Archive preserving quoted letter and omitting factual paragraph after it.
 */
const GAP_TARGET_TEXT = `${TARGET_TEXT}
> The cat said goodbye.
>
> Thank you all.
`;

/**
 * Entry reproducing known source gap at publication seam.
 */
const GAP_ENTRY = {
  id: 'CatEntryGap',
  sourceText: GAP_SOURCE_TEXT,
  targetText: GAP_TARGET_TEXT,
};

/**
 * Gap plus reviewed visual for successful guard traversal control.
 */
const REVIEWED_VISUAL_ENTRY = {
  id: 'CatEntryReviewedVisual',
  sourceText: `${GAP_SOURCE_TEXT}\n\n${MISSING_VISUAL}\n`,
  targetText: `${GAP_TARGET_TEXT}\n\n${MISSING_VISUAL}\n`,
};

/**
 * Rendering scripted for linked source-only paragraph once admitted.
 */
const GAP_FRESH = "The cat's final [record](https://example.test/cat-record) says she died at age 26.";

/**
 * Entry whose source-only block is already rendered inside target page.
 */
const CARRIED_ENTRY = {
  id: 'CatEntryCarriedGap',
  sourceText: GAP_SOURCE_TEXT,
  targetText: `${GAP_TARGET_TEXT}\n${GAP_FRESH}\n`,
};

/**
 * Coverage behavior of pass fixture.
 */
type CoverageScript = 'lost' | 'absent' | 'full';

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
  if (content.includes('name: 猫猫',))
    return FRONT_MATTER_FRESH;
  if (content.includes('第一节',))
    return `## Section one\n\n${FRESH}`;
  if (content.includes('第二节',))
    return `## Section two\n\n${BIRD_FRESH}`;
  if (content.includes('cat-record',))
    return GAP_FRESH;
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
    if (Number.isInteger(index,)
      && (block.includes(POLISH_FINAL_NEEDLE,)
        || block.includes(POLISH_BASE_NEEDLE,)
        || block.includes(FRESH,)
        || block.includes(BIRD_FRESH,)
        || block.includes(GAP_FRESH,)
        || block.includes(FRONT_MATTER_FRESH,)))
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
 * @param coverageScript - whether coverage roster answers absent or loses voice
 *
 * @param consolidation - whether translation schema belongs to third rendering
 *
 * @param polishScript - whether final naturalness rewrite is exercised
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
    coverageScript,
    consolidation = false,
    polishScript = false,
  }: {
    readonly schema: string;
    readonly content: string;
    readonly coverageScript: CoverageScript;
    readonly consolidation?: boolean;
    readonly polishScript?: boolean;
  },
): unknown {
  // THE PAIRING ROUND RUNS BEFORE EITHER LANE, so the script has to serve it or
  // every entry falls back to scoring and, worse, a resumed entry re-buys the
  // round it could not cache. An empty pairing is a legal answer meaning nothing
  // corresponds, which keeps this fixture's slicing exactly as it was before the
  // stage existed.
  if (schema === 'block_pairing') {
    return content.includes('cat-record',)
      ? { pairs: [{ source: 0, target: 0, },], }
      : { pairs: [], };
  }
  if (schema === 'coverage_report') {
    if (coverageScript === 'lost')
      throw new Error('scripted coverage voice lost',);
    return coverageScript === 'full'
      ? {
        coverage: 'full',
        quote: GAP_FRESH,
        reason: 'scripted source passage carried',
      }
      : {
        coverage: 'none',
        quote: '',
        reason: 'scripted source passage absent',
      };
  }
  if (schema === 'critic_report')
    return { issues: [], };
  if (schema === 'refine_report') {
    return (polishScript && content.includes(POLISH_BASE_NEEDLE,))
      ? {
        rewrites: [{
          paragraph: 1,
          newText: POLISH_FINAL_PARAGRAPH,
        },],
      }
      : { rewrites: [], };
  }
  if (schema === 'translation_report') {
    if (polishScript
      && (consolidation || content.includes('CANDIDATE "repair"',))
      && content.includes('第一节',))
      return { translation: POLISH_BASE, };
    return { translation: renderingFor({ content, },), };
  }
  if (schema === 'candidate_ballot') {
    return {
      best: pickCandidate({ content, },),
      reason: 'scripted',
    };
  }

  // THE CONTEST RUNS AFTER BOTH LANES, over the slices they worded differently.
  // Serving it is what makes this fixture exercise a DECIDED contest rather than
  // an unheard one: without a script every voice is lost, the roster never
  // reaches quorum, and the artifact records the pass reaching the stage instead
  // of the stage reaching an answer.
  if (schema === 'lane_contest') {
    return {
      choice: 'translate',
      unsupported: [],
      dropped: [],
      reason: 'scripted',
    };
  }
  if (schema === 'consolidate_gate') {
    return {
      choice: 'consolidated',
      unsupported: [],
      dropped: [],
      reason: 'scripted consolidation gate',
    };
  }
  if (schema === 'consolidation_polish_gate') {
    return {
      choice: 'polished',
      unsupported: [],
      dropped: [],
      reason: 'scripted fidelity-first naturalness gate',
    };
  }
  if (schema === 'absolute_naturalness_review') {
    return {
      acceptable: true,
      findings: [],
      reason: 'whole candidate is publication-ready',
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
 * @param activity - optional admission instrument for every per-slice driver
 *
 * @param coverageScript - whether coverage roster answers or loses every voice
 *
 * @param polishScript - whether final naturalness rewrite is exercised
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
    activity,
    coverageScript = 'lost',
    polishScript = false,
  }: {
    readonly served: string[];
    readonly failOnSchema?: string;
    readonly activity?: PassConcurrency;
    readonly coverageScript?: CoverageScript;
    readonly polishScript?: boolean;
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
       * Whether shared translation schema belongs to consolidation producer.
       */
      const isConsolidation = (schema === 'translation_report')
        && content.includes('Two English renderings of this passage already exist',);

      /**
       * Instrument matching this request's per-slice driver.
       */
      const stageActivity = schema === 'critic_report'
        ? activity?.repair
        : schema === 'refine_report'
        ? activity?.refine
        : schema === 'lane_contest'
        ? activity?.contest
        : isConsolidation
        ? activity?.consolidate
        : schema === 'translation_report'
        ? activity?.translate
        : undefined;
      if (stageActivity !== undefined) {
        stageActivity.now += 1;
        stageActivity.peak = Math.max(
          stageActivity.peak,
          stageActivity.now,
        );
        await wait(10,);
        stageActivity.now -= 1;
      }

      /**
       * Reply for whichever stage asked, keyed by its schema.
       */
      const value: unknown = replyFor({
        schema,
        content,
        coverageScript,
        consolidation: isConsolidation,
        polishScript,
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
 * Throwaway artifacts, publish and cache directories for one case.
 *
 * @returns Every directory a settling entry writes into, plus how to remove them
 *
 * @example
 * ```ts
 * await using dirs = await throwawayDirs();
 * ```
 */
async function throwawayDirs(): Promise<
  {
    readonly artifactsDir: string;
    readonly publishDir: string;
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
  /**
   * Root of the mirrored corpus tree, created here for the same reason the
   * artifacts directory is: the PASS creates it before settling anything, so a
   * case that left it out would be measuring how the publisher behaves against
   * a missing root rather than how it publishes.
   */
  const publishDir = join(
    root,
    'fixed',
  );
  await mkdir(
    publishDir,
    { recursive: true, },
  );

  return {
    artifactsDir,
    publishDir,
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
  // Environment dial is process-wide, so matched arms and every other case in
  // this file run one at a time rather than reading each other's settings.
  concurrency: 1,
  children: [
    it({
      name: 'reads the environment overlap once per entry and threads it through repair, '
        + 'translate, contest, and consolidation, after sequential positive controls prove '
        + 'each stage instrument distinguishes one slice from two',
      fn: async () => {
        /**
         * Activity with explicit sequential control arm.
         */
        const serial = emptyPassConcurrency();
        {
          using dial = overlapDial({ says: '1', },);
          await using dirs = await throwawayDirs();
          await settleEntry({
            client: entryClient({
              served: [],
              activity: serial,
            },),
            entry: {
              ...ENTRY,
              id: 'CatOverlapSerial',
            },
            artifactsDir: dirs.artifactsDir,
            publishDir: dirs.publishDir,
            sliceCacheDir: dirs.sliceCacheDir,
            tip: 'a'.repeat(40,),
            pipelineDigest: DIGEST,
            hardCapMs: 60_000,
            baseSignal: new AbortController().signal,
          },);
          expect(dial,).not.toBe(undefined,);
        }

        /**
         * Activity with two slices requested by environment.
         */
        const overlapped = emptyPassConcurrency();
        {
          using dial = overlapDial({ says: '2', },);
          await using dirs = await throwawayDirs();
          await settleEntry({
            client: entryClient({
              served: [],
              activity: overlapped,
            },),
            entry: {
              ...ENTRY,
              id: 'CatOverlapTwo',
            },
            artifactsDir: dirs.artifactsDir,
            publishDir: dirs.publishDir,
            sliceCacheDir: dirs.sliceCacheDir,
            tip: 'a'.repeat(40,),
            pipelineDigest: DIGEST,
            hardCapMs: 60_000,
            baseSignal: new AbortController().signal,
          },);
          expect(dial,).not.toBe(undefined,);
        }

        expect(serial.repair.peak,).toBeGreaterThan(0,);
        expect(overlapped.repair.peak,).toBeGreaterThan(serial.repair.peak,);
        expect(serial.refine.peak,).toBeGreaterThan(0,);
        expect(overlapped.refine.peak,).toBeGreaterThan(serial.refine.peak,);
        expect(serial.translate.peak,).toBeGreaterThan(0,);
        expect(overlapped.translate.peak,).toBeGreaterThan(serial.translate.peak,);
        expect(serial.contest.peak,).toBeGreaterThan(0,);
        expect(overlapped.contest.peak,).toBeGreaterThan(serial.contest.peak,);
        expect(serial.consolidate.peak,).toBeGreaterThan(0,);
        expect(overlapped.consolidate.peak,).toBeGreaterThan(serial.consolidate.peak,);
      },
    },),

    it({
      name: 'STOPS BEFORE LANES when referenced visual asset has no reviewed evidence',
      fn: async () => {
        await using dirs = await throwawayDirs();
        /** Schemas reached before visual completeness guard. */
        const served: string[] = [];
        /** Entry outcome captured inside logger scope. */
        const result: { outcome?: Awaited<ReturnType<typeof settleEntry>>; } = {};
        const lines = await capturedLines({
          body: async () => {
            result.outcome = await settleEntry({
              client: entryClient({ served, },),
              entry: MISSING_VISUAL_ENTRY,
              artifactsDir: dirs.artifactsDir,
              publishDir: dirs.publishDir,
              sliceCacheDir: dirs.sliceCacheDir,
              tip: 'a'.repeat(40,),
              pipelineDigest: DIGEST,
              hardCapMs: 60_000,
              baseSignal: new AbortController().signal,
            },);
          },
        },);
        expect(result.outcome,).toEqual({ kind: 'stopped', },);
        expect(served,).not.toContain('coverage_report',);
        expect(served,).not.toContain('critic_report',);
        expect(served,).not.toContain('translation_report',);
        expect(served,).not.toContain('lane_contest',);
        expect(await artifactNames({ artifactsDir: dirs.artifactsDir, },),).toEqual([],);
        expect(await artifactNames({ artifactsDir: dirs.publishDir, },),).toEqual([],);
        expect(lines.some(function incomplete(line,): boolean {
          return line.startsWith(`TALLY ${MISSING_VISUAL_ENTRY.id} status=INCOMPLETE`,);
        },),).toBe(true,);
      },
    },),

    it({
      name: 'PASSES REVIEWED VISUAL into insertion and lane stages',
      fn: async () => {
        await using dirs = await throwawayDirs();
        /** Schemas reached after successful visual completeness guard. */
        const served: string[] = [];
        await settleEntry({
          client: entryClient({
            served,
            coverageScript: 'absent',
          },),
          entry: REVIEWED_VISUAL_ENTRY,
          artifactsDir: dirs.artifactsDir,
          publishDir: dirs.publishDir,
          sliceCacheDir: dirs.sliceCacheDir,
          tip: 'a'.repeat(40,),
          pipelineDigest: DIGEST,
          hardCapMs: 60_000,
          baseSignal: new AbortController().signal,
          visualEvidenceReader: async function reviewedVisualEvidence() {
            return new Map([[
              'missing.webp',
              {
                kind: 'corroborated',
                readings: [
                  { modelId: 'hf:moonshotai/Kimi-K3', text: 'Mittens 555-0134', },
                  { modelId: 'hf:zai-org/GLM-5.3-Flash', text: 'Mittens 555-0134', },
                ],
                overlap: 1,
              },
            ],]);
          },
        },);
        expect(served,).toContain('coverage_report',);
        expect(served,).toContain('critic_report',);
        expect(served,).toContain('translation_report',);
      },
    },),

    it({
      name:
        'settles an entry into ONE artifact at schema version 9 carrying BOTH lanes and absolute-reviewed '
        + 'final polish over one preparation',
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
          publishDir: dirs.publishDir,
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
        expect((artifact as { artifactSchemaVersion: number; }).artifactSchemaVersion,).toBe(9,);
        expect(Object.keys((artifact as { lanes: object; }).lanes,)
          .toSorted(),).toEqual([
          'repair',
          'translate',
        ],);
        /**
         * Consolidation records carrying auditable polish decision.
         */
        const { consolidation, } = artifact as {
          consolidation: { slices: readonly { polish?: unknown; }[]; };
        };
        expect(consolidation.slices.every(function hasPolish(slice,): boolean {
          return slice.polish !== undefined;
        },),).toBe(true,);

        // THE STAMP AND THE SPELLING, checked together on the bytes. A writer
        // that stamped generation 7 and wrote an earlier generation's keys
        // would satisfy the assertion above and produce a file its own reader
        // refuses, and every fixture in this package would still pass: they are
        // built by hand from the same names the writer uses.
        /**
         * Repair lane's result as the file records it.
         */
        const repairResult = (artifact as {
          lanes: { repair: { result: Record<string, unknown>; }; };
        })
          .lanes
          .repair
          .result;

        for (const present of ['changedSliceIndices', 'withdrawnSliceIndices', 'sliceCritics',]) {
          expect(Object.hasOwn(
            repairResult,
            present,
          ),).toBe(true,);
        }
        for (const absent of ['shippedChunkIndices', 'withdrawnChunkIndices', 'chunkCritics',]) {
          expect(Object.hasOwn(
            repairResult,
            absent,
          ),).toBe(false,);
        }

        // THE INDEX IS THE HALF GENERATION 3 DID NOT CARRY, and it is spelled
        // on the ledger rows rather than beside those arrays. An artifact
        // stamped 4 whose rows still say `chunkIndex` is exactly generation 3,
        // and every assertion above it here would pass.
        /**
         * Repair lane's first ledger row as the file records it.
         */
        const [firstRow,] = (artifact as {
          lanes: { repair: { delivery: readonly Record<string, unknown>[]; }; };
        })
          .lanes
          .repair
          .delivery;

        /**
         * That row, present because this entry settled slices.
         */
        const repairRow = nonNullishOrThrow(firstRow,);

        expect(Object.hasOwn(
          repairRow,
          'sliceIndex',
        ),).toBe(true,);
        expect(Object.hasOwn(
          repairRow,
          'chunkIndex',
        ),).toBe(false,);
        // A CONTEST THAT RAN AND DECIDED, end to end through the pass. The two
        // lanes disagree at both slices by construction, and the scripted
        // roster backs each translate candidate.
        /**
         * Contest as the file records it, read structurally like the rest.
         */
        const selection = (artifact as {
          laneSelection: {
            kind: string;
            slices: readonly {
              verdict: {
                readonly kind: string;
                readonly lane?: string;
              };
              ballots: readonly unknown[];
            }[];
          };
        }).laneSelection;
        expect(selection.kind,).toBe('contested',);
        expect(selection.slices
          .length,).toBe(2,);
        expect(selection.slices.every(function choseTranslate(slice,) {
          return (slice.verdict.kind === 'lane-won')
            && (slice.verdict.lane === 'translate');
        },),).toBe(true,);
        // AND THE BALLOTS REACHED THE FILE, which is the half a verdict alone
        // does not prove: a reader asking why this slice went to the translate
        // lane needs the reasons the judges gave, not just the count.
        expect(selection.slices
          .at(0,)
          ?.ballots
          .length,).toBeGreaterThan(1,);

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
      name: 'PUBLISHES CHANGED FINAL POLISH through artifact parser and page assembly',
      fn: async () => {
        await using dirs = await throwawayDirs();
        /**
         * Schemas reached by full polished pass.
         */
        const served: string[] = [];
        await settleEntry({
          client: entryClient({
            served,
            polishScript: true,
          },),
          entry: ENTRY,
          artifactsDir: dirs.artifactsDir,
          publishDir: dirs.publishDir,
          sliceCacheDir: dirs.sliceCacheDir,
          tip: 'a'.repeat(40,),
          pipelineDigest: DIGEST,
          hardCapMs: 60_000,
          baseSignal: new AbortController().signal,
        },);
        /**
         * Serialized artifact through production parser.
         */
        const artifact = parseSettledTwoLaneArtifact({
          value: JSON.parse(await readFile(
            join(dirs.artifactsDir, 'CatEntry1.json',),
            'utf8',
          ),),
        },);
        if (artifact.consolidation.kind !== 'settled')
          throw new Error('polished pass did not record consolidation',);
        /**
         * Changed polish record for first slice.
         */
        const polish = artifact.consolidation.slices
          .find(function firstSlice(slice,): boolean {
            return slice.sliceIndex === 0;
          },)
          ?.polish;
        expect(polish?.kind,).toBe('settled',);
        expect(polish?.kind === 'settled' ? polish.changed : false,).toBe(true,);
        expect(polish?.kind === 'settled' ? polish.text : '',).toContain(POLISH_FINAL_PARAGRAPH,);
        expect(polish?.kind === 'settled' ? polish.review?.rounds.at(-1,)?.verdict : '',).toBe('acceptable',);
        /**
         * Page persisted from parsed decision stack.
         */
        const page = await readFile(fixedPagePath({
          publishDir: dirs.publishDir,
          entryId: ENTRY.id,
        },), 'utf8',);
        expect(page,).toContain(POLISH_FINAL_PARAGRAPH,);
        expect(page,).not.toContain(POLISH_BASE_PARAGRAPH,);
        expect(served,).toContain('consolidation_polish_gate',);
        expect(served,).toContain('absolute_naturalness_review',);
      },
    },),
    it({
      name: 'PUBLISHES SOURCE-ALIGNED FRONT MATTER THROUGH LANES, CONTEST, ARTIFACT READBACK, AND PAGE WRITE',
      fn: async () => {
        await using dirs = await throwawayDirs();
        /**
         * Model schemas reached across complete entry boundary.
         */
        const served: string[] = [];
        await settleEntry({
          client: entryClient({ served, },),
          entry: FRONT_MATTER_ENTRY,
          artifactsDir: dirs.artifactsDir,
          publishDir: dirs.publishDir,
          sliceCacheDir: dirs.sliceCacheDir,
          tip: 'a'.repeat(40,),
          pipelineDigest: DIGEST,
          hardCapMs: 60_000,
          baseSignal: new AbortController().signal,
        },);

        /**
         * Serialized artifact read through production parser.
         */
        const artifact = parseSettledTwoLaneArtifact({
          value: JSON.parse(await readFile(
            join(dirs.artifactsDir, 'CatFrontMatter.json',),
            'utf8',
          ),),
        },);
        /**
         * Page persisted before artifact sentinel.
         */
        const page = await readFile(fixedPagePath({
          publishDir: dirs.publishDir,
          entryId: FRONT_MATTER_ENTRY.id,
        },), 'utf8',);

        expect(artifact.artifactSchemaVersion,).toBe(9,);
        expect(artifact.preparation.sliceCount,).toBe(1,);
        if (artifact.laneSelection.kind !== 'contested')
          throw new Error('front matter pass did not record lane contest',);
        expect(artifact.laneSelection.slices[0]?.eligibility,).toEqual({
          syntax: 'front-matter',
          sourceText: FRONT_MATTER_SOURCE,
          archive: 'ineligible',
          repair: 'ineligible',
          translate: 'eligible',
        },);
        expect(page,).toBe(FRONT_MATTER_FRESH,);
        expect(served,).toContain('translation_report',);
        expect(served,).toContain('candidate_ballot',);
        expect(served,).toContain('lane_contest',);
      },
    },),
    it({
      name: 'INSERTS SOURCE-ONLY FRONT MATTER through complete pass',
      fn: async () => {
        await using dirs = await throwawayDirs();
        const served: string[] = [];
        const outcome = await settleEntry({
          client: entryClient({
            served,
            coverageScript: 'absent',
          },),
          entry: FRONT_MATTER_SOURCE_ONLY_ENTRY,
          artifactsDir: dirs.artifactsDir,
          publishDir: dirs.publishDir,
          sliceCacheDir: dirs.sliceCacheDir,
          tip: 'a'.repeat(40,),
          pipelineDigest: DIGEST,
          hardCapMs: 60_000,
          baseSignal: new AbortController().signal,
        },);
        expect(outcome,).toEqual({ kind: 'settled', },);
        const page = await readFile(fixedPagePath({
          publishDir: dirs.publishDir,
          entryId: FRONT_MATTER_SOURCE_ONLY_ENTRY.id,
        },), 'utf8',);
        expect(page.startsWith(FRONT_MATTER_FRESH,)).toBe(true,);
        expect(served,).not.toContain('coverage_report',);
        expect(served,).toContain('translation_report',);
      },
    },),
    it({
      name: 'FOLDS inherited invisible archive variants before preparation, so deciders, artifact and '
        + 'published page all carry same visible bytes',
      fn: async () => {
        await using dirs = await throwawayDirs();
        await settleEntry({
          client: entryClient({ served: [], },),
          entry: INVISIBLE_ENTRY,
          artifactsDir: dirs.artifactsDir,
          publishDir: dirs.publishDir,
          sliceCacheDir: dirs.sliceCacheDir,
          tip: 'a'.repeat(40,),
          pipelineDigest: DIGEST,
          hardCapMs: 60_000,
          baseSignal: new AbortController().signal,
        },);

        const artifact = await readFile(
          join(dirs.artifactsDir, `${INVISIBLE_ENTRY.id}.json`,),
          'utf8',
        );
        const page = await readFile(
          fixedPagePath({
            publishDir: dirs.publishDir,
            entryId: INVISIBLE_ENTRY.id,
          },),
          'utf8',
        );
        expect(artifact,).not.toContain('\uFEFF',);
        expect(page,).not.toContain('\uFEFF',);
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
          publishDir: dirs.publishDir,
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
        'PUBLISHES THE PAGE BEFORE THE ARTIFACT, so an entry the pass will never look at again always '
        + 'has one. A pass builds its skip set from the artifacts already on disk, which makes the '
        + 'artifact the sentinel for "done": written first, a crash before publishing would strand '
        + 'that entry done forever with no page. The write that fails here is the artifact write, and '
        + 'the page is on disk regardless',
      fn: async () => {
        await using dirs = await throwawayDirs();

        /**
         * Schemas the run served before the write failed.
         */
        const served: string[] = [];

        // The SAME failure the case above uses, for the opposite assertion: a
        // directory that does not exist fails the artifact write and nothing
        // before it.
        await settleEntry({
          client: entryClient({ served, },),
          entry: ENTRY,
          artifactsDir: join(
            dirs.artifactsDir,
            'not-created',
          ),
          publishDir: dirs.publishDir,
          sliceCacheDir: dirs.sliceCacheDir,
          tip: 'a'.repeat(40,),
          pipelineDigest: DIGEST,
          hardCapMs: 60_000,
          baseSignal: new AbortController().signal,
        },);

        // Nothing says this entry settled, so a later pass attempts it again.
        expect(await artifactNames({ artifactsDir: dirs.artifactsDir, },),).toEqual([],);

        /**
         * This entry's page, which has to exist even though its artifact does not.
         */
        const published = await readFile(
          fixedPagePath({
            publishDir: dirs.publishDir,
            entryId: ENTRY.id,
          },),
          'utf8',
        );

        // A whole page rather than a stub: both of the archive's sections are
        // in it, so what landed is the document and not one settled slice.
        expect(published.includes('## Section one',),).toBe(true,);
        expect(published.includes('## Section two',),).toBe(true,);
      },
    },),
    it({
      name: 'PAUSES before lanes when coverage cannot resolve known source-gap placement',
      fn: async () => {
        await using dirs = await throwawayDirs();
        /**
         * Schemas reached before completeness guard stops downstream stages.
         */
        const served: string[] = [];
        const lines = await capturedLines({
          body: async () => {
            await settleEntry({
              client: entryClient({ served, },),
              entry: GAP_ENTRY,
              artifactsDir: dirs.artifactsDir,
              publishDir: dirs.publishDir,
              sliceCacheDir: dirs.sliceCacheDir,
              tip: 'a'.repeat(40,),
              pipelineDigest: DIGEST,
              hardCapMs: 60_000,
              baseSignal: new AbortController().signal,
            },);
          },
        },);

        expect(served,).toContain('coverage_report',);
        expect(served,).not.toContain('lane_contest',);
        expect(await artifactNames({ artifactsDir: dirs.artifactsDir, },),).toEqual([],);
        expect(await artifactNames({ artifactsDir: dirs.publishDir, },),).toEqual([],);
        expect(await artifactNames({ artifactsDir: dirs.sliceCacheDir, },),).toEqual([GAP_ENTRY.id,],);
        const tally = lines.filter(function forGapEntry(line,): boolean {
          return line.startsWith(`TALLY ${GAP_ENTRY.id} `,);
        },);
        expect(tally,).toHaveLength(1,);
        expect(tally[0],).toContain('status=INCOMPLETE',);
      },
    },),
    it({
      name: 'PUBLISHES source-only passage proven carried elsewhere when final page retains proof region',
      fn: async () => {
        await using dirs = await throwawayDirs();
        const served: string[] = [];
        const outcome = await settleEntry({
          client: entryClient({
            served,
            coverageScript: 'full',
          },),
          entry: CARRIED_ENTRY,
          artifactsDir: dirs.artifactsDir,
          publishDir: dirs.publishDir,
          sliceCacheDir: dirs.sliceCacheDir,
          tip: 'a'.repeat(40,),
          pipelineDigest: DIGEST,
          hardCapMs: 60_000,
          baseSignal: new AbortController().signal,
        },);

        expect(outcome,).toEqual({ kind: 'settled', },);
        expect(served,).toContain('coverage_report',);
        const page = await readFile(
          fixedPagePath({
            publishDir: dirs.publishDir,
            entryId: CARRIED_ENTRY.id,
          },),
          'utf8',
        );
        expect(page,).toContain(GAP_FRESH,);
      },
    },),
    it({
      name: 'PAUSES when coverage admits source gap but every translator voice is lost',
      fn: async () => {
        await using dirs = await throwawayDirs();
        const served: string[] = [];
        const outcome = await settleEntry({
          client: entryClient({
            served,
            failOnSchema: 'translation_report',
            coverageScript: 'absent',
          },),
          entry: GAP_ENTRY,
          artifactsDir: dirs.artifactsDir,
          publishDir: dirs.publishDir,
          sliceCacheDir: dirs.sliceCacheDir,
          tip: 'a'.repeat(40,),
          pipelineDigest: DIGEST,
          hardCapMs: 60_000,
          baseSignal: new AbortController().signal,
        },);

        expect(outcome,).toEqual({ kind: 'stopped', },);
        expect(served,).toContain('coverage_report',);
        expect(served,).not.toContain('lane_contest',);
        expect(await artifactNames({ artifactsDir: dirs.artifactsDir, },),).toEqual([],);
        expect(await artifactNames({ artifactsDir: dirs.publishDir, },),).toEqual([],);
      },
    },),
    it({
      name: 'ADMITS and publishes a linked factual source gap when production coverage says it is absent, '
        + 'proving admission reaches translate lane rather than stopping at pass preparation',
      fn: async () => {
        await using dirs = await throwawayDirs();
        const served: string[] = [];
        await settleEntry({
          client: entryClient({
            served,
            coverageScript: 'absent',
          },),
          entry: {
            ...GAP_ENTRY,
            id: 'CatEntryGapRecovered',
          },
          artifactsDir: dirs.artifactsDir,
          publishDir: dirs.publishDir,
          sliceCacheDir: dirs.sliceCacheDir,
          tip: 'a'.repeat(40,),
          pipelineDigest: DIGEST,
          hardCapMs: 60_000,
          baseSignal: new AbortController().signal,
        },);

        expect(served,).toContain('coverage_report',);
        expect(await artifactNames({ artifactsDir: dirs.artifactsDir, },),)
          .toEqual(['CatEntryGapRecovered.json',],);
        const artifact = await readFile(
          join(dirs.artifactsDir, 'CatEntryGapRecovered.json',),
          'utf8',
        );
        const page = await readFile(
          fixedPagePath({
            publishDir: dirs.publishDir,
            entryId: 'CatEntryGapRecovered',
          },),
          'utf8',
        );
        expect(artifact,).toContain('insertion-corroboration',);
        expect(page,).toContain(GAP_FRESH,);
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
          publishDir: dirs.publishDir,
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
          publishDir: dirs.publishDir,
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
          publishDir: dirs.publishDir,
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
          publishDir: dirs.publishDir,
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
          publishDir: dirs.publishDir,
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
              publishDir: dirs.publishDir,
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

        /**
         * Slice-overlap launch lines it produced.
         */
        const overlaps = mine.filter(function isOverlap(line,): boolean {
          return line.startsWith('OVERLAP ',);
        },);
        expect(overlaps,).toEqual([
          `OVERLAP ${CLEANUP_ENTRY.id} value=1 source=fallback`,
        ],);
        expect(cleanups.length,).toBe(1,);
        expect(cleanups[0]?.includes('cache=retained',),).toBe(true,);
        // The unlink failure is an unmarked Node error, so the line names its
        // class and never repeats its message, which carries a path (`#237`).
        expect(cleanups[0]?.includes('error=refused by ',),).toBe(true,);
        expect(cleanups[0]?.includes('permission denied',),).toBe(false,);

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
