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

import { runBuiltCommand, } from '../child-environment.test-fixture.ts';
import { scratchDirWith, } from '../scratch-dir.test-fixture.ts';
import {
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  SEAT_SYNTHETIC_VISION_WITHHELD,
} from '../roster-seats.test-fixture.ts';

//region Editor standing read listing tests

/**
 Command under test.
 */
const STANDING_COMMAND = 'editor-standing-read';

/**
 What the command left on its two streams.
 */
type StandingStreams = {
  /**
   Exit code the command left behind, its own verdict on what it read.
   */
  readonly code: number;

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
 read recorded a judged round, which this fixture never does. The shared fixture
 reports that exit code rather than rejecting on it.

 @param archive - archive the command reads

 @returns Both streams as the command left them

 @throws Error where the command never started, so no case reads two empty
 streams as a clean report

 @example
 ```ts
 const { stdout, } = await standingOver({ archive: fixture.archive, },);
 ```
 */
async function standingOver(
  { archive, }: { readonly archive: string; },
): Promise<StandingStreams> {
  /**
   Command as it finished, or why it never started.
   */
  const finished = await runBuiltCommand({
    command: STANDING_COMMAND,
    args: [archive,],
  },);


  return {
    code: finished.code,
    stdout: finished.stdout,
    stderr: finished.stderr,
  };
}

/**
 Writes one throwaway run carrying the artifacts named, and runs the command
 over it.

 @param artifacts - artifact values by the file name each is written as, so
 a case lays out several digests in one run

 @returns Both streams as the command left them

 @throws Error where the command never started

 @example
 ```ts
 const { stdout, } = await standingOverArtifacts({ artifacts: { 'Mittens.json': artifact, }, },);
 ```
 */
async function standingOverArtifacts(
  { artifacts, }: { readonly artifacts: Readonly<Record<string, unknown>>; },
): Promise<StandingStreams> {
  /**
   The run directory and what the command left, the directory removed when
   this returns.
   */
  await using run = await scratchDirWith({
    prefix: 'editor-standing-read-',
    setup: async function seeded({ path, },): Promise<StandingStreams> {
      await mkdir(join(path, 'artifacts',), { recursive: true, },);
      await Promise.all(Object.entries(artifacts,).map(async function written([name, artifact,],): Promise<void> {
        await writeFile(
          join(path, 'artifacts', name,),
          JSON.stringify(artifact,),
          'utf8',
        );
      },),);
      return await standingOver({ archive: path, },);
    },
  },);
  return {
    code: run.code,
    stdout: run.stdout,
    stderr: run.stderr,
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
 const { stdout, } = await standingOverArtifact({ artifact, },);
 ```
 */
async function standingOverArtifact(
  { artifact, }: { readonly artifact: unknown; },
): Promise<StandingStreams> {
  return await standingOverArtifacts({ artifacts: { 'Mittens.json': artifact, }, },);
}

await describe({
  name: STANDING_COMMAND,
  children: [
    it({
      name: 'COUNTS only the regular file in an archive\'s artifacts directory, skipping a directory and a '
        + 'symlink named like an artifact (ledger B64)',
      fn: async () => {
        await using fixture = await throwawayArchive({ nested: true, },);
        const { stdout, stderr, } = await standingOver({ archive: fixture.archive, },);
        expect(stdout.includes('archives=1 artifacts=1 ',),).toBe(true,);
        expect(stderr.includes('Tabby.json',),).toBe(false,);
      },
    },),

    it({
      name: 'COUNTS only the regular file in an archive that is itself the artifacts directory (ledger B64)',
      fn: async () => {
        await using fixture = await throwawayArchive({ nested: false, },);
        const { stdout, stderr, } = await standingOver({ archive: fixture.archive, },);
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
        const { stderr, } = await standingOver({ archive: fixture.archive, },);
        expect(stderr.includes('no artifacts under',),).toBe(true,);
      },
    },),

    it({
      name: 'COUNTS an artifact whose chunks the schema predates as earlier-schema, one naming a '
        + 'model the roster dropped as off-roster, and one naming a seated model as read, rendering its '
        + 'standing over the round a ballot was cast on, and says no round was judged, at exit 1, where '
        + 'the seated model\'s only round drew no ballot, and beside a judged digest counts a digest whose only '
        + 'round drew no ballot, and that round, on the summary line rather than dropping both, and names one '
        + 'off-roster artifact with the verb in the singular',
      fn: async () => {
        // The settled artifact the schema walk of 2026-10-04 mapped, with the
        // rounds the repair lane records under its result.
        const withoutRounds = {
          artifactSchemaVersion: 3,
          id: 'Mittens',
          tip: 'abc',
          pipelineDigest: `sha256-tree-v1:${'0'.repeat(64,)}`,
          corpusSha: 'feedfacefeedfacefeedfacefeedfacefeedface',
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
         The seated model's round as the repair lane records it, no ballot
         cast over its one candidate.
         */
        const seatedRound = {
          ...round,
          modelId: SEAT_SYNTHETIC_VISION_WITHHELD,
          slate: [{
            index: 1,
            producer: { kind: 'model', modelId: SEAT_SYNTHETIC_VISION_WITHHELD, },
            rendered: 'y',
            hash: 'h',
          },],
        };

        /**
         The settled artifact carrying one seated round as its only round.

         @param seatedOnly - round the artifact's one chunk records, with or
         without a ballot as the comparison needs

         @returns Artifact value written as the run's one artifact

         @example
         ```ts
         const artifact = carrying({ seatedOnly: seatedRound, },);
         ```
         */
        function carrying({ seatedOnly, }: { readonly seatedOnly: unknown; },): Readonly<Record<string, unknown>> {
          return {
            ...withoutRounds,
            lanes: {
              ...withoutRounds.lanes,
              repair: {
                ...withoutRounds.lanes.repair,
                result: {
                  ...withoutRounds.lanes.repair.result,
                  chunks: [{ rounds: [seatedOnly,], },],
                },
              },
            },
          };
        }

        /**
         Opening lines every report over the one seated artifact prints.
         */
        const opening = 'editor-standing-read: archives=1 artifacts=1 read=1 earlierRoster=0 earlierSchema=0 ';

        /**
         The note every report prints under its summary line.
         */
        const observational = '  OBSERVATIONAL. Only models that held a seat ever wrote a candidate, so an absent model is '
          + 'unmeasured rather than last. Rounds inside one entry are correlated, so read the entry count, '
          + 'not the round count. Digests are never pooled.\n';

        /**
         The artifact whose one round a ballot was cast on.
         */
        const judged = carrying({
          seatedOnly: {
            ...seatedRound,
            ballots: [{
              modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE,
              best: 1,
              reason: 'x',
              weight: 1,
              selfVote: false,
            },],
          },
        },);

        /**
         The report of that artifact's digest, which every run carrying it
         prints.
         */
        const judgedReport = `sha256-tree-v1:${'0'.repeat(64,)} over 1 entry\n`
          + '  EDITOR : 1 judged round from 1 of 1 chunk\n'
          + `      ${SEAT_SYNTHETIC_VISION_WITHHELD}: 100.0% (1 of 1 disinterested ballot, over 1 candidate)\n`
          + '  REFINER: 0 judged rounds from 0 of 1 chunk\n';

        /**
         A round a ballot was cast on: the standing and its report render.
         */
        const judgedAlone = await standingOverArtifact({ artifact: judged, },);

        /**
         That artifact beside one built by another pipeline, whose one round
         drew no ballot: the second digest has no standing to print, and the
         summary counts it and its round rather than dropping both.
         */
        const judgedBesideUnjudged = await standingOverArtifacts({
          artifacts: {
            'Mittens.json': judged,
            'Tabby.json': {
              ...carrying({ seatedOnly: seatedRound, },),
              id: 'Tabby',
              pipelineDigest: `sha256-tree-v1:${'1'.repeat(64,)}`,
            },
          },
        },);

        /**
         The same round with no ballot alone: no round was judged, and the
         report says so rather than rendering a standing over it.
         */
        const unjudgedAlone = await standingOverArtifact({ artifact: carrying({ seatedOnly: seatedRound, },), },);

        // Every run's streams compared at once and side by side, so a
        // difference in one never hides what the others printed; the run whose
        // one artifact names a model the roster dropped names its absence with
        // the count of one in the singular.
        expect({
          codes: [
            judgedAlone.code,
            judgedBesideUnjudged.code,
            unjudgedAlone.code,
          ],
          stderrs: [
            judgedAlone.stderr,
            judgedBesideUnjudged.stderr,
            unjudgedAlone.stderr,
          ],
          judgedAlone: judgedAlone.stdout,
          judgedBesideUnjudged: judgedBesideUnjudged.stdout,
          unjudgedAlone: unjudgedAlone.stdout,
          offRoster: offRoster.stdout,
        },).toEqual({
          codes: [
            0,
            0,
            1,
          ],
          stderrs: [
            '',
            '',
            '',
          ],
          judgedAlone: `${opening}digestsJudged=1 digestsUnjudged=0 unjudgedDigestRounds=0\n`
            + `${observational}\n${judgedReport}`,
          judgedBesideUnjudged: 'editor-standing-read: archives=1 artifacts=2 read=2 earlierRoster=0 earlierSchema=0 '
            + `digestsJudged=1 digestsUnjudged=1 unjudgedDigestRounds=1\n${observational}\n${judgedReport}`,
          unjudgedAlone: `${opening}digestsJudged=0 digestsUnjudged=1 unjudgedDigestRounds=1\n${observational}`
            + '  NO JUDGED ROUNDS. 1 round was recorded here and drew no ballot: a slate of one candidate, which '
            + 'is what every producer proposing the same wording leaves, needs no vote, and a panel whose every '
            + 'judge abstained or failed casts none.\n',
          offRoster: 'editor-standing-read: archives=1 artifacts=1 read=0 earlierRoster=1 earlierSchema=0 '
            + `digestsJudged=0 digestsUnjudged=0 unjudgedDigestRounds=0\n${observational}`
            + '  NO ROUNDS UNDER THE CURRENT ROSTER. 1 of these artifacts names a model the roster no longer seats, '
            + 'so it was settled under an earlier one and is not evidence about the models seated now. This is an '
            + 'absent measurement, not a poor one.\n',
        },);
      },
    },),

    it({
      name: 'READS THE RUNS THE VARIABLE NAMES when the command line names no directory',
      fn: async () => {
        await using fixture = await scratchDirWith({
          prefix: 'editor-standing-read-',
          setup: async function seeded({ path, },): Promise<{ readonly archive: string; }> {
            await mkdir(join(path, 'artifacts',), { recursive: true, },);
            await writeFile(join(path, 'artifacts', 'Mittens.json',), '{}', 'utf8',);
            return { archive: path, };
          },
        },);
        const finished = await runBuiltCommand({
          command: STANDING_COMMAND,
          env: { TRANSLATION_REPAIR_RUNS_DIR: fixture.archive, },
        },);
        // The summary names one artifact and the refusal names the fixture's own file, which a
        // read of the default runs directory could not.
        expect(finished.stdout.split('\n',).at(0,),).toBe(
          'editor-standing-read: archives=0 artifacts=1 read=0 earlierRoster=0 earlierSchema=0 digestsJudged=0 '
            + 'digestsUnjudged=0 unjudgedDigestRounds=0',
        );
        expect(finished.stderr,).toBe(
          `editor-standing-read: ${join(fixture.archive, 'artifacts', 'Mittens.json',)} refused, `
          + 'artifact parse failed at artifact.artifactSchemaVersion: expected a number.\n',
        );
      },
    },),
  ],
},);

//endregion Editor standing read listing tests
