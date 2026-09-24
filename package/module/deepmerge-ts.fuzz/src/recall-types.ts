/**
 In-container historical-recall run for result-type bugs
 (`doc/audit/deepmerge-ts-recall-2026-09-24.md`), in `node:<major>-slim` with
 this repo read-only and `dist/recall/types` writable at their host paths,
 and extracted npm releases read-only at `RECALL_NPM_DIR/<version>/package`.

 `corpus <seed> <size>` draws a fresh declared-type corpus (the declared-type
 campaign's generator, run against the installed v8.0.2 runtime).
 `check <version>...` type-checks the whole sidecar plus that corpus with
 `deepmerge-ts` mapped to each release's declarations, and
 `control <id>` type-checks one ledger row's control against its buggy and
 fixed releases. Each job writes its diagnostics to `results/<job>.json`.

 @module
 */

import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  join,
  relative,
  resolve,
} from 'node:path';

import { emitModule, } from './declared-type-check.ts';
import { drawCases, } from './declared-type-generate.ts';
import { TYPE_BUGS, } from './recall-ledger-type.ts';

/**
 This package's root.
 */
const PACKAGE_ROOT = resolve(
  import.meta.dirname,
  '..',
);

/**
 Writable output directory, inside the package so `node_modules` lookups from
 generated tsconfigs reach the package's dependencies.
 */
const OUT_DIR = join(
  PACKAGE_ROOT,
  'dist',
  'recall',
  'types',
);

/**
 Per-job compiler limit; a release that makes the check hang is recorded as a
 timeout, which is itself the finding for type-checker cost bugs.
 */
const TSC_TIMEOUT_MS = 900_000;

/**
 Marker between a diagnostic's location and its code in `--pretty false` output.
 */
const ERROR_MARKER = ': error TS';

/**
 Start of a diagnostic without a location, such as a configuration error.
 */
const GLOBAL_ERROR = 'error TS';

/**
 Error for a job that cannot produce trustworthy evidence.
 */
class RecallTypesError extends Error {
  /**
   @param message - What failed.
   */
  constructor(message: string,) {
    super(message,);
    this.name = 'RecallTypesError';
  }
}

/**
 Extracted npm releases, from the environment.

 @returns Directory holding `<version>/package`.

 @throws {@link RecallTypesError} When `RECALL_NPM_DIR` is unset.

 @example
 ```ts
 npmDir(); // '/home/user/temp/agent/deepmerge-ts-recall-npm'
 ```
 */
function npmDir(): string {
  /**
   Configured directory.
   */
  const dir = process.env.RECALL_NPM_DIR;
  if ((dir === undefined) || (dir === ''))
    throw new RecallTypesError('RECALL_NPM_DIR is not set',);
  return dir;
}

/**
 Declaration file a bundler-resolution consumer loads for `import`: the
 `exports` types condition, else the TypeScript 4.1+ `typesVersions` entry,
 else `types`.

 @param version - npm release.

 @returns Absolute declaration path.

 @throws {@link RecallTypesError} When the manifest names no declarations.

 @example
 ```ts
 await typesEntry('7.1.6'); // '.../7.1.6/package/dist/node/index.d.mts'
 ```
 */
async function typesEntry(version: string,): Promise<string> {
  /**
   Package directory.
   */
  const dir = join(
    npmDir(),
    version,
    'package',
  );
  /**
   Parsed manifest.
   */
  const manifest: unknown = JSON.parse(await readFile(
    join(
      dir,
      'package.json',
    ),
    'utf8',
  ),);
  /**
   Candidates in resolution order.
   */
  const candidates: readonly unknown[] = [
    Reflect.get(
      Object(Reflect.get(
        Object(Reflect.get(
          Object(manifest,),
          'exports',
        ),),
        'types',
      ),),
      'import',
    ),
    Reflect.get(
      Object(Reflect.get(
        Object(Reflect.get(
          Object(manifest,),
          'typesVersions',
        ),),
        '>=4.1',
      ),),
      '*',
    ),
    Reflect.get(
      Object(manifest,),
      'types',
    ),
  ].map(function firstOf(candidate,) {
    return Array.isArray(candidate,) ? candidate[0] : candidate;
  },);
  /**
   First string candidate.
   */
  const entry = candidates.find(function isString(candidate,) {
    return (typeof candidate) === 'string';
  },);
  if ((typeof entry) !== 'string')
    throw new RecallTypesError(`deepmerge-ts ${version} names no declarations`,);
  return join(
    dir,
    String(entry,),
  );
}

