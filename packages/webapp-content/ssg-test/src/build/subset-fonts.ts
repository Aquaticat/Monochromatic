/**
 * Source-driven font subsetting stage (format task, not in build chain).
 *
 * Reads the full upstream woff2 files from `fonts-source/`, collects the
 * charset from every source file under `src/` (TypeScript, MDX, Markdown)
 * plus a printable-ASCII safety floor, subsets each font, and writes the
 * result to `public/` where `build:site` picks it up as a static asset.
 *
 * Not part of `build`. Run via `mise run format:fonts` whenever:
 *
 * - you add an `icon('...')` call for a new Material Symbols icon
 * - you add non-ASCII characters (e.g. CJK glyphs) to MDX content or i18n
 *   strings that need to render in Inter / Inter Italic
 * - you update a source font in `fonts-source/` (e.g. refresh Monaspace Neon)
 *
 * Subsetting ~5 s so it is not worth re-running on every build. The
 * subsetted `public/*.woff2` files are committed alongside source and
 * are the canonical artifacts the site ships.
 *
 * Variable font axes are preserved (no `variationAxes` option) so the
 * CSS `font-weight: 100 900` / `100 700` declarations keep working.
 *
 * Run via `mise run format:fonts` or `bun src/build/subset-fonts.ts`.
 */
