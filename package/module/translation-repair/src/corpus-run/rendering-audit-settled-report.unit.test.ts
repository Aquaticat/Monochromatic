/**
 * Tests for the report over a persisted rendering audit, and for both CLIs at
 * their boundary.
 *
 * NO CASE REACHED THESE BEFORE. `readRunRows` decides what a report is a
 * report of, `newestRun` decides which run is meant when none is named, and
 * `printAcross` is the only across-run reading; each is exported through the
 * barrel for exactly this. The two commands are then run as built, against
 * throwaway runs and an empty archive, so the refusal policy rendering-7 set
 * (a stated refusal exits 6 with its line and no frames) is proved at the
 * boundary an operator meets rather than at the throw.
 *
 * DISPOSABLE FIXTURES ONLY: every run is written under its own `mkdtemp`
 * directory, in the shape the probe store writes, and nothing here reads a
 * real run.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import {
  mkdir,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  digestAuditedText,
  newestRun,
  printAcross,
  readRunRows,
  type SettledAuditRow,
  StatedRefusalError,
} from '../../dist/final/node/index.mjs';

/**
 * Directory the probe store collects this probe's runs in.
 */
const PROBE_NAME = 'rendering-audit-settled';

/**
 * Exit code `reportingRefusals` sets for a stated refusal.
 */
const REFUSED_AS_STATED = 6;

/**
 * Exit reported when the child ended on a signal and so has no code.
 */
const SIGNALLED = -1;

/**
 * Built report command under test.
 */
const REPORT_COMMAND = join(
  import.meta.dirname,
  '../../dist/final/node/rendering-audit-settled-report.mjs',
);

/**
 * Built audit command under test.
 */
const AUDIT_COMMAND = join(
  import.meta.dirname,
  '../../dist/final/node/rendering-audit-settled.mjs',
);

/**
 * Roster every fixture run records.
 */
const ROSTER = [
  'hf:cat/Tabby-1',
  'hf:cat/Mouser-1',
];

/**
 * Archive every fixture run says it read, a label only.
 */
const ARCHIVE = '/nowhere/naptime-archive';

/**
 * Characters in a SHA-1 object id.
 */
const OBJECT_ID_LENGTH = 40;

/**
 * One pair of texts, used wherever two rows are meant to match.
 */
const SAME_TEXTS = {
  sourceText: '毛毛跳上窗台。',
  candidateText: 'Mittens jumped onto the windowsill.',
} as const;

/**
 * A different rendering of the same original.
 */
const OTHER_TEXTS = {
  sourceText: '毛毛跳上窗台。',
  candidateText: 'Mittens hopped up on the sill.',
} as const;

/**
 * Builds one audited slice as the probe persists it.
 *
 * @param sliceIndex - slice index
 *
 * @param texts - what the audit was shown, omitted to leave it unrecorded
 *
 * @returns Row shaped as the probe persists it
 *
 * @example
 * ```ts
 * const row = rowFor({ sliceIndex: 0, texts: SAME_TEXTS, },);
 * ```
 */
function rowFor(
  {
    sliceIndex,
    texts,
  }: {
    readonly sliceIndex: number;
    readonly texts?: {
      readonly sourceText: string;
      readonly candidateText: string;
    };
  },
): SettledAuditRow {
  return {
    runSet: 'naptime-20260825',
    entryId: 'mittens',
    sliceIndex,
    deliveryKind: 'replacement-shipped',
    auditsArchiveText: false,
    pageRelation: { kind: 'survives', },
    artifactDigest: 'sha256-tree-v1:cafef00d',
    corpusSha: 'b'.repeat(OBJECT_ID_LENGTH,),
    identityKind: 'none',
    ...((texts === undefined) ? {} : { textIdentity: digestAuditedText(texts,), }),
    report: {
      corroborated: [],
      agreed: [],
      near: [],
      findings: [],
      rows: [{
        modelId: ROSTER[0],
        verdict: 'no-defect-found',
        findings: [],
        dropped: [],
      },],
    },
  } as unknown as SettledAuditRow;
}

/**
 * Writes one run file in the shape the probe store writes, under a runs
 * directory of the caller's choosing.
 *
 * @param runsDir - throwaway runs directory
 *
 * @param stamp - filename-safe instant the run started at
 *
 * @param body - top-level fields, which a case may leave incomplete on purpose
 *
 * @returns Path written
 *
 * @example
 * ```ts
 * const path = await writeRun({ runsDir, stamp: '2026-08-25T01-00-00.000Z', body: { rows: [], }, },);
 * ```
 */
