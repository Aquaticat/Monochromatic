import { reportingRefusals, } from './cli-refusal.ts';
import type { CommandLineOf, } from './command-lines.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';
import { digestPipeline, } from './pipeline-digest.ts';
import { persistProbeRun, } from './probe-store.ts';
import { readRunnerClosure, } from './runner-closure.ts';
import { readAuditArguments, } from './rendering-audit-settled-args.ts';
import {
  auditOne,
  capped,
  eligibleSubjects,
  printPopulation,
  withCitedReferences,
} from './rendering-audit-settled-buy.ts';
import {
  type SettledAuditRow,
  SETTLED_AUDIT_PROBE,
} from './rendering-audit-settled-row.ts';
import {
  pageRelationFor,
  pageRelationLabel,
} from './rendering-audit-settled-relation.ts';
import { readArchiveSubjects, } from './rendering-audit-settled-input.ts';
import { RUN_OUTSIDE_READS, } from './pass-outside-reads.ts';
import {
  createRunClient,
  resolveRunsDir,
  RUN_MODELS,
} from './run-config.ts';

//region Settled rendering audit
// Runs the rendering audit over every decided slice of every settled version 2
// artifact in an archive, and keeps what it heard.
//
// THIS IS TELEMETRY AND NOTHING ELSE. The producing path does not change, and
// nothing this reports may gate what ships. The instrument's own production
// error rate is unmeasured: its false-negative half is open, and a measurement
// found one of the three checkers raises claims at a tenth the rate of
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
// THE RELOCATION RULE WAS FIXED BEFORE THE RUN. Per-slice judging
// cannot tell a relocation from a fabrication, so a passage the archive carried
// across a slice boundary reads as an omission on one slice and an unsupported
// addition on its neighbour. Paired omission and addition findings on ADJACENT
// slices of one entry count as ONE relocation. Written down here because
// deciding it after seeing the tally is a goalpost move.

/**
 Prints one audited slice as it lands, so a long run can be watched.
 
 @param row - what the roster said about one slice
 
 @example
 ```ts
 printRow({ row, },);
 ```
 */
function printRow({ row, }: { readonly row: SettledAuditRow; },): void {
  /**
   Where this slice came from and what the two tiers made of it.
   */
  const {
    runSet,
    entryId,
    sliceIndex,
    auditsArchiveText,
    report,
  } = row;

  /**
   Whether a later stage overruled the wording just audited.
   
   PRINTED BESIDE the archive-versus-fresh token rather than replacing it.
   `FRESH` says the lane produced this wording, which stays true however
   the contest and the consolidation later ruled; without the relation
   beside it a watcher reads every `FRESH` line as the product.
   */
  const relation = pageRelationFor({ row, },);

  /**
   Both agreement tiers, the near misses, the degradation and every voice.
   */
  const {
    corroborated,
    agreed,
    near,
    findings,
    rows,
  } = report;

  /**
   Claims that anchored, across the whole roster.
   
   PRINTED BESIDE THE TIERS because the difference between them is the
   measurement: voices that claimed plenty and agreed on none says something
   about the matcher, and a silent roster says something else entirely.
   */
  const claimed = rows.reduce(
    function total(
      sum,
      voice,
    ): number {
      /**
       What this voice claimed that anchored.
       */
      const { findings: anchored, } = voice;
      return sum + anchored.length;
    },
    0,
  );

  console.log(
    `${runSet}/${entryId}#${String(sliceIndex,)} ${
      auditsArchiveText ? 'ARCHIVE' : 'FRESH  '
    } ${pageRelationLabel({ relation, },)} claimed=${String(claimed,)} corroborated=${
      String(corroborated.length,)
    } agreed=${
      String(agreed.length,)
    } near=${String(near.length,)}${
      (findings.length === 0) ? '' : ` degraded=${String(findings.length,)}`
    }`,
  );
}

/**
 Reads the archive, audits what was asked for, and keeps the answers.
 
 @throws {@link StatedRefusalError} when the archive holds nothing to audit,
 which means the run was pointed somewhere wrong rather than that everything
 is clean
 
 @param line - the audit's command line, read whole by `reportingRefusals`
 
 @example
 ```ts
 await main({ line, },);
 ```
 */
