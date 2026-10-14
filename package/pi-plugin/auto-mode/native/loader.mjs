import { registerHooks } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ai, sdk, installedRoots } from './contract/integration/current-sdk/paths.mjs';

const providerSource=pathToFileURL(join(ai,'dist/api/openai-completions.js')).href;
const observedProvider=new URL('./contract/integration/native-batch/generated/openai-stream.mjs',import.meta.url).href;
const hostModules = new Map([
  ['main.js', 'host-main.mjs'],
  ['core/agent-session-services.js', 'host-services.mjs'],
  ['core/agent-session-runtime.js', 'host-runtime.mjs'],
  ['core/agent-session.js', 'agent-session.mjs'],
  ['core/session-manager.js', 'session-manager.mjs'],
  ['core/resource-loader.js', 'resource-loader.mjs'],
  ['core/sdk.js', 'sdk.mjs'],
].map(([original, generated]) => [pathToFileURL(join(sdk, 'dist', original)).href,
  new URL('./contract/integration/native-batch/generated/' + generated, import.meta.url).href]));

/** Resolve each original Pi package through the matching emitted upstream package exports. */
function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@earendil-works/')) {
    const root = installedRoots.get(specifier.split('/')[1]);
    if (root) return nextResolve(specifier, { ...context, parentURL: pathToFileURL(join(root, 'package.json')).href });
  }
  const resolved=nextResolve(specifier, context);
  if(resolved.url===providerSource)return nextResolve(observedProvider,context);
  const hostModule = hostModules.get(resolved.url);
  if (hostModule) return nextResolve(hostModule, context);
  return resolved;
}

registerHooks({ resolve });