async function writeRun(
  {
    runsDir,
    stamp,
    body,
  }: {
    readonly runsDir: string;
    readonly stamp: string;
    readonly body: Readonly<Record<string, unknown>>;
  },
): Promise<string> {
  /**
   * Where runs of this probe collect.
   */
  const probeDir = join(
    runsDir,
    PROBE_NAME,
  );
  await mkdir(
    probeDir,
    { recursive: true, },
  );

  /**
   * Run file, named the way the store names one.
   */
  const path = join(
    probeDir,
    `${stamp}-cafef00d.json`,
  );
  await writeFile(
    path,
    JSON.stringify(
      body,
      undefined,
      2,
    ),
    'utf8',
  );
  return path;
}

/**
 * A complete run over the given rows.
 *
 * @param rows - rows it bought
 *
 * @param roster - roster it recorded, absent to write a run from before the
 * field was kept
 *
 * @returns Top-level fields
 *
 * @example
 * ```ts
 * const body = runOver({ rows: [rowFor({ sliceIndex: 0, },),], roster: ROSTER, },);
 * ```
 */
function runOver(
  {
    rows,
    roster,
  }: {
    readonly rows: readonly SettledAuditRow[];
    readonly roster?: readonly string[];
  },
): Readonly<Record<string, unknown>> {
  return {
    startedAt: '2026-08-25T01:00:00.000Z',
    finishedAt: '2026-08-25T01:10:00.000Z',
    pipelineDigest: 'sha256-tree-v1:cafef00d',
    ...((roster === undefined) ? {} : { roster, }),
    subject: { archiveDir: ARCHIVE, },
    rows,
  };
}

/**
 * Makes a throwaway runs directory.
 *
 * @returns Its path
 *
 * @example
 * ```ts
 * const runsDir = await throwawayRunsDir();
 * ```
 */
async function throwawayRunsDir(): Promise<string> {
  return await mkdtemp(join(
    tmpdir(),
    'rendering-audit-settled-report-',
  ),);
}

/**
 * Captures what is printed, forwarding every line onward; the describe using
 * it runs one case at a time.
 *
 * @param lines - where captured lines go
 *
 * @returns Captured lines, disposable
 *
 * @example
 * ```ts
 * using printed = collectingLines({ lines: [], },);
 * ```
 */
function collectingLines(
  { lines, }: { readonly lines: string[]; },
): { readonly lines: readonly string[]; } & Disposable {
  /**
   * Reporter found on entry, which every line is forwarded to.
   */
  const previous = console.log;

  /**
   * Whether this capture is still recording.
   */
  const recording = { open: true, };

  /**
   * This capture's own wrapper.
   */
  const mine = (...parts: readonly unknown[]): void => {
    if (recording.open) {
      lines.push(parts.map(String,)
        .join(' ',),);
    }
    previous(...parts,);
  };
  console.log = mine;
  return {
    lines,
    [Symbol.dispose]: () => {
      recording.open = false;
      if (console.log === mine)
        console.log = previous;
    },
  };
}

/**
 * What a built command wrote and how it exited.
 */
type CommandRun = {
  /**
   * Exit code, or -1 when the process was signalled.
   */
  readonly code: number;

  /**
   * Everything written to stdout.
   */
  readonly stdout: string;

  /**
   * Everything written to stderr.
   */
  readonly stderr: string;
};

/**
 * Runs a built command with every provider key withheld, so the child can
 * neither refuse for the wrong reason nor spend.
 *
 * @param command - built entry file
 *
 * @param args - arguments after it
 *
 * @returns Exit code and both streams
 *
 * @example
 * ```ts
 * const run = await runBuilt({ command: REPORT_COMMAND, args: ['--run', path,], },);
 * ```
 */
async function runBuilt(
  {
    command,
    args,
  }: {
    readonly command: string;
    readonly args: readonly string[];
  },
): Promise<CommandRun> {
  /**
   * Runner environment with every provider key removed.
   */
  const env = Object.fromEntries(
    Object
      .entries(process.env,)
      .filter(function keepsNoKey([name,],): boolean {
        return !name.endsWith('_API_KEY',);
      },),
  );

  /**
   * Child running the command.
   */
  const child = spawn(
    process.execPath,
    [
      command,
      ...args,
    ],
    {
      cwd: join(
        import.meta.dirname,
        '../..',
      ),
      env: {
        ...env,
        TRANSLATION_REPAIR_RUNS_DIR: await throwawayRunsDir(),
      },
      stdio: [
        'ignore',
        'pipe',
        'pipe',
      ],
    },
  );

  /**
   * Both streams as they arrive.
   */
  const out: string[] = [];
  const err: string[] = [];

  /**
   * Child's streams, both piped.
   */
  const {
    stdout,
    stderr,
  } = child;
  stdout.setEncoding('utf8',);
  stdout.on('data', function keep(chunk: string,): void {
    out.push(chunk,);
  },);
  stderr.setEncoding('utf8',);
  stderr.on('data', function keep(chunk: string,): void {
    err.push(chunk,);
  },);

  // Wait for the streams to close, then read the exit off the child itself.
  await once(child, 'close',);

  return {
    code: child.exitCode ?? SIGNALLED,
    stdout: out.join('',),
    stderr: err.join('',),
  };
}

