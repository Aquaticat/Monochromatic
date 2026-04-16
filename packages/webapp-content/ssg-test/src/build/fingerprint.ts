/**
 * Content-hash fingerprinting for static assets.
 *
 * Post-processes `dist/` after the full build (site + pagefind)
 * to rename assets with content hashes and rewrite references
 * in HTML, CSS, and `manifest.webmanifest`.
 *
 * Three dependency-ordered phases (order matters because CSS references fonts):
 * 1. Hash leaf assets (images, fonts, JS, PDFs, favicons) -- no outgoing references
 * 2. Rewrite CSS font `url()` with hashed names from phase 1, then hash the CSS
 * 3. Rewrite all HTML files and `manifest.webmanifest` with the complete replacement map
 *
 * Phase 3 uses basename-level `replaceAll` rather than HTML parsing.
 * This works because the h-html template system produces predictable output,
 * and basename replacement handles both absolute (`/inter.woff2`) and
 * relative (`../glass-collection.avif`) paths uniformly.
 *
 * Excluded: HTML (entry points), pagefind (manages own hashing), MDX source files,
 * `robots.txt`, RSS feeds, `manifest.webmanifest` (rewritten but not renamed).
 * Also excludes `node_modules/`, hidden directories, and build artifacts
 * (`*.tsbuildinfo`, `*.jsonl`) that may exist inside `dist/`.
 *
 * Run via `mise run build:fingerprint` or `bun src/build/fingerprint.ts`.
 */
import { createHash, } from 'node:crypto';
import {
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import {
  basename,
  dirname,
  join,
} from 'node:path';

import {
  $,
  initPromise,
} from '@monochromatic-dev/module-es/logger';
import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';
import readdir from 'tiny-readdir-glob';

import { sha256, } from '../lib/cache-hash.ts';

import { DIST, } from './write-page.ts';

export {}; // eslint module boundary marker

await initPromise;

/** Tagged logger for the fingerprint pipeline. */
const l = tagged({
  tag: 'fingerprint',
  l: $,
},);

/** Number of hex characters to use from the SHA-256 digest. */
const HASH_LENGTH = 10;

/**
 * Regex matching a previously fingerprinted filename.
 * Matches `name.{10 hex chars}.ext` patterns.
 */
const STALE_HASH_PATTERN = /\.[0-9a-f]{10}\.[^.]+$/;

/**
 * Regex matching a previously fingerprinted filename with zstd compression.
 * Matches `name.{10 hex chars}.ext.zst` patterns.
 */
const STALE_HASH_ZST_PATTERN = /\.[0-9a-f]{10}\.[^.]+\.zst$/;

//region Helper functions

/**
 * Computes a SHA-256 hex digest of a Buffer.
 *
 * @param input - binary data to hash
 *
 * @returns hex-encoded SHA-256 digest
 *
 * @example
 * ```ts
 * const hash = sha256Buffer(await readFile('image.avif'));
 * ```
 */
function sha256Buffer(input: Buffer,): string {
  return createHash('sha256',).update(input,).digest('hex',);
}

/**
 * Inserts a content hash before the file extension.
 *
 * @param name - original filename (basename only, no directory)
 *
 * @param hash - full hex hash (sliced to HASH_LENGTH internally)
 *
 * @returns filename with hash inserted before the last extension
 *
 * @example
 * ```ts
 * insertHash({ name: 'styles.css', hash: 'a1b2c3d4ef9876543210' });
 * // → 'styles.a1b2c3d4ef.css'
 * ```
 */
function insertHash(
  {
    name,
    hash,
  }: {
    name: string;
    hash: string;
  },
): string {
  const lastDot = name.lastIndexOf('.',);
  if (lastDot === -1) {
    return `${name}.${hash.slice(0, HASH_LENGTH,)}`;
  }
  const stem = name.slice(0, lastDot,);
  const ext = name.slice(lastDot,);
  return `${stem}.${hash.slice(0, HASH_LENGTH,)}${ext}`;
}

//endregion Helper functions

//region Phase 1 -- fingerprint leaf assets

/**
 * Fingerprints all leaf assets (files with no outgoing references to other hashable assets).
 *
 * @param files - pre-filtered file paths to fingerprint
 *
 * @returns replacement map of original basenames to hashed basenames
 *
 * @example
 * ```ts
 * const replacements = await fingerprintLeafAssets({ files: leafAssetFiles });
 * // Map { 'inter.woff2' => 'inter.a1b2c3d4ef.woff2', ... }
 * ```
 */
async function fingerprintLeafAssets(
  { files, }: { files: readonly string[]; },
): Promise<Map<string, string>> {
  const replacements = new Map<string, string>();

  await Promise.all(files.map(async function fingerprintFile(filePath,) {
    const content = await readFile(filePath,);
    const hash = sha256Buffer(content,);
    const original = basename(filePath,);
    const hashed = insertHash({
      name: original,
      hash,
    },);
    const hashedPath = join(
      dirname(filePath,),
      hashed,
    );
    await rename(
      filePath,
      hashedPath,
    );
    replacements.set(
      original,
      hashed,
    );
    l.info(`${original} → ${hashed}`,);
  },),);

  return replacements;
}

//endregion Phase 1

//region Phase 2 -- fingerprint CSS

/**
 * Rewrites font references in CSS and fingerprints the CSS file.
 *
 * Reads `styles.css`, applies existing replacements (font filenames from phase 1),
 * computes a content hash of the updated CSS, writes the hashed file,
 * and deletes the original.
 *
 * @param distDir - path to the dist output directory
 *
 * @param replacements - phase 1 replacement map (mutated: CSS entry added)
 *
 * @example
 * ```ts
 * await fingerprintCss({ distDir: 'dist', replacements });
 * ```
 */
async function fingerprintCss(
  {
    distDir,
    replacements,
  }: {
    distDir: string;
    replacements: Map<string, string>;
  },
): Promise<void> {
  const cssPath = join(
    distDir,
    'styles.css',
  );

  let cssContent: string;
  try {
    cssContent = await readFile(
      cssPath,
      'utf8',
    );
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      l.info('styles.css not found, skipping CSS fingerprinting (already fingerprinted?)',);
      return;
    }
    throw error;
  }

  for (const [original, hashed,] of replacements) {
    cssContent = cssContent.replaceAll(
      original,
      hashed,
    );
  }

  const hash = sha256(cssContent,);
  const hashedName = insertHash({
    name: 'styles.css',
    hash,
  },);
  const hashedPath = join(
    distDir,
    hashedName,
  );
  await writeFile(
    hashedPath,
    cssContent,
    'utf8',
  );
  await unlink(cssPath,);
  replacements.set(
    'styles.css',
    hashedName,
  );
  l.info(`styles.css → ${hashedName}`,);
}

