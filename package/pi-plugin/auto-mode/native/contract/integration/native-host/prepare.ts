/**
 Route the qualified native host through maintained managers, resources, and disposal owners.

 @module
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import {
  readNativeHostSources,
  writeNativeHostSources,
  type NativeHostOutput
} from './prepare-files.ts';
import { rewriteNativeImports } from '../native-batch/build-imports.ts';

/**
 Native source drift remains distinct from runtime policy outcomes.
 */
export class NativeHostBuildError extends Error {
  /**
   Build errors identify the original host transformation boundary.
   */
  override readonly name = 'NativeHostBuildError';
}

/**
 Every host build stage retains a tagged diagnostic boundary.
 */
const l = tagged({tag:'auto-mode-native-host-build'});

/**
 Two original disposal sites divide the module source into three segments.
 */
const EXPECTED_DISPOSAL_SEGMENTS = 3;

//region Exact upstream call sites route through the maintained constructor owner.

/**
 Replace one original native call site while rejecting absent or duplicated source locations.

 @param source - original host module
 
 @param before - qualified original spelling
 
 @param after - owned native replacement
 
 @returns source with the verified original site replaced
 
 @throws NativeHostBuildError when the source location is absent or ambiguous
 */
function replaceOnce({
  source,
  before,
  after
}: {
  readonly source:string;
  readonly before:string;
  readonly after:string
}):string {
  /**
   Source guards have their own diagnostic boundary.
   */
  const rl=tagged({
    tag:replaceOnce.name,
    l
  });
  rl.debug('checking exact original host source location');
  if (source.split(before)
    .length
    !== 2)
    throw new NativeHostBuildError(`Native host transformation requires exactly one original call site: ${  before}`);
  return source.replace(
    before,
    after
  );
}

/**
 Rebase static and dynamic imports against their original immutable module URL.

 @param source - original host module
 
 @param original - original module URL before relocation
 
 @returns source with relative module dependencies preserved
 */
function rebase({
  source,
  original
}: {
  readonly source:string;
  readonly original:string
}):string {
  /**
   Dependency relocation retains the original file in build diagnostics.
   */
  const rl=tagged({
    tag:rebase.name,
    l
  });
  rl.debug('rebasing original host module dependencies');
  return rewriteNativeImports({
    source,
    path:original,
    select:function resolveNativeRelativeSpecifier({specifier}) {
      return specifier.startsWith('.')?new URL(
        specifier,
        original
      ).href:specifier;
    }
  });
}

/**
 Emit qualified host entry points through the maintained native owners.

 @param output - generated native module directory owned by this package build
 
 @throws NativeHostBuildError when a required original native call site changes
 
 @example
 ```ts
 await prepareNativeHost({output: generatedDirectory});
 ```
 */
export async function prepareNativeHost({ output }: {readonly output:string}):Promise<void> {
  /**
   Preparation messages identify the active native host stage.
   */
  const rl=tagged({
    tag:prepareNativeHost.name,
    l
  });
  rl.debug('preparing original native host modules');
  /**
   Host bootstrap supplies the maintained constructor and session owners.
   */
  const bootstrap = JSON.stringify(new URL(
    'bootstrap.mjs',
    import.meta.url
  ).href);
  /**
   Resource reload retains the original trust and policy-input boundary.
   */
  const reload = JSON.stringify(new URL(
    'resource-reload.mjs',
    import.meta.url
  ).href);
  /**
   Capture independent inputs before any synchronous source transformation.
   */
  const inputs = await readNativeHostSources();
  /**
   Emission begins only after every original call-site check succeeds.
   */
  const generated: NativeHostOutput[] = [];
  for (const {
    name,
    path,
    source:originalSource
  } of inputs) {
    rl.debug(`preparing native host module: ${name}`);
    /**
     Mutable source belongs only to this module's sequential transformations.
     */
    let source = originalSource;
    if (name === 'main') {
      source = replaceOnce({
        source,
        before: 'import chalk from "chalk";',
        after: `import chalk from ${  JSON.stringify(pathToFileURL(createRequire(path)
          .resolve('chalk'))
          .href)  };`
      });
      source = replaceOnce({
        source,
        before: 'import { assertValidSessionId, SessionManager } from "./core/session-manager.js";',
        after: `import { assertValidSessionId } from "./core/session-manager.js";\n`
          + `import { ownedManagers as SessionManager } from ${  bootstrap  };`
      });
    } else if (name === 'runtime') {
      source = replaceOnce({
        source,
        before: 'import { SessionManager } from "./session-manager.js";',
        after: `import { ownedManagers as SessionManager, disposeHostSession } from ${  bootstrap  };`
      });
      /**
       Both terminal and replacement disposal must route through the same owner.
       */
      const disposal = '        this.session.dispose();';
      if (source.split(disposal)
        .length
        !== EXPECTED_DISPOSAL_SEGMENTS)
        throw new NativeHostBuildError('Native runtime must retain both replacement and terminal disposal calls');
      source = source.replaceAll(
        disposal,
        '        await disposeHostSession(this.session);'
      );
    } else if (name === 'codemode') {
      /**
       The generated definition keeps the canonical prepared-program dispatcher.
       */
      const definition = JSON.stringify(pathToFileURL(join(
        output,
        'program-definition.mjs'
      ))
        .href);
      source = replaceOnce({
        source,
        before: 'import { createCodemodeToolDefinition } from "./tool.js";',
        after: `import { createOwnedCodemodeDefinition as createCodemodeToolDefinition } from ${  definition  };`
      });
      source = replaceOnce({
        source,
        before: '        pi.registerTool({\n            ...createCodemodeToolDefinition({',
        after: '        pi.registerTool(createCodemodeToolDefinition({'
      });
      source = replaceOnce({
        source,
        before: '            }),\n            defaultActive: false,\n        });',
        after: '            }));'
      });
    } else {
      source = replaceOnce({
        source,
        before: 'import { DefaultResourceLoader, } from "./resource-loader.js";',
        after: `import { createHostResourceLoader, createHostSession as createAgentSession } from ${  bootstrap  };\n`
          + `import { reloadHostResource } from ${  reload  };`
      });
      source = replaceOnce({
        source,
        before: 'import { createAgentSession } from "./sdk.js";',
        after: ''
      });
      source = replaceOnce({
        source,
        before: 'new DefaultResourceLoader({',
        after: 'await createHostResourceLoader({'
      });
      source = replaceOnce({
        source,
        before: 'await resourceLoader.reload(options.resourceLoaderReloadOptions);',
        after: 'await reloadHostResource(resourceLoader, options.resourceLoaderReloadOptions);'
      });
    }
    generated.push({
      name,
      source: rebase({
        source,
        original: pathToFileURL(path)
          .href
      })
    });
  }
  await writeNativeHostSources({
    output,
    sources:generated
  });
  rl.debug('prepared original native host modules');
}

//endregion
