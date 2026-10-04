/**
 Tests for which files `editor-standing-read` counts as artifacts.

 RUN AS AN OPERATOR RUNS IT, since the module exports nothing to call
 directly: every case writes a throwaway archive, runs the built command over
 it, and reads the summary line.

 AN ARTIFACT IS A REGULAR FILE. The census and the scheduler list only regular
 files named `*.json`, and this reader took every such NAME, so a directory
 called `Tabby.json` was read as JSON and reported refused, and a symlink was
 followed to whatever it named and counted a second time (ledger B64). The
 command lists two layouts, an archive's own `artifacts/` directory and an
 archive that is itself the artifacts directory, so each layout has a case.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import { spawnSync, } from 'node:child_process';
import {
  mkdir,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { scratchDirWith, } from '../scratch-dir.test-fixture.ts';
import { SEAT_SYNTHETIC_VISION_WITHHELD, } from '../roster-seats.test-fixture.ts';

//region Editor standing read listing tests

/**
 Command under test.
 */
const STANDING_COMMAND = 'editor-standing-read';

/**
 Built entry point for {@link STANDING_COMMAND}.
 */
const STANDING_ENTRY = join(
  import.meta.dirname,
  '..',
  '..',
  'dist',
  'final',
  'node',
  `${STANDING_COMMAND}.mjs`,
);

/**
 What the command left on its two streams.
 */
type StandingStreams = {
  /**
   Everything the command wrote to stdout, where the summary line goes.
   */
  readonly stdout: string;

  /**
   Everything the command wrote to stderr, where refusals go.
   */
  readonly stderr: string;
};

/**
 Writes one throwaway archive holding a real artifact, a directory named like
 one, and a symlink named like one.

 @param nested - whether the artifacts sit in the archive's `artifacts/`
 directory, which is what a pass writes, rather than in the archive itself

 @returns Archive path, removed on dispose

 @example
 ```ts
 await using fixture = await throwawayArchive({ nested: true, },);
 ```
 */
async function throwawayArchive(
  { nested, }: { readonly nested: boolean; },
): Promise<AsyncDisposable & { readonly archive: string; }> {
  // Throwaway archive, never a real runs directory.
  return await scratchDirWith({
    prefix: 'editor-standing-read-',
    setup: async function seeded({ path: archive, },): Promise<{ readonly archive: string; }> {
      /**
       Directory the fixture artifacts go into.
       */
      const artifactsDir = nested
        ? join(
          archive,
          'artifacts',
        )
        : archive;

      await mkdir(
        artifactsDir,
        { recursive: true, },
      );
      await writeFile(
        join(
          artifactsDir,
          'Mittens.json',
        ),
        '{}',
        'utf8',
      );
      await mkdir(join(
        artifactsDir,
        'Tabby.json',
      ),);
      await symlink(
        'Mittens.json',
        join(
          artifactsDir,
          'Siamese.json',
        ),
      );

      return { archive, };
    },
  },);
}

/**
 Runs the command over one archive.

 A NON-ZERO EXIT IS THE COMMAND'S OWN VERDICT HERE: it exits 1 when nothing it
 read recorded a judged round, which this fixture never does. `spawnSync`
 reports that status rather than throwing on it.

 @param archive - archive the command reads

 @returns Both streams as the command left them

 @throws Error where the command never started, so no case reads two empty
 streams as a clean report

 @example
 ```ts
 const { stdout, } = standingOver({ archive: fixture.archive, },);
 ```
 */
function standingOver(
  { archive, }: { readonly archive: string; },
): StandingStreams {
  /**
   Command as it finished, or why it never started.
   */
  const finished = spawnSync(
    process.execPath,
    [
      STANDING_ENTRY,
      archive,
    ],
    { encoding: 'utf8', },
  );

  if (finished.error !== undefined)
    throw new Error(
      `the command never started, so nothing here was exercised (${finished.error.name})`,
    );

  return {
    stdout: finished.stdout,
    stderr: finished.stderr,
  };
}

