
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { fs, path } from '@monochromatic-dev/module-fs-path';
import { mapParallelAsync, uniqWith } from 'rambdax';

import subtleReplacedSlashindexReplacedDotvue from './subtle/index.vue';
import subtleReplacedSlash404ReplacedDotmdx from './subtle/404.mdx';
import subtleReplacedSlashindexReplacedDotmdx from './subtle/index.mdx';
import subtleReplacedSlashlinksReplacedDotmdx from './subtle/links.mdx';
import subtleReplacedSlashcaReplacedSlash404ReplacedDotmdx from './subtle/ca/404.mdx';
import subtleReplacedSlashcaReplacedSlashindexReplacedDotmdx from './subtle/ca/index.mdx';
import subtleReplacedSlashcaReplacedSlashlinksReplacedDotmdx from './subtle/ca/links.mdx';
import subtleReplacedSlashfrReplacedSlash404ReplacedDotmdx from './subtle/fr/404.mdx';
import subtleReplacedSlashfrReplacedSlashindexReplacedDotmdx from './subtle/fr/index.mdx';
import subtleReplacedSlashfrReplacedSlashlinksReplacedDotmdx from './subtle/fr/links.mdx';
import subtleReplacedSlashpostReplacedSlashmdxReplacedDotmdx from './subtle/post/mdx.mdx';
import subtleReplacedSlashpostReplacedSlashonlyReplacedHyphenenReplacedHyphencaReplacedDotmdx from './subtle/post/only-en-ca.mdx';
import subtleReplacedSlashzhReplacedHyphenCNReplacedSlash404ReplacedDotmdx from './subtle/zh-CN/404.mdx';
import subtleReplacedSlashzhReplacedHyphenCNReplacedSlashindexReplacedDotmdx from './subtle/zh-CN/index.mdx';
import subtleReplacedSlashzhReplacedHyphenCNReplacedSlashlinksReplacedDotmdx from './subtle/zh-CN/links.mdx';
import subtleReplacedSlashzhReplacedHyphenTWReplacedSlash404ReplacedDotmdx from './subtle/zh-TW/404.mdx';
import subtleReplacedSlashzhReplacedHyphenTWReplacedSlashindexReplacedDotmdx from './subtle/zh-TW/index.mdx';
import subtleReplacedSlashzhReplacedHyphenTWReplacedSlashlinksReplacedDotmdx from './subtle/zh-TW/links.mdx';
import subtleReplacedSlashcaReplacedSlashpostReplacedSlashonlyReplacedHyphencaReplacedHyphenfrReplacedDotmdx from './subtle/ca/post/only-ca-fr.mdx';
import subtleReplacedSlashcaReplacedSlashpostReplacedSlashonlyReplacedHyphenenReplacedHyphencaReplacedDotmdx from './subtle/ca/post/only-en-ca.mdx';
import subtleReplacedSlashfrReplacedSlashpostReplacedSlashonlyReplacedHyphencaReplacedHyphenfrReplacedDotmdx from './subtle/fr/post/only-ca-fr.mdx';
import subtleReplacedSlashzhReplacedHyphenCNReplacedSlashpostReplacedSlashmdxReplacedDotmdx from './subtle/zh-CN/post/mdx.mdx';
import subtleReplacedSlashzhReplacedHyphenTWReplacedSlashpostReplacedSlashmdxReplacedDotmdx from './subtle/zh-TW/post/mdx.mdx';
import subtleReplacedSlash404ReplacedDottoml from './subtle/404.toml';
import subtleReplacedSlashindexReplacedDottoml from './subtle/index.toml';
import subtleReplacedSlashlinksReplacedDottoml from './subtle/links.toml';
import subtleReplacedSlashcaReplacedSlash404ReplacedDottoml from './subtle/ca/404.toml';
import subtleReplacedSlashcaReplacedSlashindexReplacedDottoml from './subtle/ca/index.toml';
import subtleReplacedSlashcaReplacedSlashlinksReplacedDottoml from './subtle/ca/links.toml';
import subtleReplacedSlashfrReplacedSlash404ReplacedDottoml from './subtle/fr/404.toml';
import subtleReplacedSlashfrReplacedSlashindexReplacedDottoml from './subtle/fr/index.toml';
import subtleReplacedSlashfrReplacedSlashlinksReplacedDottoml from './subtle/fr/links.toml';
import subtleReplacedSlashpostReplacedSlashmdxReplacedDottoml from './subtle/post/mdx.toml';
import subtleReplacedSlashpostReplacedSlashonlyReplacedHyphenenReplacedHyphencaReplacedDottoml from './subtle/post/only-en-ca.toml';
import subtleReplacedSlashzhReplacedHyphenCNReplacedSlash404ReplacedDottoml from './subtle/zh-CN/404.toml';
import subtleReplacedSlashzhReplacedHyphenCNReplacedSlashindexReplacedDottoml from './subtle/zh-CN/index.toml';
import subtleReplacedSlashzhReplacedHyphenCNReplacedSlashlinksReplacedDottoml from './subtle/zh-CN/links.toml';
import subtleReplacedSlashzhReplacedHyphenTWReplacedSlash404ReplacedDottoml from './subtle/zh-TW/404.toml';
import subtleReplacedSlashzhReplacedHyphenTWReplacedSlashindexReplacedDottoml from './subtle/zh-TW/index.toml';
import subtleReplacedSlashzhReplacedHyphenTWReplacedSlashlinksReplacedDottoml from './subtle/zh-TW/links.toml';
import subtleReplacedSlashcaReplacedSlashpostReplacedSlashonlyReplacedHyphencaReplacedHyphenfrReplacedDottoml from './subtle/ca/post/only-ca-fr.toml';
import subtleReplacedSlashcaReplacedSlashpostReplacedSlashonlyReplacedHyphenenReplacedHyphencaReplacedDottoml from './subtle/ca/post/only-en-ca.toml';
import subtleReplacedSlashfrReplacedSlashpostReplacedSlashonlyReplacedHyphencaReplacedHyphenfrReplacedDottoml from './subtle/fr/post/only-ca-fr.toml';
import subtleReplacedSlashzhReplacedHyphenCNReplacedSlashpostReplacedSlashmdxReplacedDottoml from './subtle/zh-CN/post/mdx.toml';
import subtleReplacedSlashzhReplacedHyphenTWReplacedSlashpostReplacedSlashmdxReplacedDottoml from './subtle/zh-TW/post/mdx.toml';

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

