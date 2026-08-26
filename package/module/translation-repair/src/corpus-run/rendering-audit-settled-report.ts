import { reportingRefusals, } from './cli-refusal.ts';
import { readReportArguments, } from './rendering-audit-settled-args.ts';
import { repeatBandOf, } from './rendering-audit-settled-band.ts';
import {
  printBand,
  printRelations,
  printRelocations,
  printSplit,
  printVoices,
} from './rendering-audit-settled-print.ts';
import {
  rateByVoice,
  splitFor,
} from './rendering-audit-settled-read.ts';
import { relationTallyOf, } from './rendering-audit-settled-relation.ts';
import { auditRelocationPairs, } from './rendering-audit-settled-relocation.ts';
import { auditRepeatsWithin, } from './rendering-audit-settled-repeat.ts';
import {
  newestRun,
  printAcross,
  readRunRows,
} from './rendering-audit-settled-runs.ts';
import { resolveRunsDir, } from './run-config.ts';

//region Settled audit report
// Prints the readings `#115` owes, from a run already on disk.
//
// SPENDS NOTHING. The rows were bought once; every question anyone asks of them
// afterwards should be free, or it will not get asked twice.
//
// READS THE NEWEST RUN by default, because these probes accumulate on purpose:
// the store keeps every run so a verdict can be compared against the one it was
// bought to be compared against, and a reader that silently merged them would
// undo that.
//
// `--against <run>` PAIRS TWO RUNS subject by subject, which is the only way to
// state the spread this instrument moves through on unchanged input. Without
// it, the archive-versus-fresh comparison is a difference with no scale to read
// it against.

/**
 * Reads a persisted run and prints what it amounts to.
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * What the command line named, with a valueless flag refused rather than
   * read as absent: `--run` written last used to report the newest run and
   * `--against` written last used to print no across-run band, in silence.
   */
  const asked = readReportArguments({ argv: process.argv, },);

  /**
   * Run named with `--run`, absent when the newest kept run is meant.
   */
  const [named,] = asked.run;

  /**
   * File this report reads, which is the newest kept when none was named.
   */
  const path = named ?? await newestRun({ runsDir: await resolveRunsDir(), },);

  /**
   * Earlier run to pair against, empty when none was named.
   */
  const against = asked.against[0] ?? '';

  /**
   * Rows that run bought, and where it said it read them from.
   */
  const {
    rows,
    archiveDir,
    roster,
  } = await readRunRows({ path, },);
  console.log(`${path}\n${String(rows.length,)} subjects\n`,);

  console.log('THE TWO HALVES, READ APART',);
  printSplit({
    split: splitFor({
      rows,
      audits: 'archive',
    },),
  },);
  printSplit({
    split: splitFor({
      rows,
      audits: 'fresh',
    },),
  },);

  printRelations({ tallies: relationTallyOf({ rows, },), },);
  printVoices({
    rates: rateByVoice({
      rows,
      roster,
    },),
  },);
  printRelocations({ pairs: auditRelocationPairs({ rows, },), },);
  printBand({
    band: repeatBandOf({ pairs: auditRepeatsWithin({ rows, },), },),
    over: 'texts this run audited twice',
  },);
  if (against !== '')
    await printAcross({
      rows,
      against,
    },);

  // Said every time, because the numbers above are the ones most likely to be
  // quoted without it.
  console.log(
    `\nTWO ENTRIES. Nothing here settles anything about a particular entry, and nothing here may`
      + ` gate what ships: the instrument's own error rate is unmeasured (#66, #68).`
      + `\nArchive that run read: ${archiveDir}`,
  );
}

if (import.meta.main)
  await reportingRefusals({
    what: 'rendering-audit-settled-report',
    run: main,
  },);

//endregion Settled audit report
