/**
 * Static site build script.
 *
 * Orchestrates the full SSG pipeline:
 * 1. Load and validate MDX content
 * 2. Process changed files through the unified pipeline (with caching)
 * 3. Generate all HTML pages via h-html templates
 * 4. Generate CSS via h-css
 * 5. Generate RSS feeds per language
 * 6. Copy static assets from public/
 * 7. Post-process: HTML minification + zstd compression
 *
 * Run via `mise run build:site` or `bun src/build.ts`.
 */
import { copyFile, mkdir, readFile, writeFile, } from 'node:fs/promises';
import { join, relative, } from 'node:path';

import spawn from 'nano-spawn';
import rehypeParse from 'rehype-parse';
import rehypePresetMinify from 'rehype-preset-minify';
import rehypeStringify from 'rehype-stringify';
import readdir from 'tiny-readdir-glob';
import { unified, } from 'unified';

import {
  buildManifest,
  computePipelineHash,
  createCacheEntry,
  getCachedEntry,
  readCache,
  sha256,
  writeCache,
} from './lib/cache.ts';
import {
  groupByLang,
  groupByName,
  loadContent,
  type Post,
} from './lib/content.ts';
import { createProcessor, } from './lib/markdown.ts';
import { generateLanguageRss, } from './lib/rss.ts';
import { indexPage, } from './pages/index.ts';
import { langPage, } from './pages/lang.ts';
import { namePage, } from './pages/name.ts';
import { postPage, } from './pages/post.ts';
import { generateSiteCss, } from './styles/base.ts';

export {}; // eslint module boundary marker

/** Site base URL for RSS feed links. */
const SITE_URL = 'https://aquati.cat';

/** Output directory for generated static files. */
const DIST = 'dist';

/** Content source directory. */
const CONTENT_DIR = 'src/content';

/** Pipeline config source path (for cache invalidation). */
const PIPELINE_SOURCE = 'src/lib/markdown.ts';

//region Build orchestration

/**
 * Runs the full static site build.
 *
 * Reads cache, processes changed MDX files, generates all pages,
 * writes output, and updates the cache manifest.
 */
async function build(): Promise<void> {
  console.log('[build] starting',);

  const [posts, cache, pipelineHash,] = await Promise.all([
    loadContent(CONTENT_DIR,),
    readCache(),
    computePipelineHash(PIPELINE_SOURCE,),
  ],);

  console.log(`[build] loaded ${posts.length} posts`,);

  const pipelineChanged = cache?.pipelineHash !== pipelineHash;
  if (pipelineChanged) {
    console.log('[build] pipeline changed, invalidating all cache entries',);
  }

  const effectiveCache = pipelineChanged ? undefined : cache;

  const processor = createProcessor();
  const renderedContent = new Map<string, string>();
  const cacheEntries: Record<string, ReturnType<typeof createCacheEntry>> = {};

  /** Counter for cache hits during content processing. */
  let cacheHits = 0;

  await Promise.all(posts.map(async function processPost(post,) {
    const contentHash = sha256(await readFile(post.filePath, 'utf8',),);
    const cacheKey = relative('.', post.filePath,);
    const cached = getCachedEntry({
      manifest: effectiveCache,
      filePath: cacheKey,
      contentHash,
    },);

    if (cached !== undefined) {
      renderedContent.set(`${post.lang}/${post.name}`, cached.html,);
      cacheEntries[cacheKey] = cached;
      cacheHits += 1;
      return;
    }

    const result = await processor.process(post.body,);
    const html = String(result,);
    renderedContent.set(`${post.lang}/${post.name}`, html,);
    cacheEntries[cacheKey] = createCacheEntry({
      contentHash,
      html,
      frontmatter: post.data,
    },);
  },),);

  console.log(`[build] processed ${posts.length - cacheHits} files, ${cacheHits} from cache`,);

  await generatePages({ posts, renderedContent, },);
  await generateAssets(posts,);
  await postProcess();

  await writeCache(buildManifest({ pipelineHash, entries: cacheEntries, },),);
  console.log('[build] done',);
}