import {
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { fileURLToPath, } from 'node:url';

import {
  initPromise,
  logger,
} from '@monochromatic-dev/module-logger/logger';
import { tagged, } from '@monochromatic-dev/module-logger/tagged';
import {
  init as initSubset,
  subset,
} from 'hb-subset-wasm';
import wawoff2 from 'wawoff2';
import {
  encode as encodeWoff2,
  init as initWoff2,
} from 'woff2-encode-wasm';
import readdir from 'tiny-readdir-glob';

import { ICON_CODEPOINTS, } from '../lib/icons/codepoints.ts';

export {}; // module boundary marker

await initPromise;

/** Tagged logger for the subset-fonts pipeline. */
const l = tagged({
  tag: 'subset-fonts',
  l: logger,
},);

//region Wasm initialization

/**
 * Loads both wasm modules in parallel.
 *
 * `hb-subset-wasm` performs SFNT subsetting; `woff2-encode-wasm` re-encodes
 * the subsetted SFNT back to WOFF2. WOFF2 → SFNT decoding is delegated to
 * `wawoff2` (no init needed; it lazy-loads its own wasm on first call).
 *
 * Each wasm module holds shared linear memory and a single allocator, so all
 * subsequent calls into a given module share one heap. JS's single-threaded
 * event loop keeps individual calls atomic because the call bodies contain no
 * `await` points after `getWasm()` returns; concurrent `Promise.all` calls
 * therefore cannot interleave mid-allocation.
 */
await Promise.all([
  initSubset(
    await readFile(
      fileURLToPath(import.meta.resolve('hb-subset-wasm/hb-subset.wasm',),),
    ),
  ),
  initWoff2(
    await readFile(
      fileURLToPath(import.meta.resolve('woff2-encode-wasm/encoder.wasm',),),
    ),
  ),
],);

//endregion

/** Source files scanned for every charset pass. */
const SOURCE_GLOB = 'src/**/*.{ts,mdx,md}';

/** Directory holding full upstream woff2 sources (committed, not copied to dist). */
const SOURCE_FONTS_DIR = 'fonts-source';

/** Directory holding the subsetted woff2 artifacts that `build:site` copies to `dist/`. */
const OUTPUT_FONTS_DIR = 'public';

/** Lowest printable ASCII code point (space). */
const ASCII_PRINTABLE_MIN = 0x20;

/** Highest printable ASCII code point (tilde). */
const ASCII_PRINTABLE_MAX = 0x7E;

/**
 * Matches an `icon('NAME')` or `icon("NAME")` call site in source.
 *
 * Components resolve Material Symbols icons via the `icon(name)` helper
 * (`src/lib/icons/icon.ts`). Call arguments must be string literals,
 * never variables, so this regex can enumerate the exact set of icons
 * in use. The match group is the bare icon name.
 */
const ICON_CALL_REGEX = /\bicon\(\s*['"]([a-z][a-z0-9_]*)['"]\s*,?\s*\)/g;

/** Matches `/* ... *\/` block comments (non-greedy). */
const BLOCK_COMMENT_REGEX = /\/\*[\s\S]*?\*\//g;

/** Matches `// ...` line comments up to end of line. */
const LINE_COMMENT_REGEX = /\/\/[^\n]*/g;

//region Charset extraction

/**
 * Builds the full-source charset used to subset body / code fonts.
 *
 * Seeds the set with printable ASCII so runtime-rendered strings that
 * do not appear verbatim in any source file still render. Then adds
 * every code point found in every source file under `SOURCE_GLOB`.
 *
 * TypeScript syntax noise (operators, identifiers, keywords) is all
 * ASCII and therefore free under the seed. Non-ASCII code points
 * come exclusively from string literals and MDX prose, which is
 * exactly what must render.
 *
 * This is **not** used for Material Symbols because passing every
 * ASCII letter to a ligature-based icon font triggers harfbuzz's
 * layout closure to retain every icon ligature formable from those
 * letters, i.e. almost the entire font. See {@link collectIconLigatures}.
 *
 * @param sourceFiles - pre-scanned list of source file paths
 *
 * @returns single string with one instance of every code point to retain
 *
 * @example
 * ```ts
 * const text = await collectBodyCharset({ sourceFiles });
 * ```
 */
async function collectBodyCharset(
  { sourceFiles, }: { sourceFiles: readonly string[]; },
): Promise<string> {
  const chars = new Set<string>();

  for (let cp = ASCII_PRINTABLE_MIN; cp <= ASCII_PRINTABLE_MAX; cp += 1)
    chars.add(String.fromCodePoint(cp,),);

  await Promise.all(sourceFiles.map(async function scanFile(filePath,) {
    const text = await readFile(
      filePath,
      'utf8',
    );
    for (const ch of text)
      chars.add(ch,);
  },),);

  return [...chars,].join('',);
}

/**
 * Builds the Material Symbols charset as a concatenation of PUA codepoints.
 *
 * Scans every source file for `icon('NAME')` call sites, resolves each
 * captured name against {@link ICON_CODEPOINTS} (the upstream codepoints
 * table), and joins the resulting single-codepoint strings. Components
 * render icons by emitting these PUA codepoints directly, so the font
 * is only asked for the exact glyphs that appear in output HTML.
 *
 * This avoids harfbuzz's layout closure entirely: with PUA codepoints
 * as input (rather than ligature letter inputs), no icon ligatures are
 * reachable through GSUB closure, so none are over-retained.
 *
 * Unknown icon names are fatal: a typo in `icon('foo')` should fail
 * the build rather than silently ship a font missing the glyph.
 *
 * @param sourceFiles - pre-scanned list of source file paths
 *
 * @returns string of concatenated PUA codepoints, one per distinct icon
 *
 * @throws when an `icon('NAME')` call references an unknown icon
 *
 * @example
 * ```ts
 * const text = await collectIconCodepoints({ sourceFiles });
 * // '\ue88e\ue891\ue90f\ue645\uf052\ue8b6\uf083' (7 icons, 7 codepoints)
 * ```
 */
async function collectIconCodepoints(
  { sourceFiles, }: { sourceFiles: readonly string[]; },
): Promise<string> {
  const names = new Set<string>();

  await Promise.all(sourceFiles.map(async function scanForIconCalls(filePath,) {
    const text = await readFile(
      filePath,
      'utf8',
    );
    const stripped = text
      .replaceAll(
        BLOCK_COMMENT_REGEX,
        '',
      )
      .replaceAll(
        LINE_COMMENT_REGEX,
        '',
      );
    for (const match of stripped.matchAll(ICON_CALL_REGEX,)) {
      const [, captured,] = match;
      if (captured !== undefined)
        names.add(captured,);
    }
  },),);

  const codepoints: string[] = [];
  for (const name of names) {
    const codepoint = ICON_CODEPOINTS[name];
    if (codepoint === undefined) {
      throw new Error(
        `icon('${name}') references a name not present in Material Symbols codepoints data`,
      );
    }
    codepoints.push(codepoint,);
  }

  l.info(`icons in use: ${[...names,].toSorted().join(', ',)}`,);

  return codepoints.join('',);
}

//endregion

//region Targets

/** Map from font basename to the function that builds its charset. */
const FONT_CHARSET_BUILDERS: Record<
  string,
  (args: { sourceFiles: readonly string[]; },) => Promise<string>
> = {
  'inter.woff2': collectBodyCharset,
  'interItalic.woff2': collectBodyCharset,
  'monaspaceNeon.woff2': collectBodyCharset,
  'materialSymbols.woff2': collectIconCodepoints,
};

//endregion

//region Font subsetting

/**
 * Subsets one woff2: reads from `fonts-source/`, writes subsetted bytes to `public/`.
 *
 * @param basename - file name (no directory component)
 *
 * @param text - per-font charset string
 *
 * @example
 * ```ts
 * await subsetOne({ basename: 'inter.woff2', text });
 * ```
 */
async function subsetOne(
  {
    basename,
    text,
  }: {
    basename: string;
    text: string;
  },
): Promise<void> {
  const inputPath = join(
    SOURCE_FONTS_DIR,
    basename,
  );
  const outputPath = join(
    OUTPUT_FONTS_DIR,
    basename,
  );

  let input: Buffer = Buffer.alloc(0,);
  try {
    input = await readFile(inputPath,);
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(
        `${inputPath} not found. Place the full upstream woff2 in ${SOURCE_FONTS_DIR}/ before running format:fonts.`,
        { cause: error, },
      );
    }
    throw error;
  }

  const before = input.byteLength;

  /**
   * WOFF2 → SFNT decode. `wawoff2.decompress` returns a `Buffer`-like
   * `Uint8Array` containing the original TrueType/OpenType bytes that
   * `hb_face_create` can read.
   */
  const sfntInput = await wawoff2.decompress(input,);

  /**
   * SFNT subset. `layoutFeatures: '*'` retains every GSUB/GPOS layout
   * feature, matching the prior `subset-font` default (it called
   * `hb_set_clear` + `hb_set_invert` on the layout-feature set).
   */
  const sfntSubset = await subset(
    sfntInput,
    {
      text,
      layoutFeatures: '*',
    },
  );

  /**
   * SFNT → WOFF2 re-encode. `woff2-encode-wasm` compresses using Google's
   * official woff2 + brotli wasm build, with a `wOF2` signature sanity
   * check on the result.
   */
  const output = await encodeWoff2(sfntSubset,);
  const after = output.byteLength;

  await writeFile(
    outputPath,
    output,
  );

  const savedPercent = Math.round((1 - after / before) * 100,);
  l.info(
    `${basename}: ${before} → ${after} bytes (−${savedPercent}%)`,
  );
}

//endregion

//region Main pipeline

l.info('starting',);

/** Result of scanning the source glob (file list, directory list, etc.). */
const scan = await readdir(SOURCE_GLOB,);
/** Source file paths discovered by the scan, used as input for charset extraction. */
const sourceFiles = scan.files;
l.info(`scanning ${sourceFiles.length} source files`,);

await Promise.all(
  Object.entries(FONT_CHARSET_BUILDERS,).map(
    async function subsetTarget([basename, buildCharset,],) {
      const text = await buildCharset({ sourceFiles, },);
      return subsetOne({
        basename,
        text,
      },);
    },
  ),
);

l.info('done',);

//endregion
