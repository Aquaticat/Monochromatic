import c from '@monochromatic.dev/module-console';
import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';
import * as esbuild from 'esbuild';
import { $ } from 'zx';
import { outIndexVueImportPathToNames, outIndexVueImportStr, outMdxImportPathToNames, outMdxImportStr, outTomlImportPathToNames, outTomlImportStr } from './g.ts';
import { esbuildOptions } from './js.ts';

/*
dependsOn: genFrontmatters, ???
TODO: This should also gen vue apps for 404 pages.
 */
const genVueApps = async function genVueApps() {
  c.log(`gen vue apps`);

  await fs.outputFile(
    path.join('dist', 'temp', 'gen-html', 'vue.ts'),
    `
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { fs, path } from '@monochromatic.dev/module-fs-path';
import { mapParallelAsync } from 'rambdax';

${outIndexVueImportStr}
${outMdxImportStr}
${outTomlImportStr}

const fms = [${Array.from(outTomlImportPathToNames.values()).join(',\n')}];
const layouts = new Map([${Array.from(outIndexVueImportPathToNames.values()).map((outIndexVueImportName) => `['${outIndexVueImportName}', ${outIndexVueImportName}]`).join(',\n')}]);
const posts = new Map([${Array.from(outMdxImportPathToNames.values()).map((outMdxImportName) => `['${outMdxImportName}', ${outMdxImportName}]`).join(',\n')}]);

await mapParallelAsync(
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

    await fs.outputFile(
      path.join(
        'dist',
        'temp',
        'html',
        fm.slugWIndexWExt,
      ),
      \`
    <!DOCTYPE html>
    <html lang='\${fm.lang}'>
    <head>
      <meta charset='utf-8' />
      <meta
        name='viewport'
        content='width=device-width,initial-scale=1'
      />
      <link
        href='\${fm.slashSiteBase}/index.css'
        rel='preload'
        as='style'>

      <title>\${fm.fullTitle}</title>

      <link
      href='\${fm.slashSiteBase}/index.css'
      blocking='render'
      rel='stylesheet'>

      <link rel='icon' href='\${fm.slashSiteBase}/favicon.ico' sizes='32x32'>
      <link
        rel='icon'
        type='image/svg+xml'
        href='\${fm.slashSiteBase}/favicon.svg'
      />
      <link rel='apple-touch-icon' href='\${fm.slashSiteBase}/apple-touch-icon.png'>

      <script
      src='\${fm.slashSiteBase}/index.js'
      async
      type='module'></script>

      <meta
      name='title'
      content='\${fm.title}'
      />
      <meta
      name='description'
      content='\${fm.description}'
      />
      <meta
      name='theme-color'
      content='\${fm.theming.color}'
      />
      <meta
      name='keywords'
      content='\${fm.tags.join(' ')}'
      />
      <link
        rel='canonical'
        href='\${fm.canonicalUrl}'
      />

      \${fms.filter((potentialMatchingFm) => potentialMatchingFm.path.name === fm.path.name)
            .map((matchingFm) =>
              \`<link rel='alternate' href='/\${matchingFm.slug}' hreflang='\${matchingFm.lang}' />\`).join('\\n')}
    </head>
    <body>
      \${html}
    </body>
    </html>
    \`);
  }
  , fms);
`,
  );
};

const buildVueApps = async function buildVueApps() {
  c.log(`esbuild vue.ts`, 'dist/temp/gen-html/vue.ts');
  const ctx = await esbuild.context(
    esbuildOptions(['dist/temp/gen-html/vue.ts'], 'dist/temp/gen-html'),
  );
  const result = await ctx.rebuild();
  await ctx.dispose();
  await fs.outputFile(
    path.join('dist', 'temp', 'esbuild', 'vue.meta.json'),
    JSON.stringify(result.metafile, null, 2),
  );
};

const runVueApps = async function runVueApps() {
  c.log(`node vue.js`, 'dist/temp/gen-html/vue.js');
  await $`node ./dist/temp/gen-html/vue.js`;
};

export default async function genBuildRunVueApps() {
  await genVueApps();
  await buildVueApps();
  await runVueApps();
}