const fms = [subtleReplacedSlash404ReplacedDottoml,
subtleReplacedSlashindexReplacedDottoml,
subtleReplacedSlashlinksReplacedDottoml,
subtleReplacedSlashcaReplacedSlash404ReplacedDottoml,
subtleReplacedSlashcaReplacedSlashindexReplacedDottoml,
subtleReplacedSlashcaReplacedSlashlinksReplacedDottoml,
subtleReplacedSlashfrReplacedSlash404ReplacedDottoml,
subtleReplacedSlashfrReplacedSlashindexReplacedDottoml,
subtleReplacedSlashfrReplacedSlashlinksReplacedDottoml,
subtleReplacedSlashpostReplacedSlashmdxReplacedDottoml,
subtleReplacedSlashpostReplacedSlashonlyReplacedHyphenenReplacedHyphencaReplacedDottoml,
subtleReplacedSlashzhReplacedHyphenCNReplacedSlash404ReplacedDottoml,
subtleReplacedSlashzhReplacedHyphenCNReplacedSlashindexReplacedDottoml,
subtleReplacedSlashzhReplacedHyphenCNReplacedSlashlinksReplacedDottoml,
subtleReplacedSlashzhReplacedHyphenTWReplacedSlash404ReplacedDottoml,
subtleReplacedSlashzhReplacedHyphenTWReplacedSlashindexReplacedDottoml,
subtleReplacedSlashzhReplacedHyphenTWReplacedSlashlinksReplacedDottoml,
subtleReplacedSlashcaReplacedSlashpostReplacedSlashonlyReplacedHyphencaReplacedHyphenfrReplacedDottoml,
subtleReplacedSlashcaReplacedSlashpostReplacedSlashonlyReplacedHyphenenReplacedHyphencaReplacedDottoml,
subtleReplacedSlashfrReplacedSlashpostReplacedSlashonlyReplacedHyphencaReplacedHyphenfrReplacedDottoml,
subtleReplacedSlashzhReplacedHyphenCNReplacedSlashpostReplacedSlashmdxReplacedDottoml,
subtleReplacedSlashzhReplacedHyphenTWReplacedSlashpostReplacedSlashmdxReplacedDottoml];
const layouts = new Map([['subtleReplacedSlashindexReplacedDotvue', subtleReplacedSlashindexReplacedDotvue]]);
const posts = new Map([['subtleReplacedSlash404ReplacedDotmdx', subtleReplacedSlash404ReplacedDotmdx],
['subtleReplacedSlashindexReplacedDotmdx', subtleReplacedSlashindexReplacedDotmdx],
['subtleReplacedSlashlinksReplacedDotmdx', subtleReplacedSlashlinksReplacedDotmdx],
['subtleReplacedSlashcaReplacedSlash404ReplacedDotmdx', subtleReplacedSlashcaReplacedSlash404ReplacedDotmdx],
['subtleReplacedSlashcaReplacedSlashindexReplacedDotmdx', subtleReplacedSlashcaReplacedSlashindexReplacedDotmdx],
['subtleReplacedSlashcaReplacedSlashlinksReplacedDotmdx', subtleReplacedSlashcaReplacedSlashlinksReplacedDotmdx],
['subtleReplacedSlashfrReplacedSlash404ReplacedDotmdx', subtleReplacedSlashfrReplacedSlash404ReplacedDotmdx],
['subtleReplacedSlashfrReplacedSlashindexReplacedDotmdx', subtleReplacedSlashfrReplacedSlashindexReplacedDotmdx],
['subtleReplacedSlashfrReplacedSlashlinksReplacedDotmdx', subtleReplacedSlashfrReplacedSlashlinksReplacedDotmdx],
['subtleReplacedSlashpostReplacedSlashmdxReplacedDotmdx', subtleReplacedSlashpostReplacedSlashmdxReplacedDotmdx],
['subtleReplacedSlashpostReplacedSlashonlyReplacedHyphenenReplacedHyphencaReplacedDotmdx', subtleReplacedSlashpostReplacedSlashonlyReplacedHyphenenReplacedHyphencaReplacedDotmdx],
['subtleReplacedSlashzhReplacedHyphenCNReplacedSlash404ReplacedDotmdx', subtleReplacedSlashzhReplacedHyphenCNReplacedSlash404ReplacedDotmdx],
['subtleReplacedSlashzhReplacedHyphenCNReplacedSlashindexReplacedDotmdx', subtleReplacedSlashzhReplacedHyphenCNReplacedSlashindexReplacedDotmdx],
['subtleReplacedSlashzhReplacedHyphenCNReplacedSlashlinksReplacedDotmdx', subtleReplacedSlashzhReplacedHyphenCNReplacedSlashlinksReplacedDotmdx],
['subtleReplacedSlashzhReplacedHyphenTWReplacedSlash404ReplacedDotmdx', subtleReplacedSlashzhReplacedHyphenTWReplacedSlash404ReplacedDotmdx],
['subtleReplacedSlashzhReplacedHyphenTWReplacedSlashindexReplacedDotmdx', subtleReplacedSlashzhReplacedHyphenTWReplacedSlashindexReplacedDotmdx],
['subtleReplacedSlashzhReplacedHyphenTWReplacedSlashlinksReplacedDotmdx', subtleReplacedSlashzhReplacedHyphenTWReplacedSlashlinksReplacedDotmdx],
['subtleReplacedSlashcaReplacedSlashpostReplacedSlashonlyReplacedHyphencaReplacedHyphenfrReplacedDotmdx', subtleReplacedSlashcaReplacedSlashpostReplacedSlashonlyReplacedHyphencaReplacedHyphenfrReplacedDotmdx],
['subtleReplacedSlashcaReplacedSlashpostReplacedSlashonlyReplacedHyphenenReplacedHyphencaReplacedDotmdx', subtleReplacedSlashcaReplacedSlashpostReplacedSlashonlyReplacedHyphenenReplacedHyphencaReplacedDotmdx],
['subtleReplacedSlashfrReplacedSlashpostReplacedSlashonlyReplacedHyphencaReplacedHyphenfrReplacedDotmdx', subtleReplacedSlashfrReplacedSlashpostReplacedSlashonlyReplacedHyphencaReplacedHyphenfrReplacedDotmdx],
['subtleReplacedSlashzhReplacedHyphenCNReplacedSlashpostReplacedSlashmdxReplacedDotmdx', subtleReplacedSlashzhReplacedHyphenCNReplacedSlashpostReplacedSlashmdxReplacedDotmdx],
['subtleReplacedSlashzhReplacedHyphenTWReplacedSlashpostReplacedSlashmdxReplacedDotmdx', subtleReplacedSlashzhReplacedHyphenTWReplacedSlashpostReplacedSlashmdxReplacedDotmdx]]);

