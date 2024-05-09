import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';
import {
  Glob,
  type glob,
  type GlobOptions,
} from 'glob';
import { memoize } from 'rambdax';
import { getLogger } from '@logtape/logtape';
const l = getLogger(['build', 'g']);

export const mGlobPatten = ['**/*.*'];

export const mGlobOptions = { ignore: ['**/_*/**', '**/*.br'], nodir: true, maxDepth: 8 };

export type MGlobOptions = typeof mGlobOptions;

export type MGlob = Glob<Omit<GlobOptions, 'withFileTypes'>>;

const g = (
  pattern: Parameters<typeof glob>[0] = mGlobPatten,
  options: Omit<Parameters<typeof glob>[1], 'withFileTypes'> = mGlobOptions,
): MGlob => new Glob(pattern || mGlobPatten, options || mGlobOptions);

export default memoize(g);

const srcDrs = (await fs.readdir('src', { withFileTypes: true, recursive: true })).filter((srcDr) =>
  !srcDr.path.includes('/_')
);

const srcFileDrs = srcDrs.filter((srcDr) => srcDr.isFile());

const indexJsFileDrs = srcFileDrs.filter((srcFileDr) => srcFileDr.name === 'index.js' || srcFileDr.name === 'index.ts');

export const indexJsFilePaths = indexJsFileDrs.map((mdxFileDr) =>
  // @ts-expect-error parentPath is the new name for path
  path.join(mdxFileDr.parentPath, mdxFileDr.name)
);
l.debug`indexJsFilePaths ${indexJsFilePaths}`;

const mdxFileDrs = srcFileDrs.filter((srcFileDr) => srcFileDr.name.endsWith('.mdx'));

export const mdxFilePaths = mdxFileDrs.map((mdxFileDr) =>
  // @ts-expect-error parentPath is the new name for path
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

export const outMdxImportPathToNames = new Map(outMdxPaths.map((outMdxPath) => [
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
l.debug`outMdxImportPathToNames ${outMdxImportPathToNames}`

export const outMdxImportStr =
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

export const outTomlImportPathToNames = new Map(outTomlPaths.map((outTomlPath) => [
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

export const outTomlImportStr =
  (Array.from(outTomlImportPathToNames).map(([outTomlImportPath, outTomlImportName]) =>
    `import ${outTomlImportName} from '${outTomlImportPath}';`
  ))
    .join('\n');
l.debug`outTomlImportStr ${outTomlImportStr}`;

const indexVueFileDrs = srcFileDrs.filter((srcFileDr) => srcFileDr.name === 'index.vue');

export const indexVueFilePaths = indexVueFileDrs.map((indexVueFileDr) =>
  // @ts-expect-error parentPath is the new name for path
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

export const outIndexVueImportPathToNames = new Map(outIndexVuePaths.map((outIndexVuePath) => [
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

export const outIndexVueImportStr =
  (Array.from(outIndexVueImportPathToNames).map(([outIndexVueImportPath, outIndexVueImportName]) =>
    `import ${outIndexVueImportName} from '${outIndexVueImportPath}';`
  ))
    .join('\n');
l.debug`outIndexVueImportStr ${outIndexVueImportStr}`;

const cssFileDrs = srcFileDrs.filter((srcFileDr) => srcFileDr.name.endsWith('.css'));

export const cssFilePaths = cssFileDrs.map((cssFileDr) =>
  // @ts-expect-error parentPath is the new name for path
  path.join(cssFileDr.parentPath, cssFileDr.name)
);
l.debug`cssFilePaths ${cssFilePaths}`;

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

export const otherFilePaths = otherFileDrs.map((otherFileDr) =>
  // @ts-expect-error parentPath is the new name for path
  path.join(otherFileDr.parentPath, otherFileDr.name)
);

l.debug`otherFilePaths ${otherFilePaths}`;
