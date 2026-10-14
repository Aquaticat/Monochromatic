/**
 Read qualified package manifests before synchronous source transformations select their imports.

 @module
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tagged } from '@monochromatic-dev/module-logger/ts';

//region Manifest reads finish before original import declarations are transformed

/**
 Native source transformations require an explicit installed package entry.
 */
export class NativeBatchBuildError extends Error {
  /**
   Keep build input failures separate from policy judgments.
   */
  override readonly name = 'NativeBatchBuildError';
}

/**
 Build entry diagnostics remain attributable to their module boundary.
 */
const l = tagged({ tag: 'auto-mode-native-build-entries' });

/**
 Manifest fields remain unknown until the selected export is checked.

 @param value - parsed JSON whose object properties may be inspected

 @returns whether property lookup is supported
 */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

/**
 Pure entry selection retains the original supported package export shapes.
 */
export type ImportEntryReader = (input: {
  /**
   Package root whose original manifest was captured during preparation.
   */
  readonly root: string;
  /**
   Exact export key; omitted key selects the package root.
   */
  readonly subpath?: string;
}) => string;

/**
 Capture manifests asynchronously, then expose pure import selection to source callbacks.

 @param roots - installed package roots required by this qualified build

 @returns reader retaining the captured manifests without synchronous filesystem calls

 @throws NativeBatchBuildError when requested package or export was not captured

 @example
 ```ts
 const entry = await createImportEntryReader({ roots: [packageRoot] });
 const url = entry({ root: packageRoot, subpath: './compat' });
 ```
 */
export async function createImportEntryReader({ roots }: {
  readonly roots: readonly string[];
}): Promise<ImportEntryReader> {
  /**
   Preparation diagnostics identify asynchronous manifest capture.
   */
  const rl = tagged({ tag: createImportEntryReader.name, l });
  rl.debug('reading qualified package manifests');
  /**
   Manifests are captured once before any import rewrite callback runs.
   */
  const manifests = new Map<string, unknown>(await Promise.all(roots.map(
    async function readManifest(root: string): Promise<readonly [string, unknown]> {
      /**
       Each package read has a separate diagnostic boundary.
       */
      const readLog = tagged({ tag: readManifest.name, l: rl });
      readLog.debug(`reading package manifest: ${root}`);
      /**
       JSON remains untrusted until the exact selected export is checked.
       */
      const metadata: unknown = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
      return [root, metadata] as const;
    },
  )));

  /**
   Select one original entry without rereading files inside synchronous replacement callbacks.

   @param root - original captured package root

   @param subpath - exact export key required by the native import

   @returns file URL selected by the qualified import profile

   @throws NativeBatchBuildError when the manifest or selected entry is unavailable
   */
  function entry({ root, subpath = '.' }: Parameters<ImportEntryReader>[0]): string {
    /**
     Entry selection retains both preparation and callback diagnostic tags.
     */
    const entryLog = tagged({ tag: entry.name, l: rl });
    /**
     Missing captures cannot silently fall back to another installed package.
     */
    const metadata = manifests.get(root);
    if (!isRecord(metadata)) throw new NativeBatchBuildError(`Installed package manifest is unavailable: ${root}`);
    /**
     Root string exports and the historical main field retain their original meaning.
     */
    const exports = metadata.exports;
    /**
     Conditional subpath exports are selected only from captured object properties.
     */
    const value = subpath === '.' && exports === undefined ? metadata.main
      : subpath === '.' && typeof exports === 'string' ? exports
      : isRecord(exports) ? exports[subpath] : undefined;
    /**
     The qualified source supports string, import, and default entries.
     */
    const selected = typeof value === 'string' ? value
      : isRecord(value) && typeof value.import === 'string' ? value.import
      : isRecord(value) ? value.default : undefined;
    if (typeof selected !== 'string') throw new NativeBatchBuildError(`Installed import entry is unavailable: ${root} ${subpath}`);
    entryLog.debug(`selected original package entry: ${root} ${subpath}`);
    return pathToFileURL(join(root, selected)).href;
  }
  return entry;
}

//endregion Manifest reads finish before original import declarations are transformed