await describe({
  name: readRunRows.name,
  children: [
    it({
      name: 'READS the rows, the archive the run named and the roster it asked',
      fn: async () => {
        /**
         * One complete run.
         */
        const path = await writeRun({
          runsDir: await throwawayRunsDir(),
          stamp: '2026-08-25T01-00-00.000Z',
          body: runOver({
            rows: [rowFor({ sliceIndex: 0, },),],
            roster: ROSTER,
          },),
        },);

        /**
         * What the report reads off it.
         */
        const read = await readRunRows({ path, },);

        expect(read.rows.length,).toBe(1,);
        expect(read.archiveDir,).toBe(ARCHIVE,);
        expect(read.roster,).toEqual(ROSTER,);
      },
    },),

    it({
      name: 'READS A RUN WRITTEN BEFORE THE ROSTER WAS KEPT as an empty roster, so its other '
        + 'readings still answer and the voice rates say only what the rows say',
      fn: async () => {
        /**
         * One run carrying no roster field.
         */
        const path = await writeRun({
          runsDir: await throwawayRunsDir(),
          stamp: '2026-08-25T01-00-00.000Z',
          body: runOver({ rows: [rowFor({ sliceIndex: 0, },),], },),
        },);

        expect((await readRunRows({ path, },)).roster,).toEqual([],);
      },
    },),

    it({
      name: 'REFUSES A FILE CARRYING NO ROWS ARRAY as a stated refusal, since it is not a run of '
        + 'this probe rather than a quiet one, and the remedy is the operator\'s',
      fn: async () => {
        /**
         * A file with the run's identity and nothing bought.
         */
        const path = await writeRun({
          runsDir: await throwawayRunsDir(),
          stamp: '2026-08-25T01-00-00.000Z',
          body: {
            startedAt: '2026-08-25T01:00:00.000Z',
            subject: { archiveDir: ARCHIVE, },
          },
        },);

        await expect(readRunRows({ path, },),).rejects.toThrow(StatedRefusalError,);
      },
    },),
  ],
},);

await describe({
  name: newestRun.name,
  children: [
    it({
      name: 'PICKS THE NEWEST RUN BY NAME, since names sort by the instant they carry and no file '
        + 'has to be opened',
      fn: async () => {
        /**
         * Two runs, a day apart.
         */
        const runsDir = await throwawayRunsDir();
        await writeRun({
          runsDir,
          stamp: '2026-08-25T01-00-00.000Z',
          body: runOver({ rows: [], },),
        },);
        /**
         * The later one, which the report should read.
         */
        const later = await writeRun({
          runsDir,
          stamp: '2026-08-26T01-00-00.000Z',
          body: runOver({ rows: [], },),
        },);

        expect(await newestRun({ runsDir, },),).toBe(later,);
      },
    },),

    it({
      name: 'REFUSES A PROBE THAT HAS NEVER RUN as a stated refusal, since reporting nothing '
        + 'would look exactly like reporting a clean run',
      fn: async () => {
        /**
         * A probe directory with no run in it.
         */
        const runsDir = await throwawayRunsDir();
        await mkdir(
          join(
            runsDir,
            PROBE_NAME,
          ),
          { recursive: true, },
        );

        await expect(newestRun({ runsDir, },),).rejects.toThrow(StatedRefusalError,);
      },
    },),
  ],
},);

