import { getLogger } from '@logtape/logtape';
import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';
import pm from '@monochromatic.dev/module-pm';
import {
  Glob,
  type glob,
  type GlobOptions,
} from 'glob';
import { memoize } from 'rambdax';

const l = getLogger(['app', 'consts']);

export const mGlobPatten: string[] = ['**/*.*'];

export const mGlobOptions: {
  ignore: string[];
  nodir: boolean;
  maxDepth: number;
} = { ignore: ['**/_*/**', '**/*.br'], nodir: true, maxDepth: 8 };

export type MGlobOptions = typeof mGlobOptions;

export type MGlob = Glob<Omit<GlobOptions, 'withFileTypes'>>;

const g = (
  pattern: Parameters<typeof glob>[0] = mGlobPatten,
  options: Omit<Parameters<typeof glob>[1], 'withFileTypes'> = mGlobOptions,
): MGlob => new Glob(pattern || mGlobPatten, options || mGlobOptions);

const _default_1: (pattern?: string | string[] | undefined, options?: Omit<GlobOptions, "withFileTypes"> | undefined) => MGlob = memoize(g);
export default _default_1;

const srcDrs = (await fs.readdir('src', { withFileTypes: true, recursive: true })).filter((srcDr) =>
  !srcDr.parentPath.includes('/_')
);

const srcFileDrs = srcDrs.filter((srcDr) => srcDr.isFile());

const indexJsFileDrs = srcFileDrs.filter((srcFileDr) => srcFileDr.name === 'index.js' || srcFileDr.name === 'index.ts');

export const indexJsFilePaths: string[] = indexJsFileDrs.map((mdxFileDr) =>
  path.join(mdxFileDr.parentPath, mdxFileDr.name)
);
l.debug`indexJsFilePaths ${indexJsFilePaths}`;

const mdxFileDrs = srcFileDrs.filter((srcFileDr) => srcFileDr.name.endsWith('.mdx'));

export const mdxFilePaths: string[] = mdxFileDrs.map((mdxFileDr) =>
  path.join(mdxFileDr.parentPath, mdxFileDr.name)
);
l.debug`mdxFilePaths ${mdxFilePaths}`;

const outMdxPaths = mdxFilePaths.map((mdxFilePath) =>
  path.join(
    'dist',
    'temp',
    'gen-html',
    path.relative(
      'src',
      mdxFilePath,
    ),
  )
);

export const outMdxImportPathToNames: Map<string, string> = new Map(outMdxPaths.map((outMdxPath) => [
  `./${
    path
      .relative('dist/temp/gen-html', outMdxPath)
  }`,

  path
    .relative('dist/temp/gen-html', outMdxPath)
    .replaceAll('.', 'ReplacedDot')
    .replaceAll('/', 'ReplacedSlash')
    .replaceAll('-', 'ReplacedHyphen'),
]));
l.debug`outMdxImportPathToNames ${outMdxImportPathToNames}`;

export const outMdxImportStr: string =
  (Array.from(outMdxImportPathToNames).map(([outMdxImportPath, outMdxImportName]) =>
    `import ${outMdxImportName} from '${outMdxImportPath}';`
  ))
    .join(
      '\n',
    );
l.debug`outMdxImportStr ${outMdxImportStr}`;

const outTomlPaths = outMdxPaths.map((outMdxPath) =>
  `${
    outMdxPath.slice(
      0,
      -'.mdx'.length,
    )
  }.toml`
);

export const outTomlImportPathToNames: Map<string, string> = new Map(outTomlPaths.map((outTomlPath) => [
  `./${
    path
      .relative('dist/temp/gen-html', outTomlPath)
  }`,

  path
    .relative('dist/temp/gen-html', outTomlPath)
    .replaceAll('.', 'ReplacedDot')
    .replaceAll('/', 'ReplacedSlash')
    .replaceAll('-', 'ReplacedHyphen'),
]));
l.debug`outTomlImportPathToNames ${outTomlImportPathToNames}`;

export const outTomlImportStr: string =
  (Array.from(outTomlImportPathToNames).map(([outTomlImportPath, outTomlImportName]) =>
    `import ${outTomlImportName} from '${outTomlImportPath}';`
  ))
    .join('\n');
l.debug`outTomlImportStr ${outTomlImportStr}`;

const indexVueFileDrs = srcFileDrs.filter((srcFileDr) => srcFileDr.name === 'index.vue');

export const indexVueFilePaths: string[] = indexVueFileDrs.map((indexVueFileDr) =>
  path.join(indexVueFileDr.parentPath, indexVueFileDr.name)
);
l.debug`indexVueFilePaths ${indexVueFilePaths}`;

const outIndexVuePaths = indexVueFilePaths.map((indexVueFilePath) =>
  path.join(
    'dist',
    'temp',
    'gen-html',
    path.relative(
      'src',
      indexVueFilePath,
    ),
  )
);

export const outIndexVueImportPathToNames: Map<string, string> = new Map(outIndexVuePaths.map((outIndexVuePath) => [
  `./${
    path
      .relative('dist/temp/gen-html', outIndexVuePath)
  }`,

  path
    .relative('dist/temp/gen-html', outIndexVuePath)
    .replaceAll('.', 'ReplacedDot')
    .replaceAll('/', 'ReplacedSlash')
    .replaceAll('-', 'ReplacedHyphen'),
]));
l.debug`outIndexVueImportPathToNames ${outIndexVueImportPathToNames}`;

export const outIndexVueImportStr: string =
  (Array.from(outIndexVueImportPathToNames).map(([outIndexVueImportPath, outIndexVueImportName]) =>
    `import ${outIndexVueImportName} from '${outIndexVueImportPath}';`
  ))
    .join('\n');
l.debug`outIndexVueImportStr ${outIndexVueImportStr}`;

const cssFileDrs = srcFileDrs.filter((srcFileDr) => srcFileDr.name === 'index.css');

export const cssFilePaths: string[] = cssFileDrs.map((cssFileDr) =>
  path.join(cssFileDr.parentPath, cssFileDr.name)
);
l.debug`cssFilePaths ${cssFilePaths}`;

export const cssJsFilePaths: string[] = cssFilePaths.concat(indexJsFilePaths);

const otherFileDrs = srcFileDrs.filter((srcFileDr) =>
  ![
    'js',
    'ts',
    'jsx',
    'tsx',
    'vue',
    'html',
    'mdx',
    'toml',
    'mjs',
    'mts',
  ]
    .some((dotlessSrcExt) => srcFileDr.name.endsWith(`.${dotlessSrcExt}`))
);

export const otherFilePaths: string[] = otherFileDrs.map((otherFileDr) =>
  path.join(otherFileDr.parentPath, otherFileDr.name)
);

l.debug`otherFilePaths ${otherFilePaths}`;

export const caddyConfFilePath: string = path.join('dist', 'temp', 'caddy', 'index.json');

export { default as external } from './_/external.ts';

export { default as esbuildOptions } from './_/esbuildOptions.ts';

export const fromPm: Awaited<ReturnType<typeof pm>> = await pm();

export const cacheRootDir: string = path.join('dist', 'temp', 'cache');