/**
 Writes one throwaway run carrying exactly one artifact, and runs the command
 over it.

 @param artifact - artifact value to write as `Mittens.json`

 @returns Both streams as the command left them

 @throws Error where the command never started

 @example
 ```ts
 const { stdout, } = standingOverArtifact({ artifact, },);
 ```
 */
async function standingOverArtifact(
  { artifact, }: { readonly artifact: unknown; },
): Promise<StandingStreams> {
  return await scratchDirWith({
    prefix: 'editor-standing-read-',
    setup: async function seeded({ path, },): Promise<StandingStreams> {
      await mkdir(join(path, 'artifacts',), { recursive: true, },);
      await writeFile(
        join(path, 'artifacts', 'Mittens.json',),
        JSON.stringify(artifact,),
        'utf8',
      );
      return standingOver({ archive: path, });
    },
  },);
}

await describe({
  name: STANDING_COMMAND,
  children: [
    it({
      name: 'COUNTS only the regular file in an archive\'s artifacts directory, skipping a directory and a '
        + 'symlink named like an artifact (ledger B64)',
      fn: async () => {
        await using fixture = await throwawayArchive({ nested: true, },);
        const { stdout, stderr, } = standingOver({ archive: fixture.archive, },);
        expect(stdout.includes('archives=1 artifacts=1 ',),).toBe(true,);
        expect(stderr.includes('Tabby.json',),).toBe(false,);
      },
    },),

    it({
      name: 'COUNTS only the regular file in an archive that is itself the artifacts directory (ledger B64)',
      fn: async () => {
        await using fixture = await throwawayArchive({ nested: false, },);
        const { stdout, stderr, } = standingOver({ archive: fixture.archive, },);
        expect(stdout.includes('archives=1 artifacts=1 ',),).toBe(true,);
        expect(stderr.includes('Tabby.json',),).toBe(false,);
      },
    },),

    it({
      name: 'SAYS NOTHING WAS FOUND where the run directory will not read at all, rather than reading an '
        + 'empty standing',
      fn: async () => {
        await using fixture = await scratchDirWith({
          prefix: 'editor-standing-read-',
          setup: async function empty({ path, },): Promise<{ readonly archive: string; }> {
            return { archive: join(path, 'never-written',), };
          },
        },);
        const { stderr, } = standingOver({ archive: fixture.archive, },);
        expect(stderr.includes('no artifacts under',),).toBe(true,);
      },
    },),

    it({
      name: 'COUNTS an artifact whose chunks the schema predates as earlier-schema, and one naming a '
        + 'model the roster dropped as off-roster',
      fn: async () => {
        // The settled artifact the schema walk of 2026-10-04 mapped, with the
        // rounds the repair lane records under its result.
        const withoutRounds = {
          artifactSchemaVersion: 3,
          id: 'Mittens',
          tip: 'abc',
          pipelineDigest: `sha256-tree-v1:${'0'.repeat(64,)}`,
          corpusSha: 'a41fc607ea5a70d8a7625cc67d5ed8c444f53379',
          callConfig: {},
          durationMs: 1,
          timestamp: '2026-09-28T10:00:00.000Z',
          preparation: {
            alignmentPairCount: 1,
            identity: `sha256-preparation-v2:${'0'.repeat(64,)}`,
            sliceCount: 1,
            sourceChars: 1,
            targetChars: 1,
            sourceBytes: 1,
            alignmentFindings: [],
          },
          lanes: {
            repair: {
              result: {
                status: 'repaired',
                sliceCount: 1,
                changedSliceIndices: [0,],
                withdrawnSliceIndices: [],
                sliceTexts: [{
                  chunkIndex: 0,
                  incumbentKind: 'present',
                  incumbentText: 'x',
                  outcome: { kind: 'decided', acceptedText: 'y', },
                  text: 'y',
                },],
              },
              delivery: [{
                chunkIndex: 0,
                sourceText: 'x',
                incumbentKind: 'present',
                incumbentText: 'x',
                outcome: { kind: 'decided', acceptedText: 'y', },
                shippedText: 'y',
                delivery: { kind: 'replacement-shipped', },
              },],
            },
            translate: {
              result: {
                status: 'complete',
                sliceCount: 1,
                changedSliceCount: 1,
                withdrawnSliceCount: 0,
                changedSliceIndices: [0,],
                withdrawnSliceIndices: [],
                sliceTexts: [{
                  chunkIndex: 0,
                  incumbentKind: 'present',
                  incumbentText: 'x',
                  outcome: { kind: 'decided', acceptedText: 'y', },
                  text: 'y',
                },],
              },
              delivery: [{
                chunkIndex: 0,
                sourceText: 'x',
                incumbentKind: 'present',
                incumbentText: 'x',
                outcome: { kind: 'decided', acceptedText: 'y', },
                shippedText: 'y',
                delivery: { kind: 'replacement-shipped', },
              },],
            },
          },
          comparison: [{
            chunkIndex: 0,
            incumbentKind: 'present',
            incumbentText: 'x',
            repairText: 'y',
            translateText: 'y',
            laneRelation: 'both-agree',
            repairOutcome: { kind: 'decided', acceptedText: 'y', },
            translateOutcome: { kind: 'decided', acceptedText: 'y', },
            decisionComparison: { kind: 'comparable', verdict: 'same', },
            repairDelivery: { kind: 'replacement-shipped', },
            translateDelivery: { kind: 'replacement-shipped', },
          },],
          laneSelection: { kind: 'pending-human-decision', },
          consolidation: { kind: 'not-run', },
        };
        const round = {
          stage: 'chunk-patch',
          modelId: 'not-on-roster',
          kind: 'selected',
          envelopeId: 'env/1',
          slate: [{
            index: 1,
            producer: { kind: 'model', modelId: 'not-on-roster', },
            rendered: 'y',
            hash: 'h',
          },],
          ballots: [],
          tally: {
            judgesAvailable: 1,
            heard: 1,
            quorum: 1,
            probe: 1,
            ballots: 1,
            abstentions: 0,
            selfVotes: 0,
          },
          perCandidate: [],
          selectionReason: 'x',
          selectedIndex: 1,
          selectedText: 'y',
          judgeStatements: [],
          voteWeight: 1,
        };

        /**
         Runs whose artifact records no chunks and one whose round names a
         model the roster dropped.
         */
        const earlier = await standingOverArtifact({ artifact: withoutRounds, });
        expect(earlier.stdout.includes('earlierSchema=1',),).toBe(true,);
        const offRoster = await standingOverArtifact({
          artifact: {
            ...withoutRounds,
            lanes: {
              ...withoutRounds.lanes,
              repair: {
                ...withoutRounds.lanes.repair,
                result: {
                  ...withoutRounds.lanes.repair.result,
                  chunks: [{ rounds: [round,], },],
                },
              },
            },
          },
        },);
        expect(offRoster.stderr.includes('not-on-roster',),).toBe(true,);
        expect(offRoster.stdout.includes('earlierRoster=1',),).toBe(true,);

        /**
         Run whose round names a seated model, so the standing and its
         report render.
         */
        const seated = await standingOverArtifact({
          artifact: {
            ...withoutRounds,
            lanes: {
              ...withoutRounds.lanes,
              repair: {
                ...withoutRounds.lanes.repair,
                result: {
                  ...withoutRounds.lanes.repair.result,
                  chunks: [{
                    rounds: [{
                      ...round,
                      modelId: SEAT_SYNTHETIC_VISION_WITHHELD,
                      slate: [{
                        index: 1,
                        producer: { kind: 'model', modelId: SEAT_SYNTHETIC_VISION_WITHHELD, },
                        rendered: 'y',
                        hash: 'h',
                      },],
                    },],
                  },],
                },
              },
            },
          },
        },);
        expect(seated.stdout.includes('read=1',),).toBe(true,);
      },
    },),
  ],
},);

//endregion Editor standing read listing tests
