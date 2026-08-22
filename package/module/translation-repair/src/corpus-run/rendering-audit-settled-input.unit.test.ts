/**
 * Tests for turning an archive of settled artifacts into audit subjects.
 *
 * What matters here is not that the reader parses. It is that every claim a
 * persisted audit row will later make about its own provenance is true: that
 * the text audited is the text the judges saw, that the corpus commit read is
 * the artifact's own rather than whatever the pin says today, that a retained
 * slice is marked as the archive's wording rather than a fresh rendering, and
 * that a preparation which no longer matches is REPORTED rather than thrown.
 *
 * Fixtures are cat-themed invention on a throwaway git repository. No corpus
 * content appears here.
 *
 * @module
 */

import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import { resolveGit, } from '@monochromatic-dev/git-policy-cli/ts/resolve-git.ts';
import spawn from 'nano-spawn';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  buildSettledArtifactV2,
  type PipelineDigest,
  preparationIdentity,
  prepareDocumentPair,
  type PreparedDocumentPair,
  readArchiveSubjects,
  readArtifactSubjects,
  type SliceDeliveryRecord,
} from '../../dist/final/node/index.mjs';

/**
 * Real git binary every fixture command runs through.
 *
 * RESOLVED rather than taken from PATH, which in this repository exposes a
 * policy shim. The shim rejects fixture staging patterns and settles worktree
 * copies against the REAL repository, so a throwaway corpus built through it
 * races other cases on a lock that has nothing to do with this test.
 */
const REAL_GIT = await resolveGit();

/**
 * Configuration sink keeping fixture repositories away from real git config.
 */
const DEV_NULL = '/dev/null';

/**
 * Built pipeline these fixtures claim to have run under.
 */
const DIGEST = 'sha256-tree-v1:'.concat('c'.repeat(64,),) as unknown as PipelineDigest;

/**
 * Entry every fixture artifact is written for.
 */
const ENTRY_ID = 'mittens';

/**
 * Original page, whose front matter declares a name, an alias and a location so
 * the identity block has something to carry.
 */
const SOURCE_PAGE = `---
name: 毛毛
info:
    alias: 小猫
    location: 猫村
desc: 窗台上的猫。
---

## 第一节

猫猫在窗台上睡觉。

## 第二节

猫猫有自己的碗。
`;

/**
 * Archive translation of it, structured the same way.
 */
const TARGET_PAGE = `---
name: Mittens
info:
    alias: Kitty
    location: Cat Village
desc: The cat on the sill.
---

## Section one

The cat sleeps on the sill.

## Section two

The cat has a bowl.
`;

/**
 * A second pair with no front matter at all, for the entry that declares
 * nothing.
 */
const BARE_SOURCE_PAGE = '## 第一节\n\n猫猫在门口等着。\n\n## 第二节\n\n猫猫喜欢晒太阳。\n';

/**
 * Archive translation of the bare pair.
 */
const BARE_TARGET_PAGE = '## Section one\n\nThe cat waits at the door.\n\n## Section two\n\nThe cat likes the sun.\n';

/**
 * Runs one git command inside a fixture repository.
 *
 * @param cloneDir - repository the command runs in
 *
 * @param args - arguments after the directory selector
 *
 * @returns Standard output
 *
 * @example
 * ```ts
 * await fixtureGit({ cloneDir, args: ['rev-parse', 'HEAD',], },);
 * ```
 */
async function fixtureGit(
  {
    cloneDir,
    args,
  }: {
    readonly cloneDir: string;
    readonly args: readonly string[];
  },
): Promise<string> {
  /**
   * Subprocess result; only stdout is consumed.
   */
  const { stdout, } = await spawn(
    REAL_GIT,
    [
      '-C',
      cloneDir,
      ...args,
    ],
    {
      env: {
        GIT_CONFIG_GLOBAL: DEV_NULL,
        GIT_CONFIG_SYSTEM: DEV_NULL,
      },
    },
  );
  return stdout;
}

/**
 * Commits one entry's two pages into a fixture repository.
 *
 * @param cloneDir - repository to write into
 *
 * @param entryId - entry directory name
 *
 * @param sourcePage - original page content
 *
 * @param targetPage - archive translation content
 *
 * @returns Commit the write landed in
 *
 * @example
 * ```ts
 * const sha = await commitEntry({ cloneDir, entryId, sourcePage, targetPage, },);
 * ```
 */
