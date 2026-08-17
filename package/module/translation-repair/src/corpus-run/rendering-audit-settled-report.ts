import {
  readdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  requireRecord,
  requireString,
} from '../artifact-guard.ts';

import { repeatBandOf, } from './rendering-audit-settled-band.ts';
import {
  printBand,
  printRelocations,
  printSplit,
  printVoices,
} from './rendering-audit-settled-print.ts';
import {
  rateByVoice,
  splitFor,
} from './rendering-audit-settled-read.ts';
import { auditRelocationPairs, } from './rendering-audit-settled-relocation.ts';
import {
  auditRepeatsAcross,
  auditRepeatsWithin,
} from './rendering-audit-settled-repeat.ts';
import type { SettledAuditRow, } from './rendering-audit-settled-row.ts';
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
 * Directory the settled audit collects its runs in.
 */
const PROBE_NAME = 'rendering-audit-settled';

/**
 * Reads the persisted rows of one run.
 *
 * VALIDATES ONLY WHAT THE READINGS TOUCH, and says so: a full parser for a
 * shape this module also writes would be two copies of one contract, and the
 * questions here are answered from a handful of fields.
 *
 * @param path - persisted run file
 *
 * @returns Rows as the probe wrote them, and the archive that run named
 *
 * @throws {@link ArtifactParseError} when the file is not an object
 *
 * @throws {@link Error} when it carries no rows array, which means it is not a
 * run of this probe rather than that the run was quiet
 *
 * @example
 * ```ts
 * const { rows, archiveDir, } = await readRunRows({ path, },);
 * ```
 */
async function readRunRows(
  { path, }: { readonly path: string; },
): Promise<{
  readonly rows: readonly SettledAuditRow[];
  readonly archiveDir: string;
}> {
  /**
   * Run as written.
   */
  const run = requireRecord({
    value: JSON.parse(await readFile(
      path,
      'utf8',
    ),),
    path,
  },);

  /**
   * Rows the run carries, still untyped.
   */
  const rows: unknown = run.rows;
  if (!Array.isArray(rows,))
    throw new Error(`${path} carries no rows array`,);

  /**
   * What that run was pointed at, in its own words.
   *
   * FROM THE FILE, never from this invocation's arguments. Reading an old run
   * with `--run` would otherwise print the archive THIS command defaulted to
   * and attribute the rows to it, which is a confident misstatement of where
   * they came from.
   */
  const subject = requireRecord({
    value: run.subject,
    path: `${path}.subject`,
  },);

  return {
    rows: rows as readonly SettledAuditRow[],
    archiveDir: requireString({
      value: subject.archiveDir,
      path: `${path}.subject.archiveDir`,
    },),
  };
}

/**
 * Finds the newest run of this probe.
 *
 * Names sort lexically by the instant they carry, so the last name is the
 * newest run without reading a single file.
 *
 * @param runsDir - resolved runs directory
 *
 * @returns Path of the newest run
 *
 * @throws {@link Error} when the probe has never run, since reporting nothing
 * would look exactly like reporting a clean run
 *
 * @example
 * ```ts
 * const path = await newestRun({ runsDir, },);
 * ```
 */
async function newestRun({ runsDir, }: { readonly runsDir: string; },): Promise<string> {
  /**
   * Where runs of this probe collect.
   */
  const probeDir = join(
    runsDir,
    PROBE_NAME,
  );

  /**
   * Every run kept, oldest first.
   */
  const kept = (await readdir(probeDir,))
    .filter(function isRun(name,): boolean {
      return name.endsWith('.json',);
    },)
    .toSorted();

  /**
   * Newest, which is the last name.
   */
  const newest = kept.at(-1,);
  if (newest === undefined)
    throw new Error(`${probeDir} holds no run of ${PROBE_NAME}`,);
  return join(
    probeDir,
    newest,
  );
}

/**
 * Reads the run file named after a flag, when one was named.
 *
 * @param argv - process arguments
 *
 * @param flag - flag to look for
 *
 * @returns Path as written, empty when the flag was absent
 *
 * @example
 * ```ts
 * const named = namedRun({ argv: process.argv, flag: '--run', },);
 * ```
 */
function namedRun(
  {
    argv,
    flag,
  }: {
    readonly argv: readonly string[];
    readonly flag: string;
  },
): string {
  /**
   * Where the flag was written.
   */
  const at = argv.indexOf(flag,);
  if (at === (-1))
    return '';
  return argv[at + 1] ?? '';
}

/**
 * Pairs this run against an earlier one and prints the spread.
 *
 * @param rows - rows of the run being reported
 *
 * @param against - path of the run to pair against
 *
 * @example
 * ```ts
 * await printAcross({ rows, against, },);
 * ```
 */
async function printAcross(
  {
    rows,
    against,
  }: {
    readonly rows: readonly SettledAuditRow[];
    readonly against: string;
  },
): Promise<void> {
  /**
   * Rows of the run being compared against.
   */
  const { rows: earlier, } = await readRunRows({ path: against, },);

  /**
   * Subjects both runs bought, and slots where the text moved under them.
   */
  const {
    paired,
    textMoved,
  } = auditRepeatsAcross({
    first: earlier,
    second: rows,
  },);

  printBand({
    band: repeatBandOf({ pairs: paired, },),
    over: `the same subjects in ${against}`,
  },);
  if (textMoved.length > 0)
    console.log(
      `  ${
        String(textMoved.length,)
      } slots matched by position and NOT by text, so the archive moved between`
        + ` the two runs and these are left out: ${textMoved.join(', ',)}`,
    );
}

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
   * Run to read: whatever was named, else the newest kept.
   */
  const named = namedRun({
    argv: process.argv,
    flag: '--run',
  },);

  /**
   * File this report reads, which is the newest kept when none was named.
   */
  const path = (named === '')
    ? await newestRun({ runsDir: await resolveRunsDir(), },)
    : named;

  /**
   * Earlier run to pair against, empty when none was named.
   */
  const against = namedRun({
    argv: process.argv,
    flag: '--against',
  },);

  /**
   * Rows that run bought, and where it said it read them from.
   */
  const {
    rows,
    archiveDir,
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

  printVoices({ rates: rateByVoice({ rows, },), },);
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
  await main();

//endregion Settled audit report
