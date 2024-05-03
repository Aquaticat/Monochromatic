import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';
import toExport from '@monochromatic.dev/module-object-to-export';
import resolve from '@monochromatic.dev/module-resolve';
import type { Plugin } from 'esbuild';
import {
  findUp,
  findUpMultiple,
} from 'find-up';
import {
  mapParallelAsync,
  pipedAsync,
} from 'rambdax';
import { parse } from 'smol-toml';
import {
  z,
  type ZodObject,
  type ZodPipeline,
} from 'zod';

export default function toml(
  mergeParent = '',
  schema: ZodPipeline<any, any> | ZodObject<any> = z.object({}).passthrough(),
  injectMetadata = false,
): Plugin {
  return {
    name: 'toml',

    setup(build) {
      const cache = new Map();

      build.onResolve({ filter: /\.toml$/ }, async (args) => {
        return {
          path: await resolve(args.path, args.importer),
          namespace: 'toml',
        };
      });

      build.onLoad({ filter: /.*/, namespace: 'toml' }, async (args) => {
        const input = await fs.readFileMU(args.path);

        const value = cache.get(args.path);

        if (value && value.input === input) {
          return {
            contents: value.output,
            resolveDir: (await path.parseFs(args.path)).dir,
          };
        }

        const ownJson = parse(input);

        const pkgJsonAbsPath = (await path
          .parseFs((await findUp('package.json', { cwd: (await path.parseFs(args.path)).dir }))!))
          .dir;

        const mergedJson = mergeParent
          ? {
            ...(await pipedAsync(
              await findUpMultiple(mergeParent, {
                cwd: (await path.parseFs(args.path)).dir,
                stopAt: pkgJsonAbsPath,
              }),
              async (indexTomlAbsPaths) =>
                await mapParallelAsync(
                  async (indexTomlAbsPath) => pipedAsync(indexTomlAbsPath, fs.readFileU, parse),
                  indexTomlAbsPaths,
                ),
              (indexTomlContents) => indexTomlContents.toReversed(),
              (reversedIndexTomlContents) => Object.assign({}, ...reversedIndexTomlContents),
            )),
            ...ownJson,
          }
          : ownJson;

        const injectedJson = injectMetadata
          ? { ...mergedJson, path: (await path.parseFs(args.path)), pkgJsonAbsPath }
          : mergedJson;

        const schemaed = await schema.parseAsync(injectedJson);

        const output = `export default ${toExport(schemaed)}`;

        const newValue = { input, output };

        cache.set(args.path, newValue);

        return { contents: output, resolveDir: (await path.parseFs(args.path)).dir };
      });

      build.onDispose(() => {
        cache.clear();
      });
    },
  };
}
