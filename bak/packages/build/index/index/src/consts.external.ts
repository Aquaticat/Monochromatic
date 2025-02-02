const hasBabel = ['@babel/*', 'babel', 'babel-*'];

const hasEsbuild = [
  '@esbuild/*',
  'esbuild',
  'esbuild-*',
  '@monochromatic-dev/esbuild-plugin-*',
  '@monochromatic-dev/modified-esbuild-plugin-*',
  '@monochromatic-dev/modified-pipe01-esbuild-plugin-*',
  'unplugin',
  'unplugin-*',
];

const hasVite = ['vite', 'vite-*', '@vite/*'];

const hasTypescript = [
  'typescript',
  '@microsoft/api-extractor',
];

const hasBuildJs = Array.from(
  new Set([hasBabel, hasEsbuild, hasVite, hasTypescript].flat()),
);

const hasLightningCss = [
  'lightningcss',
  'lightningcss-plugin-*',
  '@monochromatic-dev/lightningcss-plugin-*',
];

const hasPostCss = [
  'postcss',
  'postcss-*',
  'cssnano',
  'cssnano-*',
];

const hasBuildCss = Array.from(new Set([hasBuildJs, hasLightningCss, hasPostCss].flat()));

const hasPostHtml = [
  'posthtml',
  'posthtml-*',
  'htmlnano',
];

const hasVue = [
  'vue',
  'vue-tsc',
];

const hasUnified = [
  '@mdx-js/*',
  '@monochromatic-dev/remark-plugin-*',
  '@monochromatic-dev/retext-plugin-*',
  '@monochromatic-dev/rehype-plugin-*',
  '@monochromatic-dev/recma-plugin-*',
  '@monochromatic-dev/mdast-util-*',
  '@monochromatic-dev/nlcst-util-*',
  '@monochromatic-dev/esast-util-*',
  '@monochromatic-dev/xast-util-*',
  '@monochromatic-dev/unist-util-*',
  '@monochromatic-dev/hast-util-*',
  'remark',
  'remark-*',
  // External path cannot have more than one "*" wildcard
  // Modify as needed.
  '@-/remark-*',
  'mdast-*',
  'retext',
  'retext-*',
  '@-/retext-*',
  'nlcst-*',
  'rehype',
  'rehype-*',
  '@-/rehype-*',
  '@hbsnow/rehype-*',
  'hast-*',
  'recma',
  'recma-*',
  'esast-*',
  'xast-*',
  'unist-*',
  'vfile',
  'to-vfile',
  'unified',
  'skiki',
  'shiki-*',
  '@shikijs/*',
];

const hasDom = ['happy-dom', 'linkedom', 'jsdom'];

const hasBuildHtml = Array.from(
  new Set([hasBuildJs, hasPostHtml, hasVue, hasUnified, hasDom].flat()),
);

const hasSharp = ['sharp', '@img/*'];

const hasSvgo = ['svgo', '*-svgmin'];

const hasBuildImg = Array.from(new Set([hasBuildJs, hasSharp, hasSvgo].flat()));

const hasBuild = Array.from(
  new Set([hasBuildJs, hasBuildCss, hasBuildHtml, hasBuildImg].flat()),
);

const hasNative = [
  '@biomejs/*',
  '@dprint/*',
  'dprint',
  'dprint-*',
  '@fervid/napi',
  '@minify-html/*',
  'node-*',
  'sharp',
  '@img/*',
  'node:*',
  'bun:*',
  'deno:*',
  '@cross/*',
];

const hasFs = [
  '@monochromatic-dev/build-*',
  '@monochromatic-dev/config-*',
  '@monochromatic-dev/module-child',
  '@monochromatic-dev/module-equals',
  '@monochromatic-dev/module-fs-path',
  '@monochromatic-dev/module-resolve',
  '@monochromatic-dev/module-pm',
  '@monochromatic-dev/schema-theme-consts',
  'browserslist',
  'chokidar',
  'chokidar-cli',
  'find-up',
  'glob',
  '*-fs',
  'fs-*',
  'zx',
  'dotenv',
];

const hasProcess = [
  'hasha',
  'zod-opts',
  'zx',
  'process-*',
  '*-process',
  'port-*',
  'kill-*',
];

const hasNodeOnly = Array.from(new Set([hasNative, hasFs, hasProcess].flat()));

const hasEval = ['@logtape/logtape'];

const typeOnly = [
  'vite',
  'vue-tsc',
  'typescript',
  '@types/*',
];

const formatters = [
  '@biomejs/*',
  'dprint',
  '@dprint/*',
  'dprint-*',
];

const devOnly = Array.from(new Set([typeOnly, formatters].flat()));

const parsers = [
  'smol-toml',
  'yaml',
  'jsonc-simple-parser',
  '@std/jsonc',
  '@std/yaml',
  '@std/toml',
];

const specific = [
  '*/_fms.js',
  '_fms.js',
  '/_fms.js',
  './_fms.js',
  '/*/_fms.js',
  './*/_fms.js',
];

export default Array.from(
  new Set([hasBuild, hasNodeOnly, hasEval, devOnly, specific].flat()),
) satisfies string[] as string[];
