/**
 * Post-processing stage: pagefind indexing + content-hash fingerprinting.
 *
 * Orchestrates two independent post-site operations so they overlap
 * wherever they can:
 *
 * - `pagefind --site dist/` reads every `dist/**\/*.html` and writes its
 *   index to `dist/pagefind/`.
 * - Fingerprinting renames asset files with content hashes and rewrites
 *   references in HTML, CSS, and `manifest.webmanifest`.
 *
 * Fingerprinting has three dependency-ordered phases (CSS references fonts):
 * 1. Hash leaf assets (images, fonts, JS, PDFs, favicons) -- no outgoing references
 * 2. Rewrite CSS font `url()` with hashed names from phase 1, then hash the CSS
 * 3. Rewrite all HTML files and `manifest.webmanifest` with the complete replacement map
 *
 * Phases 1 and 2 touch binary leaf assets and `styles.css` -- disjoint
 * from the HTML pagefind reads. Those phases run **concurrently with
 * pagefind** via `Promise.all`. Phase 3 modifies the same HTML files
 * pagefind reads, so it runs **after** pagefind completes.
 *
 * Phase 3 uses basename-level `replaceAll` rather than HTML parsing.
 * This works because the h-html template system produces predictable
 * output, and basename replacement handles both absolute (`/inter.woff2`)
 * and relative (`../glass-collection.avif`) paths uniformly.
 *
 * Excluded from fingerprinting: HTML (entry points), `pagefind/` (manages
 * its own hashing), MDX source files, `robots.txt`, RSS feeds,
 * `manifest.webmanifest` (rewritten but not renamed). Also excludes
 * `node_modules/`, hidden directories, and build artifacts
 * (`*.tsbuildinfo`, `*.jsonl`) that may exist inside `dist/`.
 *
 * Run via `mise run build:postprocess` or `bun src/build/postprocess.ts`.
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
  initPromise,
  logger,
} from '@monochromatic-dev/module-logger/logger';
import { tagged, } from '@monochromatic-dev/module-logger/tagged';
import spawn from 'nano-spawn';
import readdir from 'tiny-readdir-glob';

import { sha256, } from '../lib/cache-hash.ts';

import { DIST, } from './write-page.ts';

export {}; // module boundary marker

await initPromise;

/** Tagged logger for the postprocess pipeline. */
const l = tagged({
  tag: 'postprocess',
  l: logger,
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
    return `${name}.${
      hash.slice(
        0,
        HASH_LENGTH,
      )
    }`;
  }
  const stem = name.slice(
    0,
    lastDot,
  );
  const ext = name.slice(lastDot,);
  return `${stem}.${
    hash.slice(
      0,
      HASH_LENGTH,
    )
  }${ext}`;
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

  /**
   * Reads the CSS file, returning `undefined` when missing (already fingerprinted).
   *
   * @returns CSS file contents, or `undefined` when the file does not exist
   */
  async function readCss(): Promise<string | undefined> {
    try {
      return await readFile(
        cssPath,
        'utf8',
      );
    }
    catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        l.info(
          'styles.css not found, skipping CSS fingerprinting (already fingerprinted?)',
        );
        return undefined;
      }
      throw error;
    }
  }

  const initialCss = await readCss();
  if (initialCss === undefined)
    return;

  let cssContent = initialCss;
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

//region Pagefind

/**
 * Runs `pagefind --site <distDir>` as a child process.
 *
 * Pagefind reads every `<distDir>/**\/*.html`, extracts indexable text,
 * and writes its index into `<distDir>/pagefind/`. It does not touch
 * any asset hrefs in HTML (those live in `<link>`/`<script>`/`<img>`,
 * which are not part of pagefind's indexed text), so it can safely
 * overlap with fingerprint phases 1 and 2 (leaf-asset renaming + CSS
 * rewriting) which never touch HTML.
 *
 * Each stdout line is forwarded through the tagged logger at info level
 * so pagefind's section headers, index counts, and timing reach the build
 * log. stderr lines are forwarded at warn level (pagefind emits `Note:`
 * diagnostics and hard errors there). Non-zero exit throws.
 *
 * @param distDir - path to the dist output directory to index
 *
 * @example
 * ```ts
 * await runPagefind({ distDir: DIST });
 * ```
 */
async function runPagefind(
  { distDir, }: { distDir: string; },
): Promise<void> {
  const pl = tagged({
    tag: 'pagefind',
    l,
  },);
  const subprocess = spawn(
    'pagefind',
    [
      '--site',
      distDir,
    ],
  );
  await Promise.all([
    (async function forwardStdout(): Promise<void> {
      for await (const line of subprocess.stdout)
        pl.info(line,);
    })(),
    (async function forwardStderr(): Promise<void> {
      for await (const line of subprocess.stderr)
        pl.warn(line,);
    })(),
    subprocess,
  ],);
  pl.info('indexed',);
}

//endregion Pagefind

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

/**
 * Runs fingerprint phases 1 and 2 together: hash leaf assets, then
 * rewrite and hash `styles.css`. Returns the replacements map so phase
 * 3 can consume it.
 *
 * Split out so it can be awaited in a `Promise.all` with `runPagefind`
 * -- neither branch touches HTML, so they race on disjoint files.
 *
 * @returns basename → hashed-basename map covering every hashed asset
 *
 * @example
 * ```ts
 * const replacements = await fingerprintAssets();
 * ```
 */
async function fingerprintAssets(): Promise<Map<string, string>> {
  const replacements = await fingerprintLeafAssets({
    files: leafAssetFiles,
  },);
  l.info(`phase 1: fingerprinted ${replacements.size} leaf assets`,);

  await fingerprintCss({
    distDir: DIST,
    replacements,
  },);
  l.info('phase 2: fingerprinted CSS',);

  return replacements;
}

/**
 * Phases 1+2 (fingerprint leaf assets + CSS) run in parallel with
 * pagefind. Phase 3 (HTML rewrite) is sequenced strictly after both
 * because it modifies the same HTML files pagefind is reading.
 */
const [replacements,] = await Promise.all([
  fingerprintAssets(),
  runPagefind({ distDir: DIST, },),
],);

await rewriteReferences({
  distDir: DIST,
  replacements,
},);
l.info('phase 3: rewrote references',);

l.info(`done: ${replacements.size} assets fingerprinted`,);

//endregion Main pipeline
