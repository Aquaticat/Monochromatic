/**
 Preserve original native module identities while routing qualified source through maintained transformations.

 @module
 */
import {
  registerHooks,
  type ResolveHookSync,
  type ResolveHookContext,
  type ResolveFnOutput,
  type ModuleHooks
} from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import {
  ai,
  sdk,
  installedRoots
} from './contract/integration/current-sdk/paths.ts';

//region Native source URLs select their original instrumented counterparts

/**
 Module and function tags keep resolver activity separate from policy judgments.
 */
const l = tagged({ tag: 'auto-mode-native-loader' });

/**
 Original provider serializer must retain its own payload-occurrence instrumentation.
 */
const providerSource = pathToFileURL(join(
  ai,
  'dist/api/openai-completions.js'
))
  .href;

/**
 Owned serializer was generated from the qualified original provider source.
 */
const observedProvider = new URL(
  'contract/integration/native-batch/generated/openai-stream.mjs',
  import.meta.url
).href;

/**
 Native constructor, resource, runtime and tool paths retain one original module identity each.
 */
const hostModules = new Map<string, string>();
for (const [original, generated] of Object.entries({
  'main.js': 'host-main.mjs',
  'core/agent-session-services.js': 'host-services.mjs',
  'core/agent-session-runtime.js': 'host-runtime.mjs',
  'core/agent-session.js': 'agent-session.mjs',
  'core/session-manager.js': 'session-manager.mjs',
  'core/extensions/runner.js': 'event-runner.mjs',
  'core/resource-loader.js': 'resource-loader.mjs',
  'core/sdk.js': 'sdk.mjs',
  'extensions/codemode/index.js': 'host-codemode.mjs',
})) {
  hostModules.set(
    pathToFileURL(join(
      sdk,
      'dist',
      original
    ))
      .href,
    new URL(
      `contract/integration/native-batch/generated/${generated}`,
      import.meta.url
    ).href
  );
}

/**
 Native hooks own the callback shape dictated by Node's synchronous module interface.
 */
const hooks = {
  /**
   Resolve each original Pi package through the matching emitted upstream package exports.

   @param specifier - original import whose module identity must remain consistent

   @param context - native resolution context retained for unmodified imports

   @param nextResolve - original host resolver preserving package export semantics

   @returns original resolver result for the selected module identity
   */
  resolve(
    specifier: string,
    context: ForeignBorrowed<ResolveHookContext>,
    nextResolve: Parameters<ResolveHookSync>[2],
  ): ResolveFnOutput {
    /**
     Resolver diagnostics retain their function boundary.
     */
    const rl = tagged({
      tag: hooks.resolve
        .name,
      l
    });
    if (specifier.startsWith('@earendil-works/')) {
      /**
       Known scoped package names route through their qualified dependency roots.
       */
      const [, packageName] = specifier.split('/');
      /**
       Missing or unrelated names preserve the native resolver's diagnostic behavior.
       */
      const root = packageName === undefined ? undefined : installedRoots.get(packageName);
      if (root !== undefined) {
        rl.debug('resolving a qualified native package through its original exports');
        return nextResolve(
          specifier,
          {
            ...context,
            parentURL: pathToFileURL(join(
              root,
              'package.json'
            ))
              .href
          }
        );
      }
    }
    /**
     Original resolution identifies files before selecting an instrumented counterpart.
     */
    const resolved = nextResolve(
      specifier,
      context
    );
    if (resolved.url === providerSource) {
      rl.debug('selecting the native provider serializer');
      return nextResolve(
        observedProvider,
        context
      );
    }
    /**
     Only explicitly qualified original host files are replaced.
     */
    const hostModule = hostModules.get(resolved.url);
    if (hostModule !== undefined) {
      rl.debug('selecting a maintained native host module');
      return nextResolve(
        hostModule,
        context
      );
    }
    return resolved;
  }

};

/**
 Registered synchronous hooks preserve native loading before the CLI or SDK starts.
 */
export const nativeLoaderHooks: ModuleHooks = registerHooks(hooks);

//endregion Native source URLs select their original instrumented counterparts
