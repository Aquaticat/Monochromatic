import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';
import type { Plugin } from 'esbuild';
import JSONC from 'jsonc-simple-parser';
import { pipedAsync } from 'rambdax';

export default {
  name: 'jsonc',

  setup(build) {
    build.onResolve(
      { filter: /(?:(?:\.vscode\/|tsconfig|dprint|api-extractor|devcontainer).*\.json$|\.json[5c])/ },
      (args) => {
        return {
          path: path.join(args.resolveDir, args.path),
          namespace: 'jsonc',
        };
      },
    );
    build.onLoad({ filter: /.*/, namespace: 'jsonc' }, async (args) => {
      return {
        contents: pipedAsync(args.path, fs.readFileU, JSONC.parse, JSON.stringify),
        loader: 'json',
      };
    });
  },
} satisfies Plugin;
