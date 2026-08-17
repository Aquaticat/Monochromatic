import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  type RenderingAuditReport,
  runRenderingAudit,
} from '../rendering-audit.ts';
import { digestPipeline, } from './pipeline-digest.ts';
import { persistProbeRun, } from './probe-store.ts';
import {
  type AuditArguments,
  readAuditArguments,
} from './rendering-audit-settled-args.ts';
import {
  readArchiveSubjects,
  type SettledArtifactReading,
  type SettledAuditSubject,
} from './rendering-audit-settled-input.ts';
import {
  createRunClient,
  resolveRunsDir,
  RUN_MODELS,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';

//region Settled rendering audit
// Runs the rendering audit over every decided slice of every settled version 2
// artifact in an archive, and keeps what it heard.
//
// THIS IS TELEMETRY AND NOTHING ELSE. The producing path does not change, and
// nothing this reports may gate what ships. The instrument's own production
// error rate is unmeasured: `#66`, its false-negative half, is open, and `#68`
// records that one of the three checkers raises claims at a tenth the rate of
// the others. An instrument in that state can be believed about itself and not
// about the corpus.
//
// WHAT IT IS POINTED AT, measured rather than estimated and written up in
// `doc/audit/rendering-audit-settled-population.md`: 40 subjects across four
// artifacts, two entries settled twice. EVERY delivery row is `decided`.
//
// SIXTEEN OF THE FORTY AUDIT THE ARCHIVE'S OWN ENGLISH, because the judges
// preferred the incumbent there. The instrument was built for output with no
// BEFORE text, which is the other twenty-four. Both are worth auditing, since
// both are what the document carries, but reading them in ONE denominator would
// blur the first real measurement this produces. So every row says which it was
// and the two are reported apart.
//
// NOT A CENSUS, whatever "every artifact" suggests. Two entries cannot settle
// anything about a particular entry. The name of this probe says `settled`
// rather than `census` on purpose: a probe directory outlives the paragraph
// that qualifies it.
//
// READ `corroborated` AND `agreed` APART. The strict tier asks whether voices
// picked the same characters and the loose one asks whether they were talking
// about the same thing; four runs of `audit-sensitivity` now show the strict
// tier reporting a unanimous defect as nothing.
//
// THE RELOCATION RULE WAS FIXED BEFORE THE RUN. `#107`: per-slice judging
// cannot tell a relocation from a fabrication, so a passage the archive carried
// across a slice boundary reads as an omission on one slice and an unsupported
// addition on its neighbour. Paired omission and addition findings on ADJACENT
// slices of one entry count as ONE relocation. Written down here because
// deciding it after seeing the tally is a goalpost move.

/**
 * Name the probe store collects runs of this probe under.
 *
 * DELIBERATELY NOT `census`. It becomes a directory name that outlives every
 * caveat written beside it, and two entries are not a census.
 */
const PROBE_NAME = 'rendering-audit-settled';

/**
 * One audited slice, with everything needed to say which decision it describes.
 *
 * @example
 * ```ts
 * const row: SettledAuditRow = { runSet, entryId, chunkIndex, report, ... };
 * ```
 */
type SettledAuditRow = {
  /**
   * Archive subdirectory, which is the only thing separating two runs of one
   * entry.
   */
  readonly runSet: string;

  /**
   * Corpus entry.
   */
  readonly entryId: string;

  /**
   * Global slice index.
   */
  readonly chunkIndex: number;

  /**
   * What the lane's document carries here.
   */
  readonly deliveryKind: string;

  /**
   * Whether this audited the archive's own English rather than a fresh
   * rendering, which is the split every aggregate must respect.
   */
  readonly auditsArchiveText: boolean;

  /**
   * Built output that produced the decision under audit.
   */
  readonly artifactDigest: string;

  /**
   * Corpus commit the pair was read at.
   */
  readonly corpusSha: string;

  /**
   * Whether the producing run had declared names to pass on.
   */
  readonly identityKind: string;

  /**
   * Everything the instrument said, WHOLE and uninterpreted.
   *
   * NOT SUMMARISED INTO COUNTS, which is what the first two-subject buy was
   * bought to find out. Counts said `corroborated=0 agreed=0 near=1` over two
   * voices claiming two defects each and a third dropping one, and nothing in
   * the file could say WHAT any of them claimed. That makes three separate
   * questions unanswerable from the artifact this probe exists to produce:
   * whether the matcher was right to bring nothing together (`#68`), which
   * voice was right when they disagreed (`#66`), and whether a paired omission
   * and addition on adjacent slices is one relocation rather than two defects
   * (`#107`), which is a rule fixed before this run and unenforceable without
   * categories and spans.
   *
   * Every count a reader wants is derivable from this. None of this is
   * recoverable from the counts.
   */
  readonly report: RenderingAuditReport;
};

/**
 * Audits one slice and keeps what the roster said, whole.
 *
 * @param subject - slice under audit, with the identity its producing run had
 *
 * @returns One row: provenance, plus the report uninterpreted
 *
 * @example
 * ```ts
 * const row = await auditOne({ subject, },);
 * ```
 */
async function auditOne(
  { subject, }: { readonly subject: SettledAuditSubject; },
): Promise<SettledAuditRow> {
  /**
   * Logger tagged for this slice, so a long run's stream says where it is.
   */
  const l = tagged({ tag: `${PROBE_NAME}:${subject.entryId}:${String(subject.chunkIndex,)}`, },);

  /**
   * Everything the reader put in front of the audit for this slice.
   */
  const {
    runSet,
    entryId,
    chunkIndex,
    deliveryKind,
    auditsArchiveText,
    artifactDigest,
    corpusSha,
    sourceText,
    candidateText,
    identity,
  } = subject;

  /**
   * What the roster said about this rendering.
   *
   * The identity block goes in when the pair declared one: the producing judges
   * had it, and an auditor without it has every reason to call a declared name
   * a fabrication.
   */
  const report = await runRenderingAudit({
    client: createRunClient(),
    subject: {
      sourceText,
      candidateText,
      ...((identity.kind === 'declared') ? { identityContext: identity.context, } : {}),
    },
    modelIds: RUN_MODELS.checkerModelIds,
    signal: new AbortController().signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l,
  },);

  return {
    runSet,
    entryId,
    chunkIndex,
    deliveryKind,
    auditsArchiveText,
    artifactDigest,
    corpusSha,
    identityKind: identity.kind,
    report,
  };
}

/**
 * Picks the subjects a run will buy, in archive order.
 *
 * @param readings - every artifact the archive holds
 *
 * @param onlyIds - entries to keep, empty for all
 *
 * @param cap - how many to buy, negative for all
 *
 * @returns Subjects to audit
 *
 * @example
 * ```ts
 * const buying = selectSubjects({ readings, onlyIds, cap, },);
 * ```
 */
function selectSubjects(
  {
    readings,
    onlyIds,
    cap,
  }: {
    readonly readings: readonly SettledArtifactReading[];
    readonly onlyIds: readonly string[];
    readonly cap: number;
  },
): readonly SettledAuditSubject[] {
  /**
   * Every subject the archive offers, in a stable order.
   */
  const offered = readings
    .flatMap(function subjectsOf(reading,): readonly SettledAuditSubject[] {
      return reading.subjects;
    },)
    .filter(function isWanted(subject,): boolean {
      if (onlyIds.length === 0)
        return true;
      return onlyIds.includes(subject.entryId,);
    },);

  if (cap < 0)
    return offered;
  return offered.slice(
    0,
    cap,
  );
}

/**
 * Reports what the archive holds, before anything is bought.
 *
 * @param readings - every artifact the archive holds
 *
 * @example
 * ```ts
 * printPopulation({ readings, },);
 * ```
 */
function printPopulation(
  { readings, }: { readonly readings: readonly SettledArtifactReading[]; },
): void {
  readings.forEach(function describe(reading,): void {
    /**
     * Where this artifact came from, what it offers, and whether its recorded
     * slicing still describes the pair.
     */
    const {
      runSet,
      artifactFile,
      subjects,
      verification,
    } = reading;

    /**
     * Slices whose text is the archive's own wording.
     */
    const retained = subjects.filter(function isArchive(subject,): boolean {
      return subject.auditsArchiveText;
    },);

    console.log(
      `${runSet}/${artifactFile}  subjects=${String(subjects.length,)} retained=${
        String(retained.length,)
      } replaced=${String(subjects.length - retained.length,)} verification=${verification.kind}`,
    );
    if (verification.kind === 'refused')
      console.log(`   REFUSED: ${verification.detail}`,);
  },);
}

/**
 * Prints one audited slice as it lands, so a long run can be watched.
 *
 * @param row - what the roster said about one slice
 *
 * @example
 * ```ts
 * printRow({ row, },);
 * ```
 */
function printRow({ row, }: { readonly row: SettledAuditRow; },): void {
  /**
   * Where this slice came from and what the two tiers made of it.
   */
  const {
    runSet,
    entryId,
    chunkIndex,
    auditsArchiveText,
    report,
  } = row;

  /**
   * Both agreement tiers, the near misses, the degradation and every voice.
   */
  const {
    corroborated,
    agreed,
    near,
    findings,
    rows,
  } = report;

  /**
   * Claims that anchored, across the whole roster.
   *
   * PRINTED BESIDE THE TIERS because the difference between them is the
   * measurement: voices that claimed plenty and agreed on none says something
   * about the matcher, and a silent roster says something else entirely.
   */
  const claimed = rows.reduce(
    function total(
      sum,
      voice,
    ): number {
      /**
       * What this voice claimed that anchored.
       */
      const { findings: anchored, } = voice;
      return sum + anchored.length;
    },
    0,
  );

  console.log(
    `${runSet}/${entryId}#${String(chunkIndex,)} ${
      auditsArchiveText ? 'ARCHIVE' : 'FRESH  '
    } claimed=${String(claimed,)} corroborated=${String(corroborated.length,)} agreed=${
      String(agreed.length,)
    } near=${String(near.length,)}${
      (findings.length === 0) ? '' : ` degraded=${String(findings.length,)}`
    }`,
  );
}

/**
 * Reads the archive, audits what was asked for, and keeps the answers.
 *
 * @throws {@link Error} when the archive holds nothing to audit, which means
 * the run was pointed somewhere wrong rather than that everything is clean
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * When this invocation began, read before any call so the record dates the
   * run rather than the moment it happened to finish.
   */
  const startedAt = new Date().toISOString();

  /**
   * What the command line asked for.
   */
  const asked = readAuditArguments({ argv: process.argv, },);

  /**
   * Every artifact the archive holds, parsed, re-prepared and verified. Free.
   */
  const readings = await readArchiveSubjects({
    archiveDir: asked.archiveDir,
    cloneDir: asked.cloneDir,
  },);
  printPopulation({ readings, },);

  /**
   * Subjects this run will buy.
   */
  const buying = selectSubjects({
    readings,
    onlyIds: asked.onlyIds,
    cap: asked.cap,
  },);
  /**
   * Every subject the archive offers, which is what a capped buy is a fraction
   * of.
   */
  const offeredCount = readings.reduce(
    function total(
      sum,
      reading,
    ): number {
      /**
       * Subjects this artifact offers.
       */
      const { subjects, } = reading;
      return sum + subjects.length;
    },
    0,
  );
  console.log(`\nBUYING ${String(buying.length,)} of ${String(offeredCount,)} subjects\n`,);

  if (readings.length === 0)
    throw new Error(`no artifacts under ${asked.archiveDir}`,);

  /**
   * What the roster said about each, in order.
   *
   * SEQUENTIAL rather than concurrent: these share one roster, and interleaved
   * progress lines would make the stream unreadable, which is the only thing a
   * long run offers a watcher.
   */
  const rows: SettledAuditRow[] = [];
  for (const subject of buying) {
    /**
     * What the roster said about this one.
     */
    // oxlint-disable-next-line no-await-in-loop -- sequential by design: every subject shares one roster, and concurrent asks would interleave the progress stream a long run exists to be watched through
    const row = await auditOne({ subject, },);
    rows.push(row,);
    printRow({ row, },);
  }

  /**
   * Digest over built output, which is the only identity that moves when the
   * code moves but the commit does not.
   */
  const { digest: pipelineDigest, } = await digestPipeline({ dir: import.meta.dirname, },);

  /**
   * Where this run was kept, said out loud so the answers are findable.
   */
  const keptAt = await persistProbeRun({
    runsDir: await resolveRunsDir(),
    probeName: PROBE_NAME,
    run: {
      startedAt,
      finishedAt: new Date().toISOString(),
      pipelineDigest,
      roster: RUN_MODELS.checkerModelIds,
      subject: {
        archiveDir: asked.archiveDir,
        cloneDir: asked.cloneDir,
        cap: asked.cap,
        onlyIds: asked.onlyIds,
        artifacts: readings.map(function named(reading,): Record<string, unknown> {
          /**
           * What this artifact was and what it offered, so a persisted run says
           * which files it read without needing the archive to still exist.
           */
          const {
            runSet,
            artifactFile,
            entryId,
            artifactDigest,
            subjects,
            verification,
          } = reading;

          return {
            runSet,
            artifactFile,
            entryId,
            artifactDigest,
            subjects: subjects.length,
            verification: verification.kind,
          };
        },),
      },
      rows,
    },
  },);
  console.log(`\nkept at ${keptAt}`,);
}

if (import.meta.main)
  await main();

//endregion Settled rendering audit
