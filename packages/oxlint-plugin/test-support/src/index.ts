import {
  copyFile,
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import {
  isAbsolute,
  join,
  resolve,
} from 'node:path';

import { findMiseMonorepoRoot, } from '@monochromatic-dev/module-fs-path/ts';
import spawn from 'nano-spawn';

/**
 * Shared dev-only fixtures for the oxlint plugin unit tests.
 *
 * This file intentionally lives outside the published plugin packages. It is
 * imported only by colocated unit tests, so shared test process setup stays in
 * one place without adding runtime code to any shipped plugin.
 *
 * @module
 */

/**
 * Workspace root resolved from this shared test-support directory.
 *
 * @example
 * ```ts
 * OXLINT_PLUGIN_TEST_ROOT;
 * ```
 */
export const OXLINT_PLUGIN_TEST_ROOT: string = await findMiseMonorepoRoot({
  cwd: import.meta.dirname,
},);

/**
 * Single diagnostic from oxlint JSON output after plugin filtering.
 */
export type OxlintRuleDiagnostic = {
  /**
   * Human-readable diagnostic message.
   */
  readonly message: string;
  /**
   * Rule identifier in `plugin(rule-name)` format.
   */
  readonly code: string;
  /**
   * Diagnostic severity reported by oxlint.
   */
  readonly severity: string;
  /**
   * Source file path reported by oxlint.
   */
  readonly filename: string;
};

/**
 * Raw diagnostic shape emitted by oxlint before runner-level diagnostics are filtered out.
 */
type OxlintDiagnostic = Omit<OxlintRuleDiagnostic, 'code'> & {
  /**
   * Rule identifier, absent for runner-level diagnostics.
   */
  readonly code?: string;
};

/**
 * Top-level oxlint `--format json` output.
 */
type OxlintOutput = {
  /**
   * Diagnostics emitted for the target file.
   */
  readonly diagnostics: readonly OxlintDiagnostic[];
};

/**
 * Disposable temp copy of a fixture file.
 */
export type TempFixtureFile = {
  /**
   * Absolute path to copied fixture file.
   */
  readonly filePath: string;
  /**
   * Removes temp directory that contains fixture copy.
   */
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 * Options for locating one test-fixture package.
 */
export type FixturePackageRootParams = {
  /**
   * Directory name under `packages/test-fixture`.
   */
  readonly fixturePackageName: string;
};

/**
 * Options for locating a fixture config file.
 */
export type FixtureConfigPathParams = FixturePackageRootParams & {
  /**
   * Config filename inside the fixture package.
   */
  readonly fileName: string;
};

/**
 * Options for resolving a lint target.
 */
export type ResolveFixtureTargetParams = {
  /**
   * Source fixture root used for relative fixture paths.
   */
  readonly fixtureSourceRoot: string;
  /**
   * Relative fixture path or absolute temp fixture path.
   */
  readonly fixturePath: string;
};

/**
 * Options for running oxlint against a fixture target.
 */
export type RunOxlintFixtureParams = {
  /**
   * Diagnostic code prefix to keep, including opening parenthesis.
   */
  readonly codePrefix: `${string}(`;
  /**
   * Config flag spelling accepted by the plugin's fixture setup.
   */
  readonly configFlag: '-c' | '--config';
  /**
   * Absolute path to fixture oxlint config.
   */
  readonly fixtureConfig: string;
  /**
   * Absolute path to target source file.
   */
  readonly target: string;
  /**
   * Optional Oxlint worker count for resource-sensitive plugin tests.
   */
  readonly threads?: number;
};

/**
 * Options for copying a source fixture into a disposable temp directory.
 */
export type CreateTempFixtureFileParams = {
  /**
   * Basename for copied temp file.
   */
  readonly fileName: string;
  /**
   * Source fixture path to copy into temp directory.
   */
  readonly sourcePath: string;
  /**
   * Temp directory prefix passed to `mkdtempSync`.
   */
  readonly tempPrefix: string;
};

/**
 * Returns absolute package root for one oxlint test fixture package.
 *
 * @param params - fixture package name to resolve
 *
 * @returns absolute path under `packages/test-fixture`
 *
 * @example
 * ```ts
 * fixturePackageRoot({ fixturePackageName: 'oxlint-tsdoc' });
 * ```
 */
export function fixturePackageRoot(params: FixturePackageRootParams,): string {
  /**
   * Fixture package name to resolve under `packages/test-fixture`.
   */
  const { fixturePackageName, } = params;
  return resolve(
    OXLINT_PLUGIN_TEST_ROOT,
    'packages',
    'test-fixture',
    fixturePackageName,
  );
}

/**
 * Returns absolute `src` root for one oxlint test fixture package.
 *
 * @param params - fixture package name to resolve
 *
 * @returns absolute path to fixture source directory
 *
 * @example
 * ```ts
 * fixtureSourceRoot({ fixturePackageName: 'oxlint-stylistic' });
 * ```
 */
export function fixtureSourceRoot(params: FixturePackageRootParams,): string {
  return resolve(
    fixturePackageRoot(params,),
    'src',
  );
}

/**
 * Returns absolute path to a fixture oxlint config file.
 *
 * @param params - fixture package and config filename
 *
 * @returns absolute config path
 *
 * @example
 * ```ts
 * fixtureConfigPath({ fixturePackageName: 'oxlint-tsdoc', fileName: '.oxlintrc.fixture.json' });
 * ```
 */
export function fixtureConfigPath(params: FixtureConfigPathParams,): string {
  /**
   * Fixture package name and config filename to resolve.
   */
  const {
    fixturePackageName,
    fileName,
  } = params;
  return resolve(
    fixturePackageRoot({ fixturePackageName, },),
    fileName,
  );
}

/**
 * Resolves relative fixture names while preserving absolute temp paths.
 *
 * @param params - fixture source root and user-supplied path
 *
 * @returns absolute lint target path
 *
 * @example
 * ```ts
 * resolveFixtureTarget({ fixtureSourceRoot: FIXTURES, fixturePath: 'invalid/file.ts' });
 * ```
 */
export function resolveFixtureTarget(params: ResolveFixtureTargetParams,): string {
  /**
   * Fixture source root and target path to resolve.
   */
  const {
    fixtureSourceRoot: sourceRoot,
    fixturePath,
  } = params;
  return isAbsolute(fixturePath,)
    ? fixturePath
    : resolve(
      sourceRoot,
      fixturePath,
    );
}

/**
 * Returns stdout stored on nano-spawn errors when oxlint exits non-zero.
 *
 * @param error - thrown value from `spawn`
 *
 * @returns captured stdout
 *
 * @throws original thrown value when stdout is not available
 *
 * @example
 * ```ts
 * const stdout = stdoutFromSpawnError({ error });
 * ```
 */
function stdoutFromSpawnError({ error, }: { readonly error: unknown; },): string {
  if (((typeof error) !== 'object') || (error === null)) {
    throw new Error(
      'oxlint spawn failure did not expose stdout.',
      { cause: error, },
    );
  }
  if (!('stdout' in error)) {
    throw new Error(
      'oxlint spawn failure did not expose stdout.',
      { cause: error, },
    );
  }
  /**
   * Captured process stdout attached by nano-spawn.
   */
  const { stdout, } = error;
  if ((typeof stdout) !== 'string') {
    throw new Error(
      'oxlint spawn failure stdout was not a string.',
      { cause: error, },
    );
  }
  return stdout;
}

/**
 * Parses oxlint JSON output into typed diagnostics.
 *
 * @param stdout - raw `--format json` stdout
 *
 * @returns parsed oxlint output
 *
 * @example
 * ```ts
 * const output = parseOxlintOutput('{"diagnostics":[]}');
 * ```
 */
function parseOxlintOutput(stdout: string,): OxlintOutput {
  /* oxlint-disable typescript/no-unsafe-assignment -- JSON.parse returns unknown JSON; OxlintOutput validates the consumed shape for tests. */
  /**
   * Parsed oxlint output trusted by fixture tests.
   */
  const output: OxlintOutput = JSON.parse(stdout,);
  /* oxlint-enable typescript/no-unsafe-assignment */
  return output;
}

/**
 * Runs oxlint with a fixture config and filters diagnostics to one plugin.
 *
 * @param params - oxlint fixture invocation details
 *
 * @returns plugin diagnostics sorted exactly as oxlint emitted them
 *
 * @example
 * ```ts
 * await runOxlintFixture({ codePrefix: 'tsdoc(', configFlag: '--config', fixtureConfig, target });
 * ```
 */
export async function runOxlintFixture(
  params: RunOxlintFixtureParams,
): Promise<readonly OxlintRuleDiagnostic[]> {
  /**
   * Oxlint invocation details for this fixture run.
   */
  const {
    codePrefix,
    configFlag,
    fixtureConfig,
    target,
    threads,
  } = params;
  /**
   * Captures stdout from oxlint whether diagnostics make the process exit non-zero or not.
   *
   * @returns captured oxlint stdout
   */
  async function captureStdout(): Promise<string> {
    try {
      /**
       * Successful oxlint process output.
       */
      const { stdout, } = await spawn(
        'oxlint',
        [
          ...threads === undefined ? [] : [
            '--threads',
            String(threads,),
          ],
          '--format',
          'json',
          configFlag,
          fixtureConfig,
          target,
        ],
        { cwd: OXLINT_PLUGIN_TEST_ROOT, },
      );
      return stdout;
    }
    catch (error: unknown) {
      return stdoutFromSpawnError({ error, },);
    }
  }

  /**
   * Parsed oxlint JSON output for the fixture run.
   */
  const output = parseOxlintOutput(await captureStdout(),);
  /**
   * Diagnostics emitted by oxlint before plugin filtering.
   */
  const { diagnostics, } = output;
  /**
   * Diagnostics belonging to the requested plugin only.
   */
  const pluginDiagnostics = diagnostics
    .filter(
      function keepPluginDiagnostic(
        diagnostic,
      ): diagnostic is OxlintRuleDiagnostic {
        if ((typeof diagnostic.code) !== 'string')
          return false;
        return diagnostic.code
          .startsWith(codePrefix,);
      },
    );
  return pluginDiagnostics;
}

/**
 * Creates a temp fixture copy with disposal-backed directory cleanup.
 *
 * @param params - fixture source, temp basename, and directory prefix
 *
 * @returns copied temp fixture file handle
 *
 * @example
 * ```ts
 * using fixture = createTempFixtureFile({ fileName: 'case.ts', sourcePath, tempPrefix: 'oxlint-case-' });
 * ```
 */
export async function createTempFixtureFile(
  params: CreateTempFixtureFileParams,
): Promise<TempFixtureFile> {
  /**
   * Temp fixture source, basename, and directory prefix.
   */
  const {
    fileName,
    sourcePath,
    tempPrefix,
  } = params;
  /**
   * Unique temp directory owning this fixture copy.
   */
  const dirPath = await mkdtemp(join(
    tmpdir(),
    tempPrefix,
  ),);
  /**
   * Absolute path to temp fixture copy.
   */
  const filePath = resolve(
    dirPath,
    fileName,
  );
  await copyFile(
    sourcePath,
    filePath,
  );

  return {
    filePath,
    [Symbol.asyncDispose]: async function cleanup(): Promise<void> {
      await rm(
        dirPath,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * Extracts sorted unique rule codes from diagnostics.
 *
 * @param diagnostics - plugin diagnostics
 *
 * @returns sorted unique diagnostic codes
 *
 * @example
 * ```ts
 * uniqueRuleCodes(diagnostics);
 * ```
 */
export function uniqueRuleCodes(
  diagnostics: readonly OxlintRuleDiagnostic[],
): readonly string[] {
  return [
    ...new Set(diagnostics.map(
      function pickCode(diagnostic,): string {
        return diagnostic.code;
      },
    ),),
  ].toSorted();
}
