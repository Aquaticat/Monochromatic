import {
  outIndexVueImportPathToNames,
  outIndexVueImportStr,
  outMdxImportPathToNames,
  outMdxImportStr,
  outTomlImportPathToNames,
  outTomlImportStr,
} from '@/src/consts.js';
import { esbuildOptions } from '@/src/consts.ts';
import type { State } from '@/src/state.ts';
import { getLogger } from '@logtape/logtape';
import {
  fs,
  path,
} from '@monochromatic-dev/module-fs-path';
import {
  exec,
  packageInfo,
} from '@monochromatic-dev/module-node/ts';
import * as esbuild from 'esbuild';
const l = getLogger(['a', 'vue']);

/*
dependsOn: genFrontmatters, ???
TODO: This should also gen vue apps for 404 pages.
 */
const genVueApps = async function genVueApps(): Promise<State> {
  l.debug`gen vue apps`;

  return [
    'genVueApps',
    'SUCCESS',
    await fs.outputFile(
      path.join('dist', 'temp', 'gen-html', 'vue.ts'),
      `
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { fs, path } from '@monochromatic-dev/module-fs-path';
import { mapParallelAsync, uniqWith } from 'rambdax';

${outIndexVueImportStr}
${outMdxImportStr}
${outTomlImportStr}

import {
  getLogger,
  configure,
  getConsoleSink,
} from '@logtape/logtape';

await configure({
  sinks: {
    console: getConsoleSink(),
  },
  filters: {},
  loggers: [
    { category: ['build', 'vue', 'app'], level: 'debug', sinks: ['console'] },
    { category: ['logtape', 'meta'], level: 'warning', sinks: ['console'] },
  ],
});

const l = getLogger(['build', 'vue', 'app']);

const fms = [${Array.from(outTomlImportPathToNames.values()).join(',\n')}];
const layouts = new Map([${
        Array
          .from(outIndexVueImportPathToNames.values())
          .map((outIndexVueImportName) =>
            `['${outIndexVueImportName}', ${outIndexVueImportName}]`
          )
          .join(',\n')
      }]);
const posts = new Map([${
        Array
          .from(outMdxImportPathToNames.values())
          .map((outMdxImportName) => `['${outMdxImportName}', ${outMdxImportName}]`)
          .join(',\n')
      }]);

const allLangs = Array.from(new Set(fms.map((potentialFmWUniqueLang) => potentialFmWUniqueLang.lang)));
l.debug\`allLangs \${allLangs}\`;

const postFms = fms.filter((potentialPostFm) => potentialPostFm.isPost);
l.debug\`postFms \${postFms.map((postFm) => ({title: postFm.title, lang: postFm.lang}))}\`;

const postFmsMap = new Map(postFms.map((potentialNeeding404PostFm) =>
  [potentialNeeding404PostFm, postFms.filter((postFm) => postFm.path.name === potentialNeeding404PostFm.path.name)]));
l.debug\`postFmsMap \${new Map(Array.from(postFmsMap).map(([postFm, postFmMatches]) =>
  [
    { title: postFm.title, lang: postFm.lang },
    postFmMatches.map((postFmMatch) =>
      ({ title: postFmMatch.title, lang: postFmMatch.lang })),
  ]))}\`;

const post404Map = Array.from(postFmsMap).map(([postFm, postFmMatches]) =>
  [
    postFm,
    allLangs.filter((lang) =>
      !postFmMatches.map((postFmMatch) =>
        postFmMatch.lang).includes(lang))
  ]);
l.debug\`post404Map \${new Map(Array.from(post404Map).map(([post404FromFm, post404Langs]) =>
  [
    { title: post404FromFm.title, lang: post404FromFm.lang },
    post404Langs
  ]))}\`;

const post404Fms = uniqWith(
  (x, y) => x.slugWIndexWExt === y.slugWIndexWExt,
  Array.from(post404Map).flatMap(([postFm, postFm404Langs]) =>
    postFm404Langs.map((postFm404Lang) =>
      ({
        ...postFm,
        is404: true,
        lang: postFm404Lang,
        slugWIndexWExt: postFm.lang !== postFm.defaultLang
          ? postFm404Lang !== postFm.defaultLang
            ? postFm.slugWIndexWExt.replace(\`/\${postFm.lang}/\`, \`/\${postFm404Lang}/\`)
            : postFm.slugWIndexWExt.replace(\`/\${postFm.lang}/\`, '/')
          : postFm.siteBase
            ? \`\${postFm.siteBase}/\${postFm404Lang}\${postFm.slugWIndexWExt.slice(postFm.siteBase.length)}\`
            : \`\${postFm404Lang}/\${postFm.slugWIndexWExt}\`
      })))
  );
l.debug\`post404Fms \${post404Fms.map((post404Fm) =>
  ({ title: post404Fm.title, lang: post404Fm.lang, slugWIndexWExt: post404Fm.slugWIndexWExt }))}\`;

const htmlTemplate = (fm, html) => \`
<!DOCTYPE html>
<html lang='\${fm.lang}'>
<head>
<meta charset='utf-8' />
<meta name='viewport' content='width=device-width,initial-scale=1' />
<link href='\${fm.slashSiteBase}/index.css' rel='preload' as='style'>
<title>\${fm.fullTitle}</title>
<link href='\${fm.slashSiteBase}/index.css' blocking='render' rel='stylesheet'>
<link rel='icon' href='\${fm.slashSiteBase}/favicon.ico' sizes='32x32'>
<link rel='icon' type='image/svg+xml' href='\${fm.slashSiteBase}/favicon.svg'>
<link rel='apple-touch-icon' href='\${fm.slashSiteBase}/apple-touch-icon.png'>
<script src='\${fm.slashSiteBase}/index.js' async type='module'></script>
<meta name='title' content='\${fm.title}' />
<meta name='description' content='\${fm.description}' />
<meta name='theme-color' content='\${fm.theming.color}' />
<meta name='keywords' content='\${fm.tags.join(' ')}' />
<link rel='canonical' href='\${fm.canonicalUrl}'/>
\${fm.is404 ? \`<meta http-equiv='response' content='404'>\`: ''}
\${fms.filter((potentialMatchingFm) => potentialMatchingFm.path.name === fm.path.name)
      .map((matchingFm) =>
        \`<link rel='alternate' href='/\${matchingFm.slug}' hreflang='\${matchingFm.lang}' />\`).join('\\n')}
</head>
<body>
  \${html}
</body>
</html>
\`;

const result = await Promise.all([
  (async function genNormal() {
    return await mapParallelAsync(
      async (fm) => {
        const app = createSSRApp({
          components: { Layout: layouts.get(fm.layoutImportName)!, Post: posts.get(fm.postImportName)! },

          template: \`
          <Layout>
            <Post></Post>
          </Layout>
          \`,
        });

        app.provide('frontmatter', fm);
        app.provide('frontmatters', fms);

        const html = await renderToString(app);

        return await fs.outputFile(
          path.join(
            'dist',
            'temp',
            'html',
            fm.slugWIndexWExt,
          ),
          htmlTemplate(fm, html),
        );
      }
      , fms);
  })(),
  (async function gen404() {
    return await mapParallelAsync(
      async (fm) => {
        const app = createSSRApp({
          components: { Layout: layouts.get(fm.layoutImportName)! },

          template: \`
          <Layout>
          </Layout>
          \`,
        });

        app.provide('frontmatter', fm);
        app.provide('frontmatters', fms);

        const html = await renderToString(app);

        return await fs.outputFile(
          path.join(
            'dist',
            'temp',
            'html',
            fm.slugWIndexWExt,
          ),
          htmlTemplate(fm, html),
        );
      }
      , post404Fms);
  })(),
  fs.outputFile(path.join('dist', 'temp', 'html', 'post404Fms.json'), JSON.stringify(post404Fms, null, 2)),
]);
l.debug\`\${result}\`;
`,
    ),
  ];
};