const allLangs = Array.from(new Set(fms.map((potentialFmWUniqueLang) => potentialFmWUniqueLang.lang)));
l.debug`allLangs ${allLangs}`;

const postFms = fms.filter((potentialPostFm) => potentialPostFm.isPost);
l.debug`postFms ${postFms.map((postFm) => ({title: postFm.title, lang: postFm.lang}))}`;

const postFmsMap = new Map(postFms.map((potentialNeeding404PostFm) =>
  [potentialNeeding404PostFm, postFms.filter((postFm) => postFm.path.name === potentialNeeding404PostFm.path.name)]));
l.debug`postFmsMap ${new Map(Array.from(postFmsMap).map(([postFm, postFmMatches]) =>
  [
    { title: postFm.title, lang: postFm.lang },
    postFmMatches.map((postFmMatch) =>
      ({ title: postFmMatch.title, lang: postFmMatch.lang })),
  ]))}`;

const post404Map = Array.from(postFmsMap).map(([postFm, postFmMatches]) =>
  [
    postFm,
    allLangs.filter((lang) =>
      !postFmMatches.map((postFmMatch) =>
        postFmMatch.lang).includes(lang))
  ]);
l.debug`post404Map ${new Map(Array.from(post404Map).map(([post404FromFm, post404Langs]) =>
  [
    { title: post404FromFm.title, lang: post404FromFm.lang },
    post404Langs
  ]))}`;

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
            ? postFm.slugWIndexWExt.replace(`/${postFm.lang}/`, `/${postFm404Lang}/`)
            : postFm.slugWIndexWExt.replace(`/${postFm.lang}/`, '/')
          : postFm.siteBase
            ? `${postFm.siteBase}/${postFm404Lang}${postFm.slugWIndexWExt.slice(postFm.siteBase.length)}`
            : `${postFm404Lang}/${postFm.slugWIndexWExt}`
      })))
  );
