/**
 Prepare original native extension and resource modules from captured build inputs.

 @module
 */
import {
  readFile,
  writeFile
} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import {
  sdk,
  core,
  ai,
  tui
} from '../current-sdk/paths.ts';
import {
  extensionToolSource,
  resourceToolSource
} from './extension-tool-source.ts';
import {replaceOnce} from './build-rebase.ts';
import {rewriteNativeImports} from './build-imports.ts';
import type { NativePreparationInput } from './prepare-types.ts';

//region Original resource modules retain qualified import and observation boundaries

/**
 Resource preparation diagnostics remain attributable to their build phase.
 */
const l = tagged({ tag: 'auto-mode-native-prepare-resources' });

/**
 Prepare original native resource modules with qualified source edits and captured import selection.

 @param output - directory receiving generated modules from this build occurrence

 @param entry - pure import selector over captured package manifests

 @param imports - original static import rewriter and qualified overrides

 @throws NativeBatchBuildError when original call sites or import mappings change

 @example
 ```ts
 await prepareResources({ output, entry, imports });
 ```
 */
export async function prepareResources({
  output,
  entry,
  imports
}: NativePreparationInput): Promise<void> {
  /**
   Every source preparation phase retains its own asynchronous diagnostic boundary.
   */
  const rl = tagged({
    tag: prepareResources.name,
    l
  });
  rl.debug('reading original native extension and resource modules');
  /**
   Original extension module location remains the base for native dynamic imports.
   */
  const extensionLoaderPath=join(
    sdk,
    'dist/core/extensions/loader.js'
  );
  /**
   Original resource module location remains the base for its existing dependency resolution.
   */
  const resourceLoaderPath=join(
    sdk,
    'dist/core/resource-loader.js'
  );
  /**
   Finite source inputs are captured before any generated module is written.
   */
  const [extensionSource, resourceSource] = await Promise.all([
    readFile(
      extensionLoaderPath,
      'utf8'
    ),
    readFile(
      resourceLoaderPath,
      'utf8'
    )
  ]);
  /**
   Native dynamic package lookups retain the captured qualified package entry mapping.
   */
  const nativeAliases={
   '@earendil-works/pi-agent-core':entry({root:core}),
   '@earendil-works/pi-tui':entry({root:tui}),
   '@earendil-works/pi-ai/compat':entry({
     root:ai,
     subpath:'./compat'
   }),
   '@earendil-works/pi-ai/oauth':entry({
     root:ai,
     subpath:'./oauth'
   }),
   '@earendil-works/pi-ai/providers/all':entry({
     root:ai,
     subpath:'./providers/*'
   })
     .replace(
       '*',
       'all'
     )
  };
  /**
   Original extension registration keeps its native validation and observer frame.
   */
  const originalExtensionLoader=extensionToolSource(extensionSource);
  /**
   Native package aliases replace only their original resolver occurrence.
   */
  const aliasedExtensionLoader=replaceOnce({
    source:originalExtensionLoader,
    from:'import.meta.resolve(specifier)',
    to:`(${JSON.stringify(nativeAliases)})[specifier]`
  });
  /**
   The relocated extension loader retains the original source module's base URL.
   */
  const locatedExtensionLoader=aliasedExtensionLoader.replaceAll(
    'import.meta.url',
    JSON.stringify(pathToFileURL(extensionLoaderPath)
      .href)
  );
  /**
   Original literal dynamic imports retain their source-relative locations.
   */
  const extensionLoader=rewriteNativeImports({
    source:locatedExtensionLoader,
    path:extensionLoaderPath,
    select:function rebaseNativeDynamicImport({
      specifier,
      kind
    }): string {
      return (kind==='dynamic')&&specifier.startsWith('.')?new URL(
        specifier,
        pathToFileURL(extensionLoaderPath)
      ).href:specifier;
    }
  });
  /**
   The original resource receipt store remains the only owner of collected extension inputs.
   */
  const poolUrl=new URL(
    '../../collector/run-prompt-custody-v3/loaded-inputs.mjs',
    import.meta.url
  ).href;
  /**
   Static dependency rebasing preserves the original terminal, receipt, and native loader modules.
   */
  const resourceLoader=imports({
    source:resourceToolSource(resourceSource),
    path:resourceLoaderPath,
    overrides:{
   './extensions/loader.js':pathToFileURL(join(
     output,
     'extension-loader.mjs'
   ))
     .href,
   '@earendil-works/pi-tui':entry({root:tui}),
   chalk:pathToFileURL(createRequire(pathToFileURL(resourceLoaderPath))
     .resolve('chalk'))
     .href,
   [poolUrl]:poolUrl
  }
  });
  /**
   All source transformations finish before independent generated files are published.
   */
  const generatedExtensionLoader = imports({
    source:extensionLoader,
    path:extensionLoaderPath
  });
  rl.debug('writing original resource and extension transformations');
  await Promise.all([
    writeFile(
      join(
        output,
        'extension-loader.mjs'
      ),
      generatedExtensionLoader,
      {mode:0o600}
    ),
    writeFile(
      join(
        output,
        'resource-loader.mjs'
      ),
      resourceLoader,
      {mode:0o600}
    )
  ]);
}

//endregion Original resource modules retain qualified import and observation boundaries
