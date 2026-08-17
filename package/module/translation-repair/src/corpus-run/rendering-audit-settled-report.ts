import {
  readdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { requireRecord, } from '../artifact-guard.ts';

import { readAuditArguments, } from './rendering-audit-settled-args.ts';
import {
  type AudienceSplit,
  rateByVoice,
  splitFor,
} from './rendering-audit-settled-read.ts';
import { auditRelocationPairs, } from './rendering-audit-settled-relocation.ts';
import type { SettledAuditRow, } from './rendering-audit-settled-row.ts';
import { resolveRunsDir, } from './run-config.ts';

//region Settled audit report
// Prints the three readings `#115` owes, from a run already on disk.
//
// SPENDS NOTHING. The rows were bought once; every question anyone asks of them
// afterwards should be free, or it will not get asked twice.
//
// READS THE NEWEST RUN by default, because these probes accumulate on purpose:
// the store keeps every run so a verdict can be compared against the one it was
// bought to be compared against, and a reader that silently merged them would
// undo that.

/**
 * Width model ids are padded to, so a column of rates reads down the page.
 */
const MODEL_COLUMN = 48;

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
 * @returns Rows as the probe wrote them
 *
 * @throws {@link ArtifactParseError} when the file is not an object
 *
 * @throws {@link Error} when it carries no rows array, which means it is not a
 * run of this probe rather than that the run was quiet
 *
 * @example
 * ```ts
 * const rows = await readRunRows({ path, },);
 * ```
 */
async function readRunRows(
  { path, }: { readonly path: string; },
): Promise<readonly SettledAuditRow[]> {
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

  return rows as readonly SettledAuditRow[];
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
 * Reads the run file named after `--run`, when one was named.
 *
 * @param argv - process arguments
 *
 * @returns Path as written, empty when no run was named
 *
 * @example
 * ```ts
 * const named = namedRun({ argv: process.argv, },);
 * ```
 */
function namedRun({ argv, }: { readonly argv: readonly string[]; },): string {
  /**
   * Where the flag was written.
   */
  const at = argv.indexOf('--run',);
  if (at === (-1))
    return '';
  return argv[at + 1] ?? '';
}

/**
 * Prints one half of the population.
 *
 * @param split - that half, summed
 *
 * @example
 * ```ts
 * printSplit({ split, },);
 * ```
 */
function printSplit({ split, }: { readonly split: AudienceSplit; },): void {
  /**
   * Everything this half amounts to.
   */
  const {
    audits,
    subjects,
    claimed,
    subjectsWithClaims,
    corroborated,
    agreed,
    near,
    degraded,
  } = split;

  console.log(
    `  ${(audits === 'archive') ? 'ARCHIVE text' : 'FRESH   text'}  subjects=${
      String(subjects,)
    }  drew a claim=${String(subjectsWithClaims,)}  claims=${String(claimed,)}  corroborated=${
      String(corroborated,)
    }  agreed=${String(agreed,)}  near=${String(near,)}  degraded=${String(degraded,)}`,
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
   * Command line, reused for its `--archive` flag, which here names a run file
   * rather than an archive when one is given.
   */
  const asked = readAuditArguments({ argv: process.argv, },);

  /**
   * Run to read: whatever was named, else the newest kept.
   */
  const named = namedRun({ argv: process.argv, },);

  /**
   * File this report reads, which is the newest kept when none was named.
   */
  const path = (named === '') ? await newestRun({ runsDir: await resolveRunsDir(), },) : named;

  /**
   * Rows that run bought.
   */
  const rows = await readRunRows({ path, },);
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

  console.log('\nWHAT EACH AUDITOR THOUGHT WAS WORTH A CLAIM',);
  rateByVoice({ rows, },)
    .forEach(function printRate(rate,): void {
      /**
       * This auditor's tally.
       */
      const {
        modelId,
        asked: timesAsked,
        spoke,
        claims,
        dropped,
      } = rate;

      console.log(
        `  ${modelId.padEnd(
          MODEL_COLUMN,
          ' ',
        )} asked=${String(timesAsked,)} spoke on=${String(spoke,)} claims=${
          String(claims,)
        } dropped=${String(dropped,)}`,
      );
    },);

  /**
   * Omission and addition claims on neighbouring slices, which `#107` says are
   * one relocation rather than two defects.
   */
  const pairs = auditRelocationPairs({ rows, },);
  console.log(`\nRELOCATION CANDIDATES (#107): ${String(pairs.length,)}`,);
  pairs.forEach(function printPair(pair,): void {
    console.log(
      `  ${pair.runSet}/${pair.entryId}  omission at ${String(pair.omissionAt,)} <-> addition at ${
        String(pair.additionAt,)
      }`,
    );
  },);

  // Said every time, because the number above is the one most likely to be
  // quoted without it.
  console.log(
    `\nTWO ENTRIES. Nothing here settles anything about a particular entry, and nothing here may`
      + ` gate what ships: the instrument's own error rate is unmeasured (#66, #68).`
      + `\nArchive read from ${asked.archiveDir}`,
  );
}

if (import.meta.main)
  await main();

//endregion Settled audit report