l.debug`post404Fms ${post404Fms.map((post404Fm) =>
  ({ title: post404Fm.title, lang: post404Fm.lang, slugWIndexWExt: post404Fm.slugWIndexWExt }))}`;

const htmlTemplate = (fm, html) => `
<!DOCTYPE html>
<html lang='${fm.lang}'>
<head>
<meta charset='utf-8' />
<meta name='viewport' content='width=device-width,initial-scale=1' />
<link href='${fm.slashSiteBase}/index.css' rel='preload' as='style'>
<title>${fm.fullTitle}</title>
<link href='${fm.slashSiteBase}/index.css' blocking='render' rel='stylesheet'>
<link rel='icon' href='${fm.slashSiteBase}/favicon.ico' sizes='32x32'>
<link rel='icon' type='image/svg+xml' href='${fm.slashSiteBase}/favicon.svg'>
<link rel='apple-touch-icon' href='${fm.slashSiteBase}/apple-touch-icon.png'>
<script src='${fm.slashSiteBase}/index.js' async type='module'></script>
<meta name='title' content='${fm.title}' />
<meta name='description' content='${fm.description}' />
<meta name='theme-color' content='${fm.theming.color}' />
<meta name='keywords' content='${fm.tags.join(' ')}' />
<link rel='canonical' href='${fm.canonicalUrl}'/>
${fm.is404 ? `<meta http-equiv='response' content='404'>`: ''}
${fms.filter((potentialMatchingFm) => potentialMatchingFm.path.name === fm.path.name)
      .map((matchingFm) =>
        `<link rel='alternate' href='/${matchingFm.slug}' hreflang='${matchingFm.lang}' />`).join('\n')}
</head>
<body>
  ${html}
</body>
</html>
`;

const result = await Promise.all([
  (async function genNormal() {
    return await mapParallelAsync(
      async (fm) => {
        const app = createSSRApp({
          components: { Layout: layouts.get(fm.layoutImportName)!, Post: posts.get(fm.postImportName)! },

          template: `
          <Layout>
            <Post></Post>
          </Layout>
          `,
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

          template: `
          <Layout>
          </Layout>
          `,
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
l.debug`${result}`;
