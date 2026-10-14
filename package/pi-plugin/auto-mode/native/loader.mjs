import { registerHooks } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { installedRoots } from './contract/integration/current-sdk/paths.mjs';

/** Resolve each original Pi package through the matching emitted upstream package exports. */
function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@earendil-works/')) {
    const root = installedRoots.get(specifier.split('/')[1]);
    if (root) return nextResolve(specifier, { ...context, parentURL: pathToFileURL(join(root, 'package.json')).href });
  }
  return nextResolve(specifier, context);
}

registerHooks({ resolve });
