import { getLogger } from '@logtape/logtape';
import resolve from '@monochromatic-dev/module-resolve';
import type { Plugin } from 'esbuild';
const l = getLogger(['esbuild-plugin', 'css']);

export default (): Plugin => {
  return {
    name: 'css',

    setup(build) {
      // Filter for any imports that could be a CSS file once resolved.
      build.onResolve({
        filter: /(?:\.css$)|(?:^|[-_.\/@#])(?:css|style)(?:$|[-_\/][^.\s]$)/,
      }, async (args) => {
        if (
          // TODO: Use someArrayLike
          ['plugin', 'script', '.js', '.ts', 'languages'].some(args.path.includes)
          || args.kind === 'entry-point'
        ) {
          return;
        }

        l.debug`${args} triggered resolve`;
        return {
          path: await resolve(args.path, args.importer),
        };
      });
    },
  };
};
