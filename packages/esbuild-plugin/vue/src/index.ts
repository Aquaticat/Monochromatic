import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';
import resolve from '@monochromatic.dev/module-resolve';
import type { Plugin } from 'esbuild';
import {
  compileScript,
  parse,
} from 'vue/compiler-sfc';
import bigintHash from '@monochromatic.dev/module-bigint-hash';

export default (): Plugin => {
  return {
    name: 'vue',

    setup(build) {
      const cache = new Map();

      build.onResolve({ filter: /\.vue$/ }, async (args) => {
        return {
          path: await resolve(args.path, args.importer),
          namespace: 'vue',
        };
      });

      build.onLoad({ filter: /\.*/, namespace: 'vue' }, async (args) => {
        const input = await fs.readFileU(args.path);

        const value = cache.get(args.path);

        if (value && value.input === input) {
          return { contents: value.output, loader: 'ts', resolveDir: (await path.parseFs(args.path)).dir };
        }

        const sfcParseResult = parse(input, { filename: args.path });

        if (sfcParseResult.errors.length !== 0) {
          throw new Error(`
@monochromatic.dev/esbuild-plugin-vue failed to parse

\`\`\`${args.path}
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
@monochromatic.dev/esbuild-plugin-vue encountered unsupported script on

\`\`\`${args.path}
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
@monochromatic.dev/esbuild-plugin-vue encountered unsupported custom blocks on

\`\`\`${args.path}
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
@monochromatic.dev/esbuild-plugin-vue encountered unsupported styles on

\`\`\`${args.path}
${input}
\`\`\`

with ${sfcDescriptor.styles.length} styles:
${sfcDescriptor.styles}

and result:
${sfcDescriptor}
`);
        }                if (sfcDescriptor.cssVars.length > 0) {
          throw new Error(`
@monochromatic.dev/esbuild-plugin-vue encountered unsupported css vars on

\`\`\`${args.path}
${input}
\`\`\`

with ${sfcDescriptor.cssVars.length} css vars:
${sfcDescriptor.cssVars}

and result:
${sfcDescriptor}
`);
        }

        const hash = bigintHash(args.path);

        const sfcScriptSetup = compileScript(sfcDescriptor, {id: hash, isProd: false, babelParserPlugins: ['typescript'], inlineTemplate: true, templateOptions: {}});

        const output = sfcScriptSetup.content;

        const newValue = { input, output };

        cache.set(args.path, newValue);

        return { contents: output, loader: 'ts', resolveDir: (await path.parseFs(args.path)).dir };
      });

      build.onDispose(() => {
        cache.clear();
      });
    },
  };
};
