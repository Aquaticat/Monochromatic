import {
  fs,
  path,
} from '@monochromatic-dev/module-fs-path';
import toExport from '@monochromatic-dev/module-object-to-export';
import pm from '@monochromatic-dev/module-pm';
import resolve from '@monochromatic-dev/module-resolve';
import { parse as jsoncParse } from '@std/jsonc';
import { parse as parseToml } from '@std/toml';
import { parse as parseYaml } from '@std/yaml';
import { parse as parseEnv } from 'dotenv';
import type { Plugin } from 'esbuild';
import { findUpMultiple } from 'find-up';
import { parse as parseIni } from 'ini';
import memoizeFs from 'memoize-fs';
import {
  mapParallelAsync,
  pipedAsync,
} from 'rambdax';

const dotlessExtToType = new Map([
  ['json', 'jsonc'],
  ['jsonl', 'jsonl'],
  ['log', 'jsonl'],
  ['yaml', 'yaml'],
  ['yml', 'yaml'],
  ['toml', 'toml'],
  ['ini', 'ini'],
  ['npmrc', 'ini'],
  ['env', 'env'],
]);

const pathToType = async (inputPath: string): Promise<string> =>
  dotlessExtToType.get((await path.parseFs(inputPath)).ext.slice(1))!;

const parse = (input: string, inputType: string): any => {
  if (inputType === 'jsonl') {
    return jsoncParse(
      `[${
        input
          .split('\n')
          .filter((inputLine) => inputLine.trim())
          .map((nonEmptyInputLine) =>
            nonEmptyInputLine
                .endsWith(',')
              ? nonEmptyInputLine
              : `${nonEmptyInputLine},`
          )
          .join('\n')
      }]`,
    );
  }
  if (inputType === 'jsonc') {
    return jsoncParse(input);
  }
  if (inputType === 'toml') {
    return parseToml(input);
  }
  if (inputType === 'env') {
    return parseEnv(input);
  }
  if (inputType === 'ini') {
    return parseIni(input);
  }
  if (inputType === 'yaml') {
    return parseYaml(input);
  }
  throw new Error(`unsupported inputType ${inputType}`);
};

type Options = {
  mergeParent?: boolean | string | string[];
  schema?:
    | { parseAsync(input: any): Promise<any>; }
    | { parse(input: any): any; }
    | false;
  injectMetadata?: boolean;
};

const isSchemaAsync = (
  schema: { parseAsync(input: any): Promise<any>; } | { parse(input: any): any; },
): schema is { parseAsync(input: any): Promise<any>; } =>
  Object.hasOwn(schema, 'parseAsync');

const memoizer = memoizeFs({
  cachePath: 'dist/temp/cache/',
  cacheId: 'data',
  astBody: true,
  retryOnInvalidCache: true,
});

const toJsWoCache = async (
  input: string,
  inputPath: string,
  options?: Options,
): Promise<string> => {
  const inputDotlessExt = (await path.parseFs(inputPath)).ext.slice(1);
  const mergeParent = options?.mergeParent ?? false;
  const mergeParents: string[] = mergeParent === true
    ? [`index.${inputDotlessExt}`]
    : mergeParent === false
    ? []
    : typeof mergeParent === 'string'
    ? [mergeParent]
    : mergeParent;
  const schema = options?.schema ?? false;
  const injectMetadata = options?.injectMetadata ?? false;
  const ownJson = parse(input, dotlessExtToType.get(inputDotlessExt)!);

  const pkgJsonAbsPath = (await pm(inputPath)).packageAbsDir;

  const mergedJson = mergeParent
    ? {
      ...(await pipedAsync(
        await findUpMultiple(mergeParents, {
          cwd: (await path.parseFs(inputPath)).dir,
          stopAt: pkgJsonAbsPath,
        }),
        async (indexAbsPaths) =>
          await mapParallelAsync(
            async (indexAbsPath) =>
              await pipedAsync(
                indexAbsPath,
                fs.readFileU,
                async (input) => parse(input, await pathToType(indexAbsPath)),
              ),
            indexAbsPaths,
          ),
        (indexTomlContents) => indexTomlContents.toReversed(),
        (reversedIndexTomlContents) => Object.assign({}, ...reversedIndexTomlContents),
      )),
      ...ownJson,
    }
    : ownJson;

  const injectedJson = injectMetadata
    ? { ...mergedJson, path: (await path.parseFs(inputPath)), pkgJsonAbsPath }
    : mergedJson;

  const schemaed = schema
    ? isSchemaAsync(schema)
      ? await schema.parseAsync(injectedJson)
      : await schema.parse(injectedJson)
    : injectedJson;

  return `export default ${toExport(schemaed)}`;
};

export const toJs: typeof toJsWoCache = await memoizer.fn(toJsWoCache);

/**
@param options Object Options
*/
export default (
  options?: Options & { save?: boolean | string | string[]; },
): Plugin => {
  const mergeParent = options?.mergeParent ?? false;
  const mergeParents: string[] = mergeParent === true
    ? ['index.toml']
    : mergeParent === false
    ? []
    : typeof mergeParent === 'string'
    ? [mergeParent]
    : mergeParent;
  const schema = options?.schema ?? false;
  const injectMetadata = options?.injectMetadata ?? false;
  const save = options?.save ?? false;

  return {
    name: 'data',

    setup(build) {
      const saveTo: string[] = save === true
        ? [
          build.initialOptions.outdir
            ? `${build.initialOptions.outdir}/data`
            : 'dist/temp/data',
        ]
        : save === false
        ? []
        : typeof save === 'string'
        ? [save]
        : save;

      build.onResolve({
        filter: /\.(?:toml|json|jsonc|jsonl|yaml|yml|ini|log|toml|npmrc|env)$/,
      }, async (args) => {
        if (args.path.endsWith('.json') && args.with?.type === 'json') {
          // Use node's internal JSON loader.
          return;
        }
        return {
          path: await resolve(args.path, args.importer),
          namespace: 'data',
        };
      });

      build.onLoad({ filter: /.*/, namespace: 'data' }, async (args) => {
        const input = await fs.readFileMU(args.path);

        const contents = await toJs(input, args.path, {
          mergeParent: mergeParents,
          schema,
          injectMetadata,
        });

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
              }.js`,
              contents,
            ),
          saveTo,
        );

        return {
          contents,
          resolveDir: (await path.parseFs(args.path)).dir,
        };
      });
    },
  };
};