/**
 Compiler outcome of one job.
 */
type TscOutcome = {
  readonly job: string;
  readonly entry: string;
  readonly ms: number;
  readonly timedOut: boolean;
  readonly diagnostics: readonly string[];
};

/**
 Diagnostic keys (`file(line,col): TSnnnn`, file relative to the package)
 from `--pretty false` output; continuation lines are dropped because the
 location and code identify the failing assertion.

 @param output - Compiler output.

 @param dir - Directory the compiler ran in, for relative paths it prints.

 @returns Keys in output order.

 @example
 ```ts
 diagnosticKeys({ dir, output: 'src/a.ts(1,2): error TS2322: x', }); // ['src/a.ts(1,2): TS2322']
 ```
 */
function diagnosticKeys(
  {
    output,
    dir,
  }: {
    readonly output: string;
    readonly dir: string;
  },
): readonly string[] {
  return output.split('\n',)
    .filter(function isError(line,) {
      return line.includes(ERROR_MARKER,) || line.startsWith(GLOBAL_ERROR,);
    },)
    .map(function keyOf(line,) {
      if (!line.includes(ERROR_MARKER,))
        return `<global>: TS${String(line.slice(GLOBAL_ERROR.length,)
          .split(':',)[0],)}`;
      /**
       Location part, `file(line,col)`.
       */
      const location = line.slice(
        0,
        line.indexOf(ERROR_MARKER,),
      );
      /**
       Diagnostic code digits after the marker.
       */
      const code = line.slice(line.indexOf(ERROR_MARKER,) + ERROR_MARKER.length,)
        .split(':',)[0];
      /**
       Start of `(line,col)`.
       */
      const paren = location.lastIndexOf('(',);
      /**
       File as printed.
       */
      const file = (paren < 0) ? location : location.slice(
        0,
        paren,
      );
      return `${relative(
        PACKAGE_ROOT,
        resolve(
          dir,
          file,
        ),
      )}${(paren < 0) ? '' : location.slice(paren,)}: TS${String(code,)}`;
    },);
}

/**
 Write a tsconfig mapping `deepmerge-ts` to `entry` and type-check it.

 @param job - Job name, also its directory under `jobs/`.

 @param entry - Declaration file for `deepmerge-ts`.

 @param include - Files and globs to check.

 @returns Compiler outcome, also written to `results/<job>.json`.

 @example
 ```ts
 await checkJob({ entry, include: [file,], job: 'control-x-buggy', });
 ```
 */