await describe({
  name: printAcross.name,
  children: [
    it({
      name: 'PRINTS A BAND over the subjects both runs bought on identical text, and no sentence '
        + 'about moved or unverifiable slots',
      fn: async () => {
        using printed = collectingLines({ lines: [], },);

        /**
         * Earlier run over the same text.
         */
        const against = await writeRun({
          runsDir: await throwawayRunsDir(),
          stamp: '2026-08-25T01-00-00.000Z',
          body: runOver({
            rows: [rowFor({
              sliceIndex: 0,
              texts: SAME_TEXTS,
            },),],
          },),
        },);

        await printAcross({
          rows: [rowFor({
            sliceIndex: 0,
            texts: SAME_TEXTS,
          },),],
          against,
        },);

        /**
         * Everything printed, as one body to search.
         */
        const said = printed.lines.join('\n',);

        expect(said.includes('NOTHING PAIRED',),).toBe(false,);
        expect(said.includes('DISAGREES',),).toBe(false,);
        expect(said.includes('cannot be checked',),).toBe(false,);
      },
    },),

    it({
      name: 'SAYS THE TEXT DISAGREES and leaves the slot out where both runs recorded it and the '
        + 'archive moved between them',
      fn: async () => {
        using printed = collectingLines({ lines: [], },);

        /**
         * Earlier run over a different rendering of the slot.
         */
        const against = await writeRun({
          runsDir: await throwawayRunsDir(),
          stamp: '2026-08-25T01-00-00.000Z',
          body: runOver({
            rows: [rowFor({
              sliceIndex: 0,
              texts: OTHER_TEXTS,
            },),],
          },),
        },);

        await printAcross({
          rows: [rowFor({
            sliceIndex: 0,
            texts: SAME_TEXTS,
          },),],
          against,
        },);

        expect(printed.lines.join('\n',)
          .includes('the text DISAGREES',),).toBe(true,);
      },
    },),

    it({
      name: 'SAYS A SLOT CANNOT BE CHECKED where one run recorded no text identity, which is a '
        + 'fact about the run and nothing about the archive',
      fn: async () => {
        using printed = collectingLines({ lines: [], },);

        /**
         * Earlier run written before identities were recorded.
         */
        const against = await writeRun({
          runsDir: await throwawayRunsDir(),
          stamp: '2026-08-25T01-00-00.000Z',
          body: runOver({ rows: [rowFor({ sliceIndex: 0, },),], },),
        },);

        await printAcross({
          rows: [rowFor({
            sliceIndex: 0,
            texts: SAME_TEXTS,
          },),],
          against,
        },);

        expect(printed.lines.join('\n',)
          .includes('cannot be checked',),).toBe(true,);
      },
    },),
  ],
  concurrency: 1,
},);

await describe({
  name: 'rendering-audit-settled-report as built',
  children: [
    it({
      name: 'REPORTS A NAMED RUN and exits 0, printing both halves and the archive that run read',
      fn: async () => {
        /**
         * One complete run to report.
         */
        const path = await writeRun({
          runsDir: await throwawayRunsDir(),
          stamp: '2026-08-25T01-00-00.000Z',
          body: runOver({
            rows: [rowFor({
              sliceIndex: 0,
              texts: SAME_TEXTS,
            },),],
            roster: ROSTER,
          },),
        },);

        /**
         * What the command wrote.
         */
        const run = await runBuilt({
          command: REPORT_COMMAND,
          args: [
            '--run',
            path,
          ],
        },);

        expect(run.code,).toBe(0,);
        expect(run.stdout.includes('THE TWO HALVES, READ APART',),).toBe(true,);
        expect(run.stdout.includes(`Archive that run read: ${ARCHIVE}`,),).toBe(true,);
        expect(run.stdout.includes('asked=1 answered=1 lost=0',),).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES A FILE THAT IS NOT A RUN with its line and exit 6, no frames, which is the '
        + 'policy rendering-7 set for the four operator refusals',
      fn: async () => {
        /**
         * A file with no rows.
         */
        const path = await writeRun({
          runsDir: await throwawayRunsDir(),
          stamp: '2026-08-25T01-00-00.000Z',
          body: {
            startedAt: '2026-08-25T01:00:00.000Z',
            subject: { archiveDir: ARCHIVE, },
          },
        },);

        /**
         * What the command wrote.
         */
        const run = await runBuilt({
          command: REPORT_COMMAND,
          args: [
            '--run',
            path,
          ],
        },);

        expect(run.code,).toBe(REFUSED_AS_STATED,);
        expect(run.stderr.includes('carries no rows array',),).toBe(true,);
        expect(run.stderr.includes('    at ',),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: 'rendering-audit-settled as built',
  children: [
    it({
      name: 'REFUSES AN EMPTY ARCHIVE with its line and exit 6 before any roster is woken, since '
        + 'the run was pointed somewhere wrong rather than at a clean archive',
      fn: async () => {
        /**
         * What the command wrote against an archive holding nothing.
         */
        const run = await runBuilt({
          command: AUDIT_COMMAND,
          args: [
            '--archive',
            await mkdtemp(join(
              tmpdir(),
              'rendering-audit-settled-empty-',
            ),),
            '--cap',
            '0',
          ],
        },);

        expect(run.code,).toBe(REFUSED_AS_STATED,);
        expect(run.stderr.includes('no artifacts under',),).toBe(true,);
        expect(run.stderr.includes('    at ',),).toBe(false,);
      },
    },),
  ],
},);
