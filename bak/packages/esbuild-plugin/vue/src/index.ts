import {
  fs,
  path,
} from '@monochromatic-dev/module-fs-path';
import resolve from '@monochromatic-dev/module-resolve';
import type { Plugin } from 'esbuild';
import memoizeFs from 'memoize-fs';
import { mapParallelAsync } from 'rambdax';
import {
  compileScript,
  parse,
} from 'vue/compiler-sfc';

const memoizer = memoizeFs({
  cachePath: 'dist/temp/cache/',
  cacheId: 'vue',
  astBody: true,
  retryOnInvalidCache: true,
});

const toTsWoCache = async (input: string, inputPath: string): Promise<string> => {
  const sfcParseResult = parse(input, { filename: inputPath });

  if (sfcParseResult.errors.length !== 0) {
    throw new Error(`
@monochromatic-dev/esbuild-plugin-vue failed to parse

\`\`\`${inputPath}
${input}
\`\`\`

with ${sfcParseResult.errors.length} errors:
${
      (sfcParseResult.errors.map((error) =>
        ('code' in error)
          ? `compiler ${error.message} ${
            error.loc
              ? `
\`\`\` ${error.loc.start} to ${error.loc.end}
${error.loc.source}
\`\`\`
`
              : ``
          } vue(${error.code})`
          : `syntax ${error.message}`
      ))
        .join('\n')
    }

and result:
${sfcParseResult.descriptor}
`);
  }

  const sfcDescriptor = sfcParseResult.descriptor;

  if (sfcDescriptor.script) {
    throw new Error(`
@monochromatic-dev/esbuild-plugin-vue encountered unsupported script on

\`\`\`${inputPath}
${input}
\`\`\`

with script:
${sfcDescriptor.script}

and result:
${sfcDescriptor}
`);
  }

  if (sfcDescriptor.customBlocks.length > 0) {
    throw new Error(`
@monochromatic-dev/esbuild-plugin-vue encountered unsupported custom blocks on

\`\`\`${inputPath}
${input}
\`\`\`

with ${sfcDescriptor.customBlocks.length} custom blocks:
${sfcDescriptor.customBlocks}

and result:
${sfcDescriptor}
`);
  }
  if (sfcDescriptor.styles.length > 0) {
    throw new Error(`
@monochromatic-dev/esbuild-plugin-vue encountered unsupported styles on

\`\`\`${inputPath}
${input}
\`\`\`

with ${sfcDescriptor.styles.length} styles:
${sfcDescriptor.styles}

and result:
${sfcDescriptor}
`);
  }
  if (sfcDescriptor.cssVars.length > 0) {
    throw new Error(`
@monochromatic-dev/esbuild-plugin-vue encountered unsupported css vars on

\`\`\`${inputPath}
${input}
\`\`\`

with ${sfcDescriptor.cssVars.length} css vars:
${sfcDescriptor.cssVars}

and result:
${sfcDescriptor}
`);
  }

  const sfcScriptSetup = compileScript(sfcDescriptor, {
    id: 'vue',
    isProd: false,
    babelParserPlugins: ['typescript'],
    inlineTemplate: true,
    templateOptions: {},
  });

  return sfcScriptSetup.content;
};

export const toTs: typeof toTsWoCache = await memoizer.fn(toTsWoCache);

export default (options?: { save?: boolean | string | string[]; }): Plugin => {
  const save = options?.save ?? false;

  return {
    name: 'vue',

    setup(build) {
      const saveTo: string[] = save === true
        ? [
          build.initialOptions.outdir
            ? `${build.initialOptions.outdir}/vue`
            : 'dist/temp/vue',
        ]
        : save === false
        ? []
        : typeof save === 'string'
        ? [save]
        : save;

      build.onResolve({ filter: /\.vue$/ }, async (args) => {
        return {
          path: await resolve(args.path, args.importer),
          namespace: 'vue',
        };
      });

      build.onLoad({ filter: /\.*/, namespace: 'vue' }, async (args) => {
        const input = await fs.readFileU(args.path);

        const contents = await toTs(input, args.path);

        await mapParallelAsync(
          async (outputDirPath) =>
            await fs.outputFile(
              `${
                path.join(
                  outputDirPath,
                  path.relative(
                    path.join(path.resolve(), 'src'),
                    args
                      .path,
                  ),
                )
              }.ts`,
              contents,
            ),
          saveTo,
        );

        return {
          contents,
          loader: 'ts',
          resolveDir: (await path.parseFs(args.path)).dir,
        };
      });
    },
  };
};