//endregion Phase 2

//region Phase 3 -- rewrite references

/**
 * Rewrites asset references in HTML files and manifest.webmanifest.
 *
 * Performs basename-level string replacement so both absolute (`/inter.woff2`)
 * and relative (`../glass-collection.avif`) references are updated.
 *
 * @param distDir - path to the dist output directory
 *
 * @param replacements - complete replacement map from phases 1 and 2
 *
 * @example
 * ```ts
 * await rewriteReferences({ distDir: 'dist', replacements });
 * ```
 */
async function rewriteReferences(
  {
    distDir,
    replacements,
  }: {
    distDir: string;
    replacements: ReadonlyMap<string, string>;
  },
): Promise<void> {
  const htmlResult = await readdir(`${distDir}/**/*.html`,);
  const rewriteTargets = [
    ...htmlResult.files,
    join(
      distDir,
      'manifest.webmanifest',
    ),
  ];

  await Promise.all(rewriteTargets.map(async function rewriteFile(filePath,) {
    let content = await readFile(
      filePath,
      'utf8',
    );
    for (const [original, hashed,] of replacements) {
      content = content.replaceAll(
        original,
        hashed,
      );
    }
    await writeFile(
      filePath,
      content,
      'utf8',
    );
  },),);

  l.info(`rewrote references in ${rewriteTargets.length} files`,);
}

//endregion Phase 3

//region Stale cleanup

/**
 * Removes previously fingerprinted files from dist.
 *
 * Deletes any file matching the `name.{10 hex chars}.ext` pattern,
 * including `.zst` compressed companions, to prevent accumulation
 * across rebuilds.
 *
 * @param staleFiles - file paths matching the stale fingerprint pattern
 *
 * @example
 * ```ts
 * await cleanStaleFingerprints({ staleFiles: [...] });
 * ```
 */
async function cleanStaleFingerprints(
  { staleFiles, }: { staleFiles: readonly string[]; },
): Promise<void> {
  if (staleFiles.length > 0) {
    await Promise.all(staleFiles.map(function deleteStale(filePath,) {
      return unlink(filePath,);
    },),);
    l.info(`cleaned ${staleFiles.length} stale fingerprinted files`,);
  }
}

//endregion Stale cleanup

//region Main pipeline

l.info('starting',);

/** Single scan of dist, partitioned into stale fingerprinted files and leaf assets. */
const fullScan = await readdir(`${DIST}/**/*`,);

/** Previously fingerprinted files to clean up before re-fingerprinting. */
const staleFiles = fullScan.files.filter(function isStale(filePath,) {
  const name = basename(filePath,);
  return STALE_HASH_PATTERN.test(name,) || STALE_HASH_ZST_PATTERN.test(name,);
},);

await cleanStaleFingerprints({ staleFiles, },);

/** Patterns to exclude from leaf asset fingerprinting. */
const LEAF_EXCLUDES = [
  /\.html$/,
  /styles\.css$/,
  /pagefind\//,
  /node_modules\//,
  /\/\.[^/]+\//,
  /final\//,
  /manifest\.webmanifest$/,
  /robots\.txt$/,
  /rss\.xml$/,
  /\.mdx$/,
  /\.tsbuildinfo$/,
  /\.jsonl$/,
  /\.zst$/,
];

/** Leaf assets eligible for fingerprinting (excludes HTML, CSS, pagefind, etc.). */
const leafAssetFiles = fullScan.files.filter(function isLeafAsset(filePath,) {
  const name = basename(filePath,);
  if (STALE_HASH_PATTERN.test(name,) || STALE_HASH_ZST_PATTERN.test(name,))
    return false;
  return !LEAF_EXCLUDES.some(function matchesExclude(pattern,) {
    return pattern.test(filePath,);
  },);
},);

const replacements = await fingerprintLeafAssets({
  files: leafAssetFiles,
},);
l.info(`phase 1: fingerprinted ${replacements.size} leaf assets`,);

await fingerprintCss({
  distDir: DIST,
  replacements,
},);
l.info('phase 2: fingerprinted CSS',);

await rewriteReferences({
  distDir: DIST,
  replacements,
},);
l.info('phase 3: rewrote references',);

l.info(`done: ${replacements.size} assets fingerprinted`,);

//endregion Main pipeline