async function main({ line, }: { readonly line: CommandLineOf<'rendering-audit-settled'>; },): Promise<void> {
  /**
   When this invocation began, read before any call so the record dates the
   run rather than the moment it happened to finish.
   */
  const startedAt = new Date().toISOString();

  /**
   Digest over built output, which is the only identity that moves when the
   code moves but the commit does not.
   
   READ AT THE START, not at the end, and that ordering is the whole point.
   A long run gives a developer plenty of time to rebuild, and this probe was
   caught doing exactly that: `dist` was rebuilt while a 40-subject run was in
   flight, so the digest the run was about to stamp described a build that had
   never audited anything. Node loads the code once, at startup; the identity
   that answers for a run is the one present THEN.
   */
  const { digest: pipelineDigest, } = await digestPipeline({ dir: import.meta.dirname, },);

  /**
   Chunks this entry imports, read from the executing file at run START for
   the same reason the digest is: a rebuild mid-run would otherwise stamp a
   build that never ran.
   */
  const runnerClosure = await readRunnerClosure({ entryPath: line.script, },);

  /**
   What the command line asked for.
   */
  const asked = readAuditArguments({ line, },);

  /**
   Every artifact the archive holds, parsed, re-prepared and verified. Free.
   */
  const readings = await readArchiveSubjects({
    archiveDir: asked.archiveDir,
    cloneDir: asked.cloneDir,
  },);

  // BEFORE anything is printed. An archive with nothing in it means the run was
  // pointed somewhere wrong, and a population report followed by `BUYING 0 of 0`
  // reads like a clean archive right up until the throw.
  if (readings.length === 0)
    throw new StatedRefusalError({ says: `no artifacts under ${asked.archiveDir}`, },);

  printPopulation({ readings, },);

  /**
   Subjects the entry filter left, which is what a capped buy is a fraction of.
   */
  const eligible = eligibleSubjects({
    readings,
    onlyIds: asked.onlyIds,
  },);

  /**
   Subjects this run will buy.
   */
  const buying = capped({
    eligible,
    cap: asked.cap,
  },);
  console.log(
    `\nBUYING ${String(buying.length,)} of ${String(eligible.length,)} selectable subjects\n`,
  );

  /**
   What the roster said about each, in order.
   
   SEQUENTIAL rather than concurrent: these share one roster, and interleaved
   progress lines would make the stream unreadable, which is the only thing a
   long run offers a watcher.
   */
  const rows: SettledAuditRow[] = [];
  if (buying.length > 0) {
    /**
     One client for the whole run, built here rather than per subject: a
     client carries the provider seats, and the seat report reads one
     run-wide tally, so one client is what a run is. Built only once
     something is bought, so `--cap 0`, the wiring check that reads the
     archive and asks nobody, still needs no key.
     */
    const client = createRunClient();

    /**
     Every bought subject beside what its page cites, read once per page
     before any roster call, through the reader the producing run used, so
     the auditors see what its critics and panels saw (ledger B29).
     */
    const cited = await withCitedReferences({
      subjects: buying,
      reader: RUN_OUTSIDE_READS.references,
    },);
    for (const {
      subject,
      references,
    } of cited) {
      /* oxlint-disable no-await-in-loop -- sequential by design: every subject shares one roster, and concurrent asks would interleave the progress stream a long run exists to be watched through */
      /**
       What the roster said about this one.
       */
      const row = await auditOne({
        subject,
        references,
        client,
      },);
      /* oxlint-enable no-await-in-loop */
      rows.push(row,);
      printRow({ row, },);
    }
  }

  /**
   Where this run was kept, said out loud so the answers are findable.
   */
  const keptAt = await persistProbeRun({
    runsDir: await resolveRunsDir(),
    probeName: SETTLED_AUDIT_PROBE,
    run: {
      startedAt,
      finishedAt: new Date().toISOString(),
      pipelineDigest,
      runnerClosure,
      roster: RUN_MODELS.checkerModelIds,
      subject: {
        archiveDir: asked.archiveDir,
        cloneDir: asked.cloneDir,
        cap: asked.cap,
        onlyIds: asked.onlyIds,
        artifacts: readings.map(function named(reading,): Record<string, unknown> {
          /**
           What this artifact was and what it offered, so a persisted run says
           which files it read without needing the archive to still exist.
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
  await reportingRefusals({
    what: 'rendering-audit-settled',
    argv: process.argv,
    run: main,
  },);

//endregion Settled rendering audit
