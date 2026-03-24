/**
 * Asset generation for the SSG build.
 *
 * Generates CSS, RSS feeds, and copies static assets to dist.
 */
import {
  copyFile,
  mkdir,
} from 'node:fs/promises';
import {
  dirname,
  join,
  relative,
} from 'node:path';

import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';
import readdir from 'tiny-readdir-glob';

import { isLocale, } from '../i18n/i18n-util.ts';

import { groupByLang, } from '../lib/content-group.ts';
import type { Post, } from '../lib/content.ts';
import { generateLanguageRss, } from '../lib/rss.ts';
import type { Logger, } from '../lib/types.ts';
import { generateSiteCss, } from '../styles/base.ts';
import {
  DIST,
  writePage,
} from './write-page.ts';

/**
 * Generates CSS, RSS feeds, and copies static assets to dist.
 *
 * @param posts - all loaded posts for RSS generation
 *
 * @param siteUrl - base URL for RSS feed links
 *
 * @param contentDir - content source directory path
 *
 * @param l - parent logger for tagged output
 */
export async function generateAssets(
  { posts, siteUrl, contentDir, l: parentLogger, }: {
    posts: readonly Post[];
    siteUrl: string;
    contentDir: string;
    l: Logger;
  },
): Promise<void> {
  const l = tagged({ tag: generateAssets.name, l: parentLogger, },);
  const byLang = groupByLang(posts,);

  const validLangs = Object.keys(byLang,).filter(function filterLocale(key,) {
    return isLocale(key,);
  },);
  const rssWrites = validLangs.map(function writeRss(lang,) {
    const langPosts = byLang[lang] ?? [];
    const rssXml = generateLanguageRss({ lang, posts: langPosts, siteUrl, },);
    return writePage({ relativePath: `${lang}/rss.xml`, content: rssXml, },);
  },);

  const [contentResult, publicResult,] = await Promise.all([
    readdir(`${contentDir}/**/*`,),
    readdir('public/**/*',),
  ],);

  /** All target directories that need to exist before copying files. */
  const allTargetDirs = [
    ...contentResult.files.map(function contentTargetDir(filePath,) {
      return join(DIST, dirname(relative(contentDir, filePath,),),);
    },),
    ...publicResult.files.map(function publicTargetDir(filePath,) {
      return join(DIST, dirname(relative('public', filePath,),),);
    },),
  ];

  await Promise.all(
    [...new Set(allTargetDirs,),].map(function ensureDir(dir,) {
      return mkdir(dir, { recursive: true, },);
    },),
  );

  const copies = [
    ...contentResult.files.map(function copyContentFile(filePath,) {
      return copyFile(filePath, join(DIST, relative(contentDir, filePath,),),);
    },),
    ...publicResult.files.map(function copyPublicFile(filePath,) {
      return copyFile(filePath, join(DIST, relative('public', filePath,),),);
    },),
  ];

  await Promise.all([
    writePage({ relativePath: 'styles.css', content: generateSiteCss(), },),
    ...rssWrites,
    ...copies,
  ],);

  l.info('generated CSS, RSS, and static assets',);
}
