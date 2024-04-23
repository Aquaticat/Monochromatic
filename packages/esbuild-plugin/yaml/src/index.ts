import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';
import type { Plugin } from 'esbuild';
import { pipedAsync } from 'rambdax';
import { parse } from 'yaml';

export default {
  name: 'yaml',

  setup(build) {
    // This plugin is actually simple enough to not require a build.onResolve call.
    // Kept it here for when implementing deep merges to the parents.
    // TODO: Implement deep merges to the parents.
    build.onResolve({ filter: /\.ya?ml$/ }, (args) => {
      return {
        path: path.join(args.resolveDir, args.path),
        namespace: 'yaml',
      };
    });
    build.onLoad({ filter: /.*/, namespace: 'yaml' }, async (args) => {
      return {
        contents: pipedAsync(args.path, fs.readFileU, parse, JSON.stringify),
        loader: 'json',
      };
    });
  },
} satisfies Plugin;
