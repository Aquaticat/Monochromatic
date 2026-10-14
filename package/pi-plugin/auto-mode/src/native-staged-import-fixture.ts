/**
 Disposable original files exercise the generated native import boundary.

 @module
 */
import { chmod, mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

//region Tests invoke the copied staging artifact through its consumer interface

/** Staging operations retain their original file and source inputs. */
type StagedImportModule = {
  /** Original staging error category remains observable. */
  readonly StagedImportError: new(message: string) => Error;
  /** Read and relocate one original JavaScript or TypeScript source module. */
  readonly readStagedInput: (url: URL) => Promise<string>;
  /** Verify the original imported file before selecting its generated replacement. */
  readonly replaceStagedImport: (input: { readonly source: string; readonly binding: string; readonly expected: URL; readonly replacement: string }) => Promise<string>;
};

/**
 Require staging exports before exercising their copied artifact.

 @param value - built staging module namespace

 @returns assertion narrowing to the tested staging operations

 @throws Error when the copied artifact is missing a required callable
 */
function assertStagedImportModule(value: unknown): asserts value is StagedImportModule {
  if ((value === null) || ((typeof value) !== 'object') || !('StagedImportError' in value)
    || ((typeof value.StagedImportError) !== 'function') || !('readStagedInput' in value)
    || ((typeof value.readStagedInput) !== 'function') || !('replaceStagedImport' in value)
    || ((typeof value.replaceStagedImport) !== 'function')) throw new Error('Built native staging exports are unavailable');
}

/** Runtime behavior comes from the artifact used during native preparation. */
const built: unknown = await import(new URL('../dist/native/contract/integration/native-batch/staged-import.ts', import.meta.url).href);
assertStagedImportModule(built);
/** Checked staging callables remain fixed throughout each test. */
export const stagedImport: StagedImportModule = built;

//endregion Tests invoke the copied staging artifact through its consumer interface

//region Each original input lives in a private disposable directory

/**
 Create source and dependency files without mutating installed or shared state.

 @param source - original module text supplied to staging

 @param extension - native source suffix selects type erasure or unchanged JavaScript

 @returns original source, dependency, foreign-file, and symlink URLs

 @example
 ```ts
 const fixture = await stagedImportFixture({ source: 'export const original = true;' });
 ```
 */
export async function stagedImportFixture({ source, extension = '.mjs' }: { readonly source: string; readonly extension?: '.mjs' | '.ts' }): Promise<{ readonly sourceUrl: URL; readonly dependencyUrl: URL; readonly foreignUrl: URL; readonly aliasUrl: URL }> {
  /** Only this user can enter the task-owned fixture parent. */
  const scratch = join(homedir(), 'temp/agent');
  await mkdir(scratch, { recursive: true, mode: 0o700 });
  await chmod(scratch, 0o700);
  /** Unique directories separate filesystem and module-cache identity. */
  const directory = await mkdtemp(join(scratch, 'pi-native-staged-import-'));
  /** Original source retains its executable input suffix. */
  const sourceUrl = pathToFileURL(join(directory, `original${extension}`));
  /** The exact original dependency is verified before replacing its specifier. */
  const dependencyUrl = pathToFileURL(join(directory, 'dependency.mjs'));
  /** Equal bytes cannot replace a different original file identity. */
  const foreignUrl = pathToFileURL(join(directory, 'foreign.mjs'));
  /** A symlink permits the existing realpath identity control. */
  const aliasUrl = pathToFileURL(join(directory, 'alias.mjs'));
  await Promise.all([
    writeFile(sourceUrl, source, { mode: 0o600 }),
    writeFile(dependencyUrl, 'export function run() { return 1; }\n', { mode: 0o600 }),
    writeFile(foreignUrl, 'export function run() { return 1; }\n', { mode: 0o600 }),
  ]);
  await symlink(dependencyUrl, aliasUrl);
  return { sourceUrl, dependencyUrl, foreignUrl, aliasUrl };
}

//endregion Each original input lives in a private disposable directory
