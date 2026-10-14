import { registerHooks } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ai, installedRoots } from './contract/integration/current-sdk/paths.mjs';

const providerSource=pathToFileURL(join(ai,'dist/api/openai-completions.js')).href;
const observedProvider=new URL('./contract/integration/native-batch/generated/openai-stream.mjs',import.meta.url).href;

/** Resolve each original Pi package through the matching emitted upstream package exports. */
function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@earendil-works/')) {
    const root = installedRoots.get(specifier.split('/')[1]);
    if (root) return nextResolve(specifier, { ...context, parentURL: pathToFileURL(join(root, 'package.json')).href });
  }
  const resolved=nextResolve(specifier, context);
  if(resolved.url===providerSource)return nextResolve(observedProvider,context);
  return resolved;
}

registerHooks({ resolve });
