import {
  open,
  readdir,
  readFile,
  stat,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { ARTIFACTS_DIR, } from './artifact-file-name.ts';
import {
  type CapLogReading,
  type CapSample,
  readCapLog,
} from './cap-census-read.ts';
import { wordForCount, } from '../count-word.ts';
import {
  capCensus,
  type CapCensusRow,
  type CapFlag,
  capFlagsOf,
  type ProviderCapReading,
} from './cap-census-rule.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import type { CommandLineOf, } from './command-lines.ts';
import {
  PROMPT_PAYLOADS_DIR,
  SLICE_CACHE_DIR,
} from './runs-layout.ts';

//region Cap census
// THE PRE-LAUNCH READING OF THE COMPLETION CAPS (ledger P10). Reads pass-run
// logs, applies the cap rule per seat, and says where a card and its calls
// disagree. Spends no quota and touches no model.
//
// PASS-RUN LOGS ONLY, as the 2026-09-28 re-read learned (ledger P7): suite,
// build and prototype logs carry fixture `SPEND` lines, so a log counts only
// when a line in its first few kilobytes opens `START tip=`.
//
// ONE LOG AT A TIME. The agent root holds thousands of logs, some large; each
// is opened only far enough to read its head, and a pass-run log's text is
// dropped once its samples are read, so memory holds samples, not logs.
//
// PRINTS IDS AND NUMBERS. A run log holds unlicensed corpus wording, and
// nothing here reads past the two line kinds the census needs.

/**
 How deep below a named directory the walk goes: the run directories under the
 agent root sit one or two levels down.
 */
const MAX_DEPTH = 3;

/**
 Directories that hold no run log and are large: caches, artifacts, payloads.
 */
const SKIPPED_DIRS: ReadonlySet<string> = new Set([
  SLICE_CACHE_DIR,
  ARTIFACTS_DIR,
  'node_modules',
  PROMPT_PAYLOADS_DIR,
],);

/**
 Bytes at the head of a log searched for the pass-run marker.
 */
const HEAD_BYTES = 4_096;

/**
 Line a pass run opens its log with.
 */
const PASS_RUN_MARKER = 'START tip=';

/**
 Multiplier turning a fraction into a percentage.
 */
const PERCENT = 100;

/**
 One path the walk has yet to visit.
 */
type PendingPath = {
  /**
   Path to visit.
   */
  readonly path: string;

  /**
   How far below its named root it sits.
   */
  readonly depth: number;
};

/**
 What visiting one path found.
 */
type Visit =
  | { readonly kind: 'log'; }
  | {
    readonly kind: 'children';
    readonly children: readonly PendingPath[]
  }
  | { readonly kind: 'nothing'; }
  | { readonly kind: 'unreadable'; };

/**
 Visits one path of the walk.

 @param next - path and depth

 @returns Whether it is a log, a directory with children to visit, nothing to
 read, or unreadable

 @example
 ```ts
 const found = await visit({ next: { path: '/runs', depth: 0, }, },);
 ```
 */
async function visit({ next, }: { readonly next: PendingPath; },): Promise<Visit> {
  try {
    /**
     What the path is.
     */
    const info = await stat(next.path,);
    if (info.isFile())
      return next.path
        .endsWith('.log',) ? { kind: 'log', } : { kind: 'nothing', };
    if ((!info.isDirectory()) || (next.depth > MAX_DEPTH))
      return { kind: 'nothing', };

    /**
     The directory's entries.
     */
    const names = await readdir(next.path,);
    return {
      kind: 'children',
      children: names
        .filter(function visited(name,): boolean {
          return !SKIPPED_DIRS.has(name,);
        },)
        .map(function child(name,): PendingPath {
          return {
            path: join(
              next.path,
              name,
            ),
            depth: next.depth + 1,
          };
        },),
    };
  }
  catch (error) {
    // A PATH THE WALK CANNOT READ IS COUNTED, NOT FATAL: the agent root holds
    // other sessions' directories this user cannot open.
    console.error(`cap-census: cannot read ${next.path}: ${String(error,)}`,);
    return { kind: 'unreadable', };
  }
}

/**
 Every `.log` file under the named paths, files named directly included.

 @param roots - files or directories named on the command line

 @returns Log paths, and how many paths the walk could not read

 @example
 ```ts
 const { logs, unreadable, } = await logsUnder({ roots: ['/runs',], },);
 ```
 */
async function logsUnder(
  { roots, }: { readonly roots: readonly string[]; },
): Promise<{
  readonly logs: readonly string[];
  readonly unreadable: number
}> {
  /**
   Paths still to visit, a work stack so the walk needs no recursion.
   */
  const pending: PendingPath[] = roots.map(function rootOf(path,): PendingPath {
    return {
      path,
      depth: 0,
    };
  },);

  /**
   Log files found.
   */
  const logs: string[] = [];

  /**
   Paths the walk could not read.
   */
  const unreadable: string[] = [];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    /* oxlint-disable no-await-in-loop -- a work-stack walk: each directory's entries decide what is visited next */
    /**
     What this path turned out to be.
     */
    const found = await visit({ next, },);
    /* oxlint-enable no-await-in-loop */
    if (found.kind === 'log')
      logs.push(next.path,);
    else if (found.kind === 'children')
      pending.push(...found.children,);
    else if (found.kind === 'unreadable')
      unreadable.push(next.path,);
    // A PATH THAT IS NEITHER, a file other than a log or a directory past the
    // depth, has nothing to read.
  }
  return {
    logs,
    unreadable: unreadable.length,
  };
}