async function commitEntry(
  {
    cloneDir,
    entryId,
    sourcePage,
    targetPage,
  }: {
    readonly cloneDir: string;
    readonly entryId: string;
    readonly sourcePage: string;
    readonly targetPage: string;
  },
): Promise<string> {
  /**
   * Entry directory inside the fixture repository.
   */
  const dir = join(
    cloneDir,
    'people',
    entryId,
  );
  await mkdir(
    dir,
    { recursive: true, },
  );
  await writeFile(
    join(
      dir,
      'page.md',
    ),
    sourcePage,
    'utf8',
  );
  await writeFile(
    join(
      dir,
      'page.en.md',
    ),
    targetPage,
    'utf8',
  );
  // EXPLICIT PATHSPECS rather than `--all`: the repository's own git policy
  // rejects bulk staging, and a fixture that bypassed it would be teaching the
  // habit the guard exists to stop.
  await fixtureGit({
    cloneDir,
    args: [
      'add',
      `people/${entryId}/page.md`,
      `people/${entryId}/page.en.md`,
    ],
  },);
  await fixtureGit({
    cloneDir,
    args: [
      '-c',
      'user.name=cat',
      '-c',
      'user.email=cat@example.org',
      'commit',
      '--message',
      `add ${entryId}`,
      '--no-gpg-sign',
      '--',
      `people/${entryId}/page.md`,
      `people/${entryId}/page.en.md`,
    ],
  },);
  return (await fixtureGit({
    cloneDir,
    args: [
      'rev-parse',
      'HEAD',
    ],
  },))
    .trim();
}

/**
 * Throwaway corpus holding the cat pair, removed on dispose.
 *
 * @returns Clone directory, the commit holding the pair, and a disposer
 *
 * @example
 * ```ts
 * await using corpus = await makeCorpus();
 * ```
 */
async function makeCorpus(): Promise<
  AsyncDisposable & {
    readonly cloneDir: string;
    readonly commitSha: string;
  }
