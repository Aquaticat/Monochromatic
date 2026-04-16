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

import type { Locales, } from '../i18n/i18n-types.ts';

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
 * @param siteUrl - base URL for RSS feed links
 *
 * @param contentDir - content source directory path
 *
 * @param byLang - posts grouped by locale (pre-computed by build orchestrator)
 *
 * @param validLangs - locale codes present in the content
 *
 * @param l - parent logger for tagged output
 *
 * @example
 * ```ts
 * await generateAssets({ siteUrl: 'https://example.com', contentDir: 'src/content', byLang, validLangs, l: rootLogger });
 * ```
 */
export async function generateAssets(
  {
    siteUrl,
    contentDir,
    byLang,
    validLangs,
    l: parentLogger,
  }: {
    siteUrl: string;
    contentDir: string;
    byLang: Partial<Record<Locales, Post[]>>;
    validLangs: readonly Locales[];
    l: Logger;
  },
): Promise<void> {
  const l = tagged({
    tag: generateAssets.name,
    l: parentLogger,
  },);

  const rssWrites = validLangs.map(function writeRss(lang,) {
    const langPosts = byLang[lang] ?? [];
    const rssXml = generateLanguageRss({
      lang,
      posts: langPosts,
      siteUrl,
    },);
    return writePage({
      relativePath: `${lang}/rss.xml`,
      content: rssXml,
    },);
  },);

  /**
   * Copies all files from a source directory into dist, preserving relative structure.
   * Creates target directories before copying.
   *
   * @param sourceDir - base directory to copy from
   *
   * @param files - absolute file paths to copy
   */
  async function copyTreeToDist({
    sourceDir,
    files,
  }: {
    sourceDir: string;
    files: readonly string[];
  },): Promise<void> {
    const targetDirs = [...new Set(
      files.map(function targetDir(filePath,) {
        return join(
          DIST,
          dirname(relative(
            sourceDir,
            filePath,
          ),),
        );
      },),
    ),];

    await Promise.all(
      targetDirs.map(function ensureDir(dir,) {
        return mkdir(
          dir,
          { recursive: true, },
        );
      },),
    );

    await Promise.all(
      files.map(function copyOneFile(filePath,) {
        return copyFile(
          filePath,
          join(
            DIST,
            relative(
              sourceDir,
              filePath,
            ),
          ),
        );
      },),
    );
  }

  // Copies all content files (including MDX source) to dist intentionally,
  // so readers can inspect the original source of any post.
  const [contentResult, publicResult,] = await Promise.all([
    readdir(`${contentDir}/**/*`,),
    readdir('public/**/*',),
  ],);

  /** robots.txt allowing all crawlers with sitemap references. */
  const robotsTxt = [
    'User-agent: *',
    'Allow: /',
    '',
    ...validLangs.map(function sitemapEntry(lang,) {
      return `Sitemap: ${siteUrl}/${lang}/rss.xml`;
    },),
    '',
  ]
    .join('\n',);

  await Promise.all([
    writePage({
      relativePath: 'styles.css',
      content: generateSiteCss(),
    },),
    writePage({
      relativePath: 'robots.txt',
      content: robotsTxt,
    },),
    ...rssWrites,
    copyTreeToDist({
      sourceDir: contentDir,
      files: contentResult.files,
    },),
    copyTreeToDist({
      sourceDir: 'public',
      files: publicResult.files,
    },),
  ],);

  l.info('generated CSS, RSS, robots.txt, and static assets',);
}