//endregion Build orchestration

//region Page generation

/**
 * Generates all HTML pages from posts and rendered content.
 *
 * @param posts - all loaded posts
 *
 * @param renderedContent - map of `lang/name` to rendered HTML
 */
async function generatePages(
  { posts, renderedContent, }: {
    posts: Post[];
    renderedContent: Map<string, string>;
  },
): Promise<void> {
  const byLang = groupByLang(posts,);
  const byName = groupByName(posts,);
  const langs = Object.keys(byLang,);
  const names = Object.keys(byName,);

  const writes: Array<Promise<void>> = [];

  writes.push(writePage('index.html', indexPage(langs,),),);

  for (const lang of langs) {
    const langPosts = byLang[lang] ?? [];
    writes.push(writePage(`${lang}/index.html`, langPage({ lang, posts: langPosts, },),),);

    for (const name of names) {
      const post = langPosts.find(function matchName(lp,) {
        return lp.name === name;
      },);
      const html = renderedContent.get(`${lang}/${name}`,);
      writes.push(writePage(
        `${lang}/${name}/index.html`,
        postPage({ post, lang, name, renderedHtml: html, },),
      ),);
    }
  }

  for (const name of names) {
    const namePosts = byName[name] ?? [];
    writes.push(writePage(`${name}/index.html`, namePage({ name, posts: namePosts, },),),);
  }

  await Promise.all(writes,);
  console.log(`[build] generated ${writes.length} pages`,);
}

//endregion Page generation

//region Asset generation

/**
 * Generates CSS, RSS feeds, and copies static assets to dist.
 *
 * @param posts - all loaded posts for RSS generation
 */
async function generateAssets(posts: Post[],): Promise<void> {
  const byLang = groupByLang(posts,);
  const writes: Array<Promise<void>> = [];

  writes.push(writePage('styles.css', generateSiteCss(),),);

  for (const [lang, langPosts,] of Object.entries(byLang,)) {
    const rssXml = generateLanguageRss({ lang, posts: langPosts, siteUrl: SITE_URL, },);
    writes.push(writePage(`${lang}/rss.xml`, rssXml,),);
  }

  const publicFiles = await readdir('public/**/*',);
  for (const filePath of publicFiles.files) {
    const relativePath = relative('public', filePath,);
    const destPath = join(DIST, relativePath,);
    await mkdir(join(DIST, relative('public', join(filePath, '..',),),), { recursive: true, },);
    writes.push(copyFile(filePath, destPath,),);
  }

  await Promise.all(writes,);
}

//endregion Asset generation

//region Post-processing

/**
 * Minifies all generated HTML files and compresses with zstd.
 */
async function postProcess(): Promise<void> {
  const htmlFiles = await readdir(`${DIST}/**/*.html`,);

  await Promise.all(htmlFiles.files.map(async function minifyHtml(htmlPath,) {
    const content = await readFile(htmlPath, 'utf8',);
    const minified = String(
      await unified()
        .use(rehypeParse,)
        .use(rehypePresetMinify,)
        .use(rehypeStringify,)
        .process(content,),
    );
    await writeFile(htmlPath, minified, 'utf8',);
  },),);

  console.log(`[build] minified ${htmlFiles.files.length} HTML files`,);

  try {
    await spawn('zstd', [
      '-z', '-f', '-v', '--no-check', '-T0',
      '--exclude-compressed', '--no-content-size',
      '-r', '--adapt', DIST,
    ],);
    console.log('[build] compressed with zstd',);
  }
  catch (zstdError) {
    console.error('[build] zstd compression failed:', zstdError,);
  }
}

//endregion Post-processing

//region File utilities

/**
 * Writes content to a file in the dist directory, creating parent dirs as needed.
 *
 * @param relativePath - path relative to dist/
 *
 * @param content - file content to write
 */
async function writePage(relativePath: string, content: string,): Promise<void> {
  const fullPath = join(DIST, relativePath,);
  await mkdir(join(fullPath, '..',), { recursive: true, },);
  await writeFile(fullPath, content, 'utf8',);
}

//endregion File utilities

await build();