> {
  /**
   * Fresh temp directory holding the throwaway repository.
   */
  const cloneDir = await mkdtemp(join(
    tmpdir(),
    'settled-audit-corpus-',
  ),);

  await spawn(
    REAL_GIT,
    [
      'init',
      cloneDir,
    ],
    {
      env: {
        GIT_CONFIG_GLOBAL: DEV_NULL,
        GIT_CONFIG_SYSTEM: DEV_NULL,
      },
    },
  );

  /**
   * Commit the pair landed in, which every fixture artifact pins.
   */
  const commitSha = await commitEntry({
    cloneDir,
    entryId: ENTRY_ID,
    sourcePage: SOURCE_PAGE,
    targetPage: TARGET_PAGE,
  },);

  return {
    cloneDir,
    commitSha,
    [Symbol.asyncDispose]: async function removeClone() {
      await rm(
        cloneDir,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * Throwaway archive directory, removed on dispose.
 *
 * @returns Archive directory and a disposer
 *
 * @example
 * ```ts
 * await using archive = await makeArchive();
 * ```
 */
async function makeArchive(): Promise<AsyncDisposable & { readonly archiveDir: string; }> {
  /**
   * Fresh temp directory standing in for the run archive.
   */
  const archiveDir = await mkdtemp(join(
    tmpdir(),
    'settled-audit-archive-',
  ),);
  return {
    archiveDir,
    [Symbol.asyncDispose]: async function removeArchive() {
      await rm(
        archiveDir,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * Builds a ledger where the lane replaced the archive at the FIRST slice and
 * kept it everywhere else.
 *
 * Both delivery kinds in one artifact, so the retained-versus-replaced split
 * has something to separate.
 *
 * @param prepared - preparation to build rows from
 *
 * @returns One row per prepared slice, in document order
 *
 * @example
 * ```ts
 * const rows = replacedFirstSlice({ prepared, },);
 * ```
 */
function replacedFirstSlice(
  { prepared, }: { readonly prepared: PreparedDocumentPair; },
): readonly SliceDeliveryRecord[] {
  return prepared.slices
    .map(function toRow(slice, position,): SliceDeliveryRecord {
      /**
       * Archive wording at this slice.
       */
      const incumbentText = slice.target
        .text;

      /**
       * Wording the lane decided on, which differs only at the first slice.
       */
      const acceptedText = position === 0 ? `${incumbentText} It purrs.` : incumbentText;

      return {
        chunkIndex: slice.target
          .chunkIndex,
        sourceText: slice.source
          .text,
        incumbentKind: 'present',
        incumbentText,
        outcome: {
          kind: 'decided',
          acceptedText,
        },
        shippedText: acceptedText,
        delivery: position === 0
          ? { kind: 'replacement-shipped', }
          : { kind: 'incumbent-retained', },
      };
    },);
}

/**
 * What one lane's raw result reports about those rows.
 *
 * @param rows - ledger the result describes
 *
 * @returns Raw result fields version 2 requires
 *
 * @example
 * ```ts
 * const raw = rawResultFor({ rows, },);
 * ```
 */
function rawResultFor(
  { rows, }: { readonly rows: readonly SliceDeliveryRecord[]; },
): Record<string, unknown> {
  /**
   * Slices whose replacement the document carries.
   */
  const shipped = rows
    .filter(function wasShipped(row,): boolean {
      return row.delivery
        .kind === 'replacement-shipped';
    },)
    .map(function indexOf(row,): number {
      return row.chunkIndex;
    },);

  return {
    sliceCount: rows.length,
    shippedChunkIndices: shipped,
    withdrawnChunkIndices: [],
    changedSliceCount: shipped.length,
    withdrawnSliceCount: 0,
    sliceTexts: rows.map(function toEvidence(row,): Record<string, unknown> {
      return {
        chunkIndex: row.chunkIndex,
        incumbentKind: row.incumbentKind,
        incumbentText: row.incumbentText,
        outcome: row.outcome,
      };
    },),
  };
}

/**
 * Writes one artifact into an archive run set.
 *
 * @param archiveDir - throwaway archive
 *
 * @param runSet - subdirectory to write into
 *
 * @param prepared - preparation both lanes ran over
 *
 * @param corpusSha - commit the artifact claims its pair was read at
 *
 * @param entryId - entry the artifact is written for
 *
 * @returns Nothing; the file is the result
 *
 * @example
 * ```ts
 * await writeArtifact({ archiveDir, runSet, prepared, corpusSha, entryId, },);
 * ```
 */
async function writeArtifact(
  {
    archiveDir,
    runSet,
    prepared,
    corpusSha,
    entryId,
  }: {
    readonly archiveDir: string;
    readonly runSet: string;
    readonly prepared: PreparedDocumentPair;
    readonly corpusSha: string;
    readonly entryId: string;
  },
): Promise<void> {
  /**
   * Rows both lanes report.
   */
  const rows = replacedFirstSlice({ prepared, },);

  /**
   * Name this preparation gives itself, stamped on both ledgers.
   */
  const identity = preparationIdentity({ prepared, },);

  /**
   * What the driver would have returned.
   */
  const lanes = {
    alignmentFindings: [...prepared.alignmentFindings,],
    repair: {
      ...rawResultFor({ rows, },),
      repairedText: prepared.targetText,
      status: 'unchanged',
    },
    translate: {
      ...rawResultFor({ rows, },),
      translatedText: prepared.targetText,
      status: 'complete',
    },
    repairDelivery: {
      preparationIdentity: identity,
      records: rows,
    },
    translateDelivery: {
      preparationIdentity: identity,
      records: rows,
    },
  } as unknown as Parameters<typeof buildSettledArtifactV2>[0]['lanes'];

  /**
   * Run-set directory this artifact lands in.
   */
  const dir = join(
    archiveDir,
    runSet,
  );
  await mkdir(
    dir,
    { recursive: true, },
  );
  await writeFile(
    join(
      dir,
      `${entryId}.json`,
    ),
    JSON.stringify(
      buildSettledArtifactV2({
        entryId,
        tip: 'a'.repeat(40,),
        pipelineDigest: DIGEST,
        corpusSha,
        callConfig: { perCallTimeoutMs: 600_000, },
        durationMs: 1_234,
        prepared,
        lanes,
        laneSelection: { kind: 'pending-human-decision', },
        consolidation: { kind: 'not-run', },
      },),
      undefined,
      2,
    ),
    'utf8',
  );
}

await describe({
  name: readArtifactSubjects.name,
  children: [
    it({
      name: 'reads the audited text OUT OF THE ARTIFACT rather than out of a fresh slicing, since '
        + 'auditing re-sliced text would audit a different input than the one the judges saw',
      fn: async () => {
        await using corpus = await makeCorpus();
        await using archive = await makeArchive();

        /**
         * Preparation the fixture artifact was written over.
         */
        const prepared = prepareDocumentPair({
          sourceText: SOURCE_PAGE,
          targetText: TARGET_PAGE,
        },);
        await writeArtifact({
          archiveDir: archive.archiveDir,
          runSet: 'first',
          prepared,
          corpusSha: corpus.commitSha,
          entryId: ENTRY_ID,
        },);

        /**
         * Artifact as the reader returns it.
         */
        const reading = await readArtifactSubjects({
          archiveDir: archive.archiveDir,
          runSetDir: 'first',
          runSet: 'first',
          artifactFile: `${ENTRY_ID}.json`,
          cloneDir: corpus.cloneDir,
        },);

        expect(reading.entryId,).toBe(ENTRY_ID,);
        expect(reading.subjects.length,).toBe(prepared.slices.length,);

        /**
         * First slice, which the lane replaced.
         */
        const [first,] = reading.subjects;
        expect(first?.candidateText,).toContain('It purrs.',);
        expect(first?.sourceText,).toBe(prepared.slices[0]?.source
          .text,);
      },
    },),

    it({
      name: 'SEPARATES a slice carrying the archive\'s own wording from one carrying a fresh '
        + 'rendering, because the instrument was built for output with no BEFORE text and reading '
        + 'both in one denominator would blur its first real measurement',
      fn: async () => {
        await using corpus = await makeCorpus();
        await using archive = await makeArchive();

        await writeArtifact({
          archiveDir: archive.archiveDir,
          runSet: 'first',
          prepared: prepareDocumentPair({
            sourceText: SOURCE_PAGE,
            targetText: TARGET_PAGE,
          },),
          corpusSha: corpus.commitSha,
          entryId: ENTRY_ID,
        },);

        /**
         * Subjects the artifact offers.
         */
        const { subjects, } = await readArtifactSubjects({
          archiveDir: archive.archiveDir,
          runSetDir: 'first',
          runSet: 'first',
          artifactFile: `${ENTRY_ID}.json`,
          cloneDir: corpus.cloneDir,
        },);

        expect(subjects[0]?.deliveryKind,).toBe('replacement-shipped',);
        expect(subjects[0]?.auditsArchiveText,).toBe(false,);

        /**
         * Every slice after the first, all of which kept the archive.
         */
        const retained = subjects.slice(1,);
        expect(retained.length > 0,).toBe(true,);

        /**
         * Whether every one of them is marked as the archive's own wording.
         */
        const allArchive = retained.every(function keptArchive(subject,): boolean {
          return subject.auditsArchiveText;
        },);
        expect(allArchive,).toBe(true,);
      },
    },),

    it({
      name: 'CARRIES the declared names the producing judges had, so an auditor is not shown a '
        + 'rendering whose name it cannot derive from the source and left to call it a fabrication',
      fn: async () => {
        await using corpus = await makeCorpus();
        await using archive = await makeArchive();

        await writeArtifact({
          archiveDir: archive.archiveDir,
          runSet: 'first',
          prepared: prepareDocumentPair({
            sourceText: SOURCE_PAGE,
            targetText: TARGET_PAGE,
          },),
          corpusSha: corpus.commitSha,
          entryId: ENTRY_ID,
        },);

        /**
         * Subjects the artifact offers.
         */
        const { subjects, } = await readArtifactSubjects({
          archiveDir: archive.archiveDir,
          runSetDir: 'first',
          runSet: 'first',
          artifactFile: `${ENTRY_ID}.json`,
          cloneDir: corpus.cloneDir,
        },);

        /**
         * Identity block the first subject carries.
         */
        const identity = subjects[0]?.identity;
        expect(identity?.kind,).toBe('declared',);
        expect(identity?.kind === 'declared' ? identity.context : '',).toContain('Mittens',);
      },
    },),

    it({
      name: 'reports NO DECLARED NAMES as a positive answer when the pair declares none, rather '
        + 'than as a missing field, so a later reader can tell "this pair declared nothing" from '
        + '"nobody recorded whether it did"',
      fn: async () => {
        await using corpus = await makeCorpus();
        await using archive = await makeArchive();

        /**
         * A second entry whose pages carry no front matter, committed after the
         * first.
         */
        const bareSha = await commitEntry({
          cloneDir: corpus.cloneDir,
          entryId: 'tabby',
          sourcePage: BARE_SOURCE_PAGE,
          targetPage: BARE_TARGET_PAGE,
        },);
        await writeArtifact({
          archiveDir: archive.archiveDir,
          runSet: 'first',
          prepared: prepareDocumentPair({
            sourceText: BARE_SOURCE_PAGE,
            targetText: BARE_TARGET_PAGE,
          },),
          corpusSha: bareSha,
          entryId: 'tabby',
        },);

        /**
         * Subjects that artifact offers.
         */
        const { subjects, } = await readArtifactSubjects({
          archiveDir: archive.archiveDir,
          runSetDir: 'first',
          runSet: 'first',
          artifactFile: 'tabby.json',
          cloneDir: corpus.cloneDir,
        },);

        expect(subjects[0]?.identity
          .kind,).toBe('none',);
      },
    },),

    it({
      name: 'reads the corpus at the ARTIFACT\'S OWN COMMIT rather than at whatever the clone now '
        + 'points to, so a settled file keeps answering for itself after the pair is edited',
      fn: async () => {
        await using corpus = await makeCorpus();
        await using archive = await makeArchive();

        await writeArtifact({
          archiveDir: archive.archiveDir,
          runSet: 'first',
          prepared: prepareDocumentPair({
            sourceText: SOURCE_PAGE,
            targetText: TARGET_PAGE,
          },),
          corpusSha: corpus.commitSha,
          entryId: ENTRY_ID,
        },);

        // The pair is edited AFTER the artifact settled, which is the whole
        // point: a reader that followed the clone would now prepare a different
        // identity block and verify against the wrong documents.
        await commitEntry({
          cloneDir: corpus.cloneDir,
          entryId: ENTRY_ID,
          sourcePage: SOURCE_PAGE.split('毛毛',)
            .join('大毛',),
          targetPage: TARGET_PAGE.split('Mittens',)
            .join('Bigpaw',),
        },);

        /**
         * Artifact read after the clone moved on.
         */
        const reading = await readArtifactSubjects({
          archiveDir: archive.archiveDir,
          runSetDir: 'first',
          runSet: 'first',
          artifactFile: `${ENTRY_ID}.json`,
          cloneDir: corpus.cloneDir,
        },);

        expect(reading.verification
          .kind,).toBe('verified',);

        /**
         * Identity block, which must still name the cat the run licensed.
         */
        const identity = reading.subjects[0]?.identity;
        expect(identity?.kind === 'declared' ? identity.context : '',).toContain('Mittens',);
        expect(identity?.kind === 'declared' ? identity.context : '',).not
          .toContain('Bigpaw',);
      },
    },),

    it({
      name: 'REPORTS a preparation that no longer describes the pair instead of throwing, because a '
        + 'slicing that moved under a settled artifact is a finding about that artifact and not a '
        + 'reason to refuse to read the rows it settled',
      fn: async () => {
        await using corpus = await makeCorpus();
        await using archive = await makeArchive();

        // Written over a DIFFERENT pair than the one the entry id resolves to,
        // which is what a moved slicing looks like from the reader's side.
        await writeArtifact({
          archiveDir: archive.archiveDir,
          runSet: 'first',
          prepared: prepareDocumentPair({
            sourceText: BARE_SOURCE_PAGE,
            targetText: BARE_TARGET_PAGE,
          },),
          corpusSha: corpus.commitSha,
          entryId: ENTRY_ID,
        },);

        /**
         * Artifact read against a preparation it does not describe.
         */
        const reading = await readArtifactSubjects({
          archiveDir: archive.archiveDir,
          runSetDir: 'first',
          runSet: 'first',
          artifactFile: `${ENTRY_ID}.json`,
          cloneDir: corpus.cloneDir,
        },);

        expect(reading.verification
          .kind,).toBe('refused',);
        // The rows still arrive. They are what the run actually judged.
        expect(reading.subjects.length > 0,).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: readArchiveSubjects.name,
  children: [
    it({
      name: 'reads every run set in a stable order, so a capped run always buys the same prefix and '
        + 'two invocations can be compared row against row',
      fn: async () => {
        await using corpus = await makeCorpus();
        await using archive = await makeArchive();

        /**
         * Preparation both run sets were settled over.
         */
        const prepared = prepareDocumentPair({
          sourceText: SOURCE_PAGE,
          targetText: TARGET_PAGE,
        },);

        // Written second-first, so a reader that trusted directory order rather
        // than sorting would return them the other way round.
        await writeArtifact({
          archiveDir: archive.archiveDir,
          runSet: 'second-run',
          prepared,
          corpusSha: corpus.commitSha,
          entryId: ENTRY_ID,
        },);
        await writeArtifact({
          archiveDir: archive.archiveDir,
          runSet: 'first-run',
          prepared,
          corpusSha: corpus.commitSha,
          entryId: ENTRY_ID,
        },);

        /**
         * Everything the archive holds.
         */
        const readings = await readArchiveSubjects({
          archiveDir: archive.archiveDir,
          cloneDir: corpus.cloneDir,
        },);

        expect(readings.length,).toBe(2,);
        expect(readings[0]?.runSet,).toBe('first-run',);
        expect(readings[1]?.runSet,).toBe('second-run',);

        // Two runs of one entry write the same file name, so the run set is the
        // only thing telling their rows apart.
        expect(readings[0]?.artifactFile,).toBe(readings[1]?.artifactFile,);
      },
    },),

    it({
      name: 'IGNORES anything that is not an artifact, since a run directory collects logs and notes '
        + 'beside its artifacts and reading one as JSON would end the census at that file',
      fn: async () => {
        await using corpus = await makeCorpus();
        await using archive = await makeArchive();

        await writeArtifact({
          archiveDir: archive.archiveDir,
          runSet: 'first-run',
          prepared: prepareDocumentPair({
            sourceText: SOURCE_PAGE,
            targetText: TARGET_PAGE,
          },),
          corpusSha: corpus.commitSha,
          entryId: ENTRY_ID,
        },);
        await writeFile(
          join(
            archive.archiveDir,
            'first-run',
            'run.log',
          ),
          'the cat sat on the log\n',
          'utf8',
        );

        /**
         * Everything the archive holds.
         */
        const readings = await readArchiveSubjects({
          archiveDir: archive.archiveDir,
          cloneDir: corpus.cloneDir,
        },);

        expect(readings.length,).toBe(1,);
        expect(readings[0]?.entryId,).toBe(ENTRY_ID,);
      },
    },),

    it({
      name: 'READS THE FLAT LAYOUT A PASS ACTUALLY WRITES, artifacts straight under the directory '
        + 'with no run-set subdirectory. corpus-pass produces one settlement so it invents no '
        + 'subdirectory for it, and before this the audit refused such a directory with "no '
        + 'artifacts under", which reads like an empty pass rather than like a layout it cannot see',
      fn: async () => {
        await using corpus = await makeCorpus();
        await using archive = await makeArchive();

        /**
         * Pair both sides describe.
         */
        const prepared = prepareDocumentPair({
          sourceText: SOURCE_PAGE,
          targetText: TARGET_PAGE,
        },);

        // Written with an EMPTY run set, which puts the file at the archive
        // root exactly as a pass writes it.
        await writeArtifact({
          archiveDir: archive.archiveDir,
          runSet: '',
          prepared,
          corpusSha: corpus.commitSha,
          entryId: ENTRY_ID,
        },);

        /**
         * Everything the flat directory holds.
         */
        const readings = await readArchiveSubjects({
          archiveDir: archive.archiveDir,
          cloneDir: corpus.cloneDir,
        },);

        expect(readings.length,).toBe(1,);
        expect(readings[0]?.entryId,).toBe(ENTRY_ID,);

        // The directory names the settlement, since there is exactly one and a
        // reader tracing a row back wants the directory it came from.
        expect(readings[0]?.runSet.length,).toBeGreaterThan(0,);
      },
    },),

    it({
      name: 'REFUSES A DIRECTORY CARRYING BOTH LAYOUTS rather than choosing one, because artifacts '
        + 'at the root AND in subdirectories are either two populations or a half-finished move, '
        + 'and reading one while ignoring the other would report a population smaller than the '
        + 'archive holds without saying so',
      fn: async () => {
        await using corpus = await makeCorpus();
        await using archive = await makeArchive();

        /**
         * Pair both sides describe.
         */
        const prepared = prepareDocumentPair({
          sourceText: SOURCE_PAGE,
          targetText: TARGET_PAGE,
        },);

        await writeArtifact({
          archiveDir: archive.archiveDir,
          runSet: '',
          prepared,
          corpusSha: corpus.commitSha,
          entryId: ENTRY_ID,
        },);
        await writeArtifact({
          archiveDir: archive.archiveDir,
          runSet: 'nested-run',
          prepared,
          corpusSha: corpus.commitSha,
          entryId: ENTRY_ID,
        },);

        /**
         * What the reader says about the mixture.
         */
        const refusal = await readArchiveSubjects({
          archiveDir: archive.archiveDir,
          cloneDir: corpus.cloneDir,
        },).then(
          function unexpected(): string {
            return 'no refusal';
          },
          String,
        );

        expect(refusal.includes('at its root AND in subdirectories',),).toBe(true,);
      },
    },),
  ],
},);