async function checkJob(
  {
    job,
    entry,
    include,
  }: {
    readonly job: string;
    readonly entry: string;
    readonly include: readonly string[];
  },
): Promise<TscOutcome> {
  /**
   Job directory.
   */
  const dir = join(
    OUT_DIR,
    'jobs',
    job,
  );
  await mkdir(
    dir,
    { recursive: true, },
  );
  await writeFile(
    join(
      dir,
      'tsconfig.json',
    ),
    `${JSON.stringify(
      {
        compilerOptions: {
          composite: false,
          declaration: false,
          incremental: false,
          isolatedDeclarations: false,
          noEmit: true,
          paths: { 'deepmerge-ts': [entry,], },
          // Jobs include files outside their own directory; TypeScript 7
          // otherwise rejects them against the default rootDir (TS6059).
          rootDir: '/',
        },
        exclude: [join(
          PACKAGE_ROOT,
          'src',
          '**',
          '*.local.*',
        ),],
        extends: join(
          PACKAGE_ROOT,
          '..',
          '..',
          'config',
          'typescript',
          'tsconfig.dom.json',
        ),
        include,
      },
      undefined,
      2,
    )}\n`,
  );
  /**
   Start time.
   */
  const started = performance.now();
  /**
   Workspace compiler, the one `lint:types` uses.
   */
  const child = spawn(
    join(
      PACKAGE_ROOT,
      '..',
      '..',
      '..',
      'node_modules',
      '.bin',
      'tsc',
    ),
    [
      '--project',
      join(
        dir,
        'tsconfig.json',
      ),
      '--pretty',
      'false',
    ],
    {
      cwd: dir,
      stdio: [
        'ignore',
        'pipe',
        'pipe',
      ],
    },
  );
  /**
   Output chunks.
   */
  const chunks: Buffer[] = [];
  child.stdout
    .on(
      'data',
      function collect(chunk: Buffer,) {
        chunks.push(chunk,);
      },
    );
  child.stderr
    .on(
      'data',
      function collect(chunk: Buffer,) {
        chunks.push(chunk,);
      },
    );
  /**
   Whether the limit killed the compiler.
   */
  const timedOut = { value: false, };
  /**
   Kill timer.
   */
  const timer = setTimeout(
    function killHung() {
      timedOut.value = true;
      child.kill('SIGKILL',);
    },
    TSC_TIMEOUT_MS,
  );
  await once(
    child,
    'close',
  );
  clearTimeout(timer,);
  /**
   Outcome.
   */
  const outcome: TscOutcome = {
    diagnostics: diagnosticKeys({
      dir,
      output: Buffer.concat(chunks,)
        .toString('utf8',),
    },),
    entry,
    job,
    ms: Math.round(performance.now() - started,),
    timedOut: timedOut.value,
  };
  await mkdir(
    join(
      OUT_DIR,
      'results',
    ),
    { recursive: true, },
  );
  await writeFile(
    join(
      OUT_DIR,
      'results',
      `${job}.json`,
    ),
    `${JSON.stringify(
      outcome,
      undefined,
      2,
    )}\n`,
  );
  console.log(`${job}\t${String(outcome.diagnostics.length,)} diagnostic(s)\t${String(outcome.ms,)} ms${outcome.timedOut ? '\ttimed out' : ''}`,);
  return outcome;
}

if (import.meta.main) {
  /**
   Mode and its arguments.
   */
  const [mode, ...args] = process.argv.slice(2,);
  /**
   Fresh corpus file.
   */
  const corpusFile = join(
    OUT_DIR,
    'fresh',
    'cases.ts',
  );
  if (mode === 'corpus') {
    await mkdir(
      join(
        OUT_DIR,
        'fresh',
      ),
      { recursive: true, },
    );
    await writeFile(
      corpusFile,
      emitModule({
        cases: drawCases({
          seed: Number(args[0],),
          size: Number(args[1],),
          unions: true,
        },),
        exportName: 'RECALL_CASES',
      },).source,
    );
  } else if (mode === 'check') {
    for (const version of args) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- one compiler at a time inside the 2 GiB cap.
      await checkJob({
        // oxlint-disable-next-line eslint/no-await-in-loop -- same.
        entry: await typesEntry(version,),
        include: [
          join(
            PACKAGE_ROOT,
            'src',
            '**',
            '*.ts',
          ),
          corpusFile,
        ],
        job: `sidecar-${version}`,
      },);
    }
  } else if (mode === 'control') {
    for (const bug of TYPE_BUGS.filter(function wanted(row,) {
      return (row.control !== '') && ((args.length === 0) || args.includes(row.id,));
    },)) {
      /**
       Control module path.
       */
      const file = join(
        OUT_DIR,
        'controls',
        `${bug.id}.ts`,
      );
      // oxlint-disable-next-line eslint/no-await-in-loop -- one compiler at a time inside the 2 GiB cap.
      await mkdir(
        join(
          OUT_DIR,
          'controls',
        ),
        { recursive: true, },
      );
      // oxlint-disable-next-line eslint/no-await-in-loop -- same.
      await writeFile(
        file,
        bug.control,
      );
      for (const side of [
        'buggy',
        'fixed',
      ] as const) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- same.
        await checkJob({
          // oxlint-disable-next-line eslint/no-await-in-loop -- same.
          entry: await typesEntry(bug[side],),
          include: [file,],
          job: `control-${bug.id}-${side}`,
        },);
      }
    }
  } else {
    throw new RecallTypesError(`unknown mode ${String(mode,)}; expected corpus, check, or control`,);
  }
}
