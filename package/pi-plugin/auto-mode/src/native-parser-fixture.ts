/**
 Disposable parser packages exercise the built native qualification boundary without editing installed state.

 @module
 */
import { chmod, copyFile, mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

//region Tests depend on the native artifact's consumer contract

/**
 Consumer-visible parser operations used by the qualification tests.
 */
export type NativeParserModule = {
  /** Original build error constructor. */
  readonly NativePolicyParserError: new(message: string) => Error;
  /** Qualification captures the installed package before returning a parser. */
  readonly createNativeMarkdownParser: (input: {
    /** Exact version requested by the native bootstrap. */
    readonly expectedVersion: string;
  }) => Promise<{
    /** Tests inspect returned trees without supplying the parser's internal type contract. */
    readonly parse: (input: {
      /** Original policy input. */
      readonly source: string;
      /** Explicit Markdown-only selection. */
      readonly mdx: boolean;
    }) => unknown;
    /** Measured identity is observable independently of parsing. */
    readonly metadata: Readonly<Record<string, unknown>>;
  }>;
};

/**
 Verify callable exports before testing their behavior through the consumer contract.

 @param value - built namespace loaded from an original or disposable artifact path

 @throws Error when required native parser exports are absent
 */
function assertNativeParserModule(value: unknown): asserts value is NativeParserModule {
  if (typeof value !== 'object' || value === null || !('NativePolicyParserError' in value)
    || typeof value.NativePolicyParserError !== 'function' || !('createNativeMarkdownParser' in value)
    || typeof value.createNativeMarkdownParser !== 'function') throw new Error('Built native parser lacks its required callable exports');
}

/**
 Load the exact built artifact, optionally from a disposable copied module.

 @param url - original or copied build artifact selected by the fixture

 @returns checked namespace used by the native consumer tests

 @example
 ```ts
 const parserModule = await loadNativeParserArtifact();
 ```
 */
export async function loadNativeParserArtifact(url = new URL('../dist/native/contract/native-index/native-parser.ts', import.meta.url)): Promise<NativeParserModule> {
  /**
   Dynamic loading deliberately retains unknown until the required exports are checked.
   */
  const loaded: unknown = await import(url.href);
  assertNativeParserModule(loaded);
  return loaded;
}

//endregion Tests depend on the native artifact's consumer contract

//region Fake package state lives entirely in disposable directories

/**
 A controlled parser package reaches qualification failures without mutating the real dependency.

 @param manifest - changed fields in the disposable package manifest

 @param tree - controlled parser result used only by the qualification self-check

 @param differentEsmEntry - whether module resolution selects a different ESM file

 @returns copied native adapter bound to the disposable package

 @example
 ```ts
 const parserModule = await createNativeParserFixture({ tree: { type: 'paragraph' } });
 ```
 */
export async function createNativeParserFixture({ manifest = {}, tree, differentEsmEntry = false }: {
  readonly manifest?: Readonly<Record<string, unknown>>;
  readonly tree?: unknown;
  readonly differentEsmEntry?: boolean;
}): Promise<NativeParserModule> {
  /**
   The task-owned scratch parent is also used by native integration fixtures.
   */
  const scratch = join(homedir(), 'temp/agent');
  await mkdir(scratch, { recursive: true, mode: 0o700 });
  await chmod(scratch, 0o700);
  /**
   Every fixture receives a unique package graph and module-cache identity.
   */
  const fixture = await mkdtemp(join(scratch, 'pi-native-parser-fixture-'));
  /**
   Only the parser package is replaced; logger dependencies retain their original installed owners.
   */
  const modules = join(fixture, 'node_modules');
  /**
   Manifest placement matches the adapter's qualified dist layout.
   */
  const parserPackage = join(modules, 'satteri');
  await mkdir(join(parserPackage, 'dist'), { recursive: true, mode: 0o700 });
  await symlink(join(dirname(import.meta.dirname), 'node_modules/@monochromatic-dev'), join(modules, '@monochromatic-dev'), 'dir');
  await writeFile(join(fixture, 'package.json'), JSON.stringify({ type: 'module' }), { mode: 0o600 });
  await writeFile(join(parserPackage, 'package.json'), JSON.stringify({
    name: 'satteri',
    version: '0.10.5',
    type: 'module',
    exports: { import: differentEsmEntry ? './dist/esm.js' : './dist/index.js', default: './dist/index.js' },
    ...manifest,
  }), { mode: 0o600 });
  /**
   Controlled output is encoded as data in the disposable parser function.
   */
  const entrySource = `export function markdownToMdast() { return ${JSON.stringify(tree ?? { type: 'root', children: [] })}; }\n`;
  await writeFile(join(parserPackage, 'dist/index.js'), entrySource, { mode: 0o600 });
  await writeFile(join(parserPackage, 'dist/esm.js'), entrySource, { mode: 0o600 });
  /**
   Copy the consumer artifact, preserving its production source unchanged.
   */
  const adapter = join(fixture, 'native-parser.ts');
  await copyFile(new URL('../dist/native/contract/native-index/native-parser.ts', import.meta.url), adapter);
  return await loadNativeParserArtifact(pathToFileURL(adapter));
}

//endregion Fake package state lives entirely in disposable directories