/**
 Reads one log's samples when it is a pass-run log.

 @param path - log file

 @returns Its samples and the lines it left out for their stamp, or that it
 is no pass-run log

 @example
 ```ts
 const read = await passRunReadingOf({ path, },);
 ```
 */
async function passRunReadingOf(
  { path, }: { readonly path: string; },
): Promise<CapLogReading | 'not-a-pass-run'> {
  /**
   Head of the log, read without reading the rest.
   */
  const head = await (async function readHead(): Promise<string> {
    /**
     The open log, closed when the head is read.
     */
    await using handle = await open(path,);

    /**
     Buffer the head is read into.
     */
    const buffer = Buffer.alloc(HEAD_BYTES,);

    /**
     Bytes the read filled.
     */
    const { bytesRead, } = await handle.read(
      buffer,
      0,
      HEAD_BYTES,
      0,
    );
    return buffer.toString(
      'utf8',
      0,
      bytesRead,
    );
  })();
  if (!head.split('\n',)
    .some(function opensRun(line,): boolean {
    return line.startsWith(PASS_RUN_MARKER,);
  },))
    return 'not-a-pass-run';
  return readCapLog({
    lines: (await readFile(
      path,
      'utf8',
    )).split('\n',),
  },);
}

/**
 Renders one provider's two readings.

 @param reading - the provider's calls of one seat

 @returns Line for the report

 @example
 ```ts
 console.log(providerLine({ reading, },),);
 ```
 */
function providerLine({ reading, }: { readonly reading: ProviderCapReading; },): string {
  /**
   Share of capped calls that ran to the cap.
   */
  const share = (reading.sinceCaps === 0)
    ? 'n/a'
    : `${((reading.atCap / reading.sinceCaps) * PERCENT).toFixed(2,)}%`;
  return `  ${reading.provider}: ${String(reading.calls,)} ${
    wordForCount({
      count: reading.calls,
      one: 'call',
      many: 'calls',
    },)
  }, p99 ${String(reading.p99,)}; since the caps `
    + `${String(reading.sinceCaps,)} ${
      wordForCount({
        count: reading.sinceCaps,
        one: 'call',
        many: 'calls',
      },)
    }, ${String(reading.atCap,)} at the cap (${share}): `
    + `${String(reading.atCapWithContent,)} with content, ${String(reading.atCapNoContent,)} with none, `
    + `${String(reading.atCapUnpaired,)} unpaired`;
}

/**
 What each flag says, in the words the report prints.
 */
