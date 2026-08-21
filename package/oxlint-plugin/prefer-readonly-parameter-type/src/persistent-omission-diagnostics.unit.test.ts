import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, } from 'node:os';
import {
  fileURLToPath,
} from 'node:url';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import spawn from 'nano-spawn';

/** Built plugin entry exercised at Oxlint consumer seam. */
const BUILT_PLUGIN_PATH = fileURLToPath(new URL(
  '../dist/final/node/index.mjs',
  import.meta.url,
),);

/** Disposable standalone project for cache-isolated Oxlint processes. */
type DisposableProject = {
  readonly path: string;
  readonly [Symbol.dispose]: () => void;
};

/** Worker selection for one Oxlint process. */
type WorkerSelection =
  | { readonly kind: 'default'; }
  | {
    readonly kind: 'fixed';
    readonly count: number;
  };

/** Captured Oxlint output whether diagnostics make process exit nonzero. */
type OxlintCapture = {
  readonly stdout: string;
  readonly stderr: string;
};

/**
 * Creates standalone project removed after test scope.
 *
 * @returns disposable cache-isolated project.
 */
function disposableProject(): DisposableProject {
  /**
   * Temporary project root outside repository lockfile ancestry.
   */
  const path = mkdtempSync(join(tmpdir(), 'readonly-omission-diagnostics-',),);
  return {
    path,
    [Symbol.dispose](): void {
      rmSync(path, { recursive: true, force: true, },);
    },
  };
}

/**
 * Captures Oxlint JSON and logger stderr for one worker selection.
 *
 * @param projectPath - Standalone project root.
 *
 * @param workers - Fixed or host-default worker policy.
 *
 * @returns captured stdout and stderr on success or diagnostic exit.
 */
async function runOxlint({
  projectPath,
  workers,
}: {
  readonly projectPath: string;
  readonly workers: WorkerSelection;
}): Promise<OxlintCapture> {
  /**
   * Optional explicit worker arguments.
   */
  const workerArguments = workers.kind === 'fixed'
    ? [
      '--threads',
      String(workers.count,),
    ]
    : [];
  try {
    return await spawn(
      'oxlint',
      [
        ...workerArguments,
        '--format',
        'json',
        '--config',
        join(projectPath, 'oxlint.json',),
        join(projectPath, 'input.ts',),
      ],
      { cwd: projectPath, },
    );
  }
  catch (error: unknown) {
    if (((typeof error) !== 'object')
      || (error === null)
      || (!('stdout' in error))
      || (!('stderr' in error))
      || ((typeof error.stdout) !== 'string')
      || ((typeof error.stderr) !== 'string'))
      throw error;
    return {
      stdout: error.stdout,
      stderr: error.stderr,
    };
  }
}

/**
 * Reads exact diagnostic records from Oxlint JSON output.
 *
 * @param capture - Captured Oxlint process output.
 *
 * @returns parsed diagnostics without timing or process metadata.
 */
function diagnosticRecords(capture: OxlintCapture,): readonly unknown[] {
  /**
   * Parsed output narrowed only to consumed diagnostic array.
   */
  const parsed = JSON.parse(capture.stdout,) as { readonly diagnostics?: readonly unknown[]; };
  return parsed.diagnostics ?? [];
}

await describe({
  name: 'persistent omission diagnostic parity',
  concurrency: 1,
  children: [
    it({
      name: 'keeps cold warm and worker diagnostic fingerprints equal',
      fn: async () => {
        using project = disposableProject();
        writeFileSync(
          join(project.path, 'tsconfig.json',),
          '{"compilerOptions":{"strict":true},"include":["input.ts"]}\n',
        );
        writeFileSync(
          join(project.path, 'oxlint.json',),
          JSON.stringify({
            jsPlugins: [BUILT_PLUGIN_PATH,],
            rules: {
              'prefer-readonly-parameter-type/prefer-readonly-parameter-types': 'error',
            },
          },),
        );
        writeFileSync(
          join(project.path, 'input.ts',),
          `export function take<Fn extends (...args: never[]) => unknown,>(
  fn: Fn,
  args: Parameters<Fn>,
): void {
  void fn;
  void args;
}

export function use(): void {
  take(
    function render(): string {
      return '';
    },
    [],
  );
}

export function inspect(state: { nested: { value: string; }; },): number {
  return state.nested.value.length;
}
`,
        );
        const cold = await runOxlint({
          projectPath: project.path,
          workers: { kind: 'fixed', count: 1, },
        },);
        const warm = await runOxlint({
          projectPath: project.path,
          workers: { kind: 'fixed', count: 1, },
        },);
        const defaultWorkers = await runOxlint({
          projectPath: project.path,
          workers: { kind: 'default', },
        },);
        /**
         * Positive-control diagnostics proving comparison can observe rule output.
         */
        const coldDiagnostics = diagnosticRecords(cold,);
        expect(coldDiagnostics.length,).toBeGreaterThan(0,);
        expect(diagnosticRecords(warm,),).toEqual(coldDiagnostics,);
        expect(diagnosticRecords(defaultWorkers,),).toEqual(coldDiagnostics,);
        expect(cold.stderr,).toContain('typescript-tuple-serialization-failed');
        expect(warm.stderr,).toContain(
          'from effect cache: typescript-tuple-serialization-failed',
        );
        expect(defaultWorkers.stderr,).toContain(
          'from effect cache: typescript-tuple-serialization-failed',
        );
      },
    },),
  ],
},);