const buildVueApps = async function buildVueApps(): Promise<State> {
  l.debug`build vue apps esbuild vue.ts dist/temp/gen-html/vue.ts`;
  const ctx = await esbuild.context(
    esbuildOptions(['dist/temp/gen-html/vue.ts'], 'dist/temp/gen-html'),
  );
  const result = await ctx.rebuild();
  await ctx.dispose();
  return [
    'buildVueApps',
    'SUCCESS',
    await fs.outputFile(
      path.join('dist', 'temp', 'esbuild', 'vue.meta.json'),
      JSON.stringify(result.metafile, null, 2),
    ),
  ];
};

const runVueApps = async function runVueApps(): Promise<State> {
  l.debug`run vue apps node vue.js 'dist/temp/gen-html/vue.js`;
  const { all } = await exec`${packageInfo.runtime} ./dist/temp/gen-html/vue.js`;
  return ['runVueApps', 'SUCCESS', all];
};

export default async function genBuildRunVueApps(): Promise<State> {
  l.debug`gen build run vue apps`;
  const genedVueApps = await genVueApps();
  const builtVueApps = await buildVueApps();
  const ranVueApps = await runVueApps();
  return ['genBuildRunVueApps', 'SUCCESS', [genedVueApps, builtVueApps, ranVueApps]];
}