const FLAG_TEXT: Readonly<Record<CapFlag, (row: CapCensusRow,) => string>> = {
  'placeholder-with-calls': function placeholderText(): string {
    return 'PLACEHOLDER WITH A DISTRIBUTION: the card names the pooled 99th and its calls now read by the rule';
  },
  'rule-off-card': function offCardText(row,): string {
    return `RULE READS ${String(row.ruleCap,)} AGAINST THE CARD'S ${String(row.cardCap,)}`;
  },
  'cuts-over-share': function cutsText(): string {
    return 'CUTS OVER ONE PERCENT on at least one provider with enough calls to say';
  },
};

/**
 Reads the named logs and prints the census.

 Returns nothing: the report on stdout IS the output.

 @param line - the census's command line, read whole by `reportingRefusals`,
 which refuses it when no path is named

 @example
 ```ts
 await reportCapCensus({ line, },);
 ```
 */
async function reportCapCensus({ line, }: { readonly line: CommandLineOf<'cap-census'>; },): Promise<void> {
  /**
   Files or directories named on the command line.
   */
  const roots = line.positionals;

  /**
   Every log under the roots.
   */
  const {
    logs,
    unreadable,
  } = await logsUnder({ roots, },);

  /**
   Completed calls across every pass-run log.
   */
  const samples: CapSample[] = [];

  /**
   Pass-run logs read, one entry each.
   */
  const passRunLogs: string[] = [];

  /**
   Lines those logs left out for a stamp the logger did not write.
   */
  const unstamped = { lines: 0, };
  for (const path of logs) {
    /* oxlint-disable no-await-in-loop -- one log at a time, so memory holds samples rather than every log's text */
    /**
     This log's samples, or that it is no pass run.
     */
    const read = await passRunReadingOf({ path, },);
    /* oxlint-enable no-await-in-loop */
    if (read !== 'not-a-pass-run') {
      passRunLogs.push(path,);
      unstamped.lines += read.unstampedLines;
      // ONE AT A TIME, NOT SPREAD: one log can hold more calls than a call's
      // argument list takes.
      for (const sample of read.samples)
        samples.push(sample,);
    }
  }

  /**
   The rule applied per seat.
   */
  const census = capCensus({ samples, },);
  console.log(
    `cap-census: ${String(logs.length,)} ${
      wordForCount({
        count: logs.length,
        one: 'log',
        many: 'logs',
      },)
    }, ${String(passRunLogs.length,)} pass-run ${
      wordForCount({
        count: passRunLogs.length,
        one: 'log',
        many: 'logs',
      },)
    }, `
      + `${String(samples.length,)} completed ${
        wordForCount({
          count: samples.length,
          one: 'call',
          many: 'calls',
        },)
      }, ${String(census.offRoster,)} on ids no card names, `
      + `${String(unreadable,)} ${
        wordForCount({
          count: unreadable,
          one: 'path',
          many: 'paths',
        },)
      } unreadable; `
      + `lines left out for a stamp the logger did not write: ${String(unstamped.lines,)}`,
  );
  for (const row of census.rows) {
    console.log(
      `${row.modelId}: card cap ${String(row.cardCap,)}${row.placeholder ? ' (pooled placeholder)' : ''}, `
        + `rule reads ${(row.ruleCap === 'too-few-calls') ? 'nothing (too few calls)' : String(row.ruleCap,)}`,
    );
    for (const reading of row.providers)
      console.log(providerLine({ reading, },),);
    for (const flag of capFlagsOf({ row, },))
      console.log(`  ${FLAG_TEXT[flag](row,)}`,);
  }
  console.log(
    'A rule reading can differ from a card for reasons that are not the model: a narrower log scope than the '
      + '2026-09-09 table, calls from before the caps, or calls the cap itself cut. Read each provider\'s cut '
      + 'columns before moving a cap; completion-cap.ts records the 2026-09-28 reading.',
  );
}

if (import.meta.main)
  await reportingRefusals({
    what: 'cap-census',
    argv: process.argv,
    run: reportCapCensus,
  },);

//endregion Cap census
