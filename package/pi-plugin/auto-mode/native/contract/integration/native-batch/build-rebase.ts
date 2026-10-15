/**
 Preserve qualified native import resolution and exact original transformation sites.

 @module
 */
import { pathToFileURL } from 'node:url';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import {
  ai,
  codemode,
  core
} from '../current-sdk/paths.ts';
import {
  type ImportEntryReader,
  NativeBatchBuildError
} from './build-entries.ts';
import { rewriteNativeImports } from './build-imports.ts';

//region Original source edits retain explicit occurrence checks

/**
 Rewriting diagnostics remain attributable to this build boundary.
 */
const l = tagged({ tag: 'auto-mode-native-build-rebase' });

/**
 Replace one exact qualified call site without accepting upstream source drift.

 @param source - original source that must contain one matching site

 @param from - qualified source spelling to replace

 @param to - replacement preserving the native owner connection

 @returns source containing the replacement

 @throws NativeBatchBuildError when the original site is absent or duplicated

 @example
 ```ts
 replaceOnce({ source: 'original();', from: 'original()', to: 'owned()' });
 ```
 */
export function replaceOnce({
  source,
  from,
  to
}: {
  readonly source: string;
  readonly from: string;
  readonly to: string;
}): string {
  /**
   Source matching has a separate build diagnostic boundary.
   */
  const rl = tagged({
    tag: replaceOnce.name,
    l
  });
  /**
   Exact spelling continues to guard every owned native patch.
   */
  const at = source.indexOf(from);
  if ((at === (-1)) || source.includes(
    from,
    at + from.length
  )) throw new NativeBatchBuildError(`Native SDK edit does not have one matching location: ${from}`);
  rl.debug('matched one original native source location');
  return source.slice(
    0,
    at
  ) + to
    + source.slice(at + from.length);
}

/**
 Build input helper URLs are encoded at their JavaScript interpolation boundary.

 @param relative - sibling build input resolved against this integration directory

 @returns quoted module URL for generated source

 @example
 ```ts
 helperUrl('./build-imports.ts');
 ```
 */
export function helperUrl(relative: string): string {
  return JSON.stringify(new URL(
    relative,
    import.meta.url
  ).href);
}

//endregion Original source edits retain explicit occurrence checks

//region Static import selection keeps the qualified package mapping

/**
 Native transformations supply their source path and explicit local overrides.
 */
type NativeRebaseInput = {
  /**
   Original module bytes, including imports unaffected by this mapping.
   */
  readonly source: string;
  /**
   Original source path remains the relative import base.
   */
  readonly path: string;
  /**
   Qualified transformed modules replace only their exact original specifiers.
   */
  readonly overrides?: Readonly<Record<string, string>>;
};

/**
 Capture package entry selection before generated modules are rebased.

 @param entry - pure reader of already captured package manifests

 @returns source transformer preserving the qualified static import profile

 @example
 ```ts
 const imports = createNativeImportRewriter({ entry });
 imports({ source, path });
 ```
 */
export function createNativeImportRewriter({ entry }: {
  readonly entry: ImportEntryReader;
}): (input: NativeRebaseInput) => string {
  /**
   Each source transformation retains the factory diagnostic boundary.
   */
  const rl = tagged({
    tag: createNativeImportRewriter.name,
    l
  });
  /**
   Rebase original static imports without changing dynamic import selection.

   @param source - original module bytes

   @param path - original relative-resolution base

   @param overrides - exact transformed entry mappings

   @returns source with qualified static imports

   @throws NativeBatchBuildError when a dependency lacks an explicit mapping
   */
  function imports({
    source,
    path,
    overrides = {}
  }: NativeRebaseInput): string {
    /**
     The active source path remains visible in build diagnostics.
     */
    const importLog = tagged({
      tag: imports.name,
      l: rl
    });
    importLog.debug(`rebasing original native module: ${path}`);
    return rewriteNativeImports({
      source,
      path,
      select: function rebaseNativeImport({
        specifier,
        kind
      }): string {
        if ((kind === 'dynamic') || specifier.startsWith('node:')
          || [
          'crypto',
          'fs',
          'fs/promises',
          'path',
          'readline',
          'string_decoder'
        ].includes(specifier)) return specifier;
        /**
         Only the original qualified packages and explicit overrides can enter this build.
         */
        const target = overrides[specifier] ?? (specifier.startsWith('.') ? new URL(
          specifier,
          pathToFileURL(path)
        ).href
          : specifier === '@earendil-works/pi-agent-core' ? entry({ root: core })
          : specifier === '@earendil-works/pi-ai' ? entry({ root: ai })
          : specifier === '@earendil-works/pi-ai/compat' ? entry({
            root: ai,
            subpath: './compat'
          })
          : specifier === '@earendil-works/pi-codemode' ? entry({ root: codemode }) : undefined);
        if (target === undefined) throw new NativeBatchBuildError(`Unmapped native import: ${specifier}`);
        return target;
      },
    });
  }
  return imports;
}

//endregion Static import selection keeps the qualified package mapping
