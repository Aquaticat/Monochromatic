/**
 Qualify the installed Markdown parser before native policy indexing uses its original coordinates.

 @module
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type { NativeMarkdownParser, NativeMarkdownTree } from './native-parser-types.ts';

//region Installed source checks precede parser use

/**
 Parser admission failures remain distinct from instruction semantics.
 */
export class NativePolicyParserError extends Error {
  /**
   Identify the parser qualification boundary in diagnostics.
   */
  override readonly name = 'NativePolicyParserError';
}

/**
 Native parser diagnostics never include original policy text.
 */
const l = tagged({ tag: 'auto-mode-native-markdown-parser' });

/**
 Hash captured source bytes without rereading the measured file.

 @param bytes - original entry or manifest bytes

 @returns SHA-256 recorded with the parser metadata
 */
function sourceHash(bytes: Uint8Array): string {
  /**
   Source fingerprinting has its own diagnostic boundary.
   */
  const rl = tagged({ tag: sourceHash.name, l });
  rl.debug('hashing original parser source bytes');
  /**
   This build owns the hash state through its terminal digest.
   */
  const hash = createHash('sha256');
  hash.update(bytes);
  return hash.digest('hex');
}

/**
 Use the measured parser without the repository's obsolete code-point correction.

 @param expectedVersion - exact parser version required by this source epoch

 @returns parser retaining the measured Markdown-only contract and source metadata

 @throws NativePolicyParserError when installed identity, tree shape, or coordinates differ

 @example
 ```ts
 const parser = await createNativeMarkdownParser({ expectedVersion: '0.10.5' });
 parser.parse({ source: '# Policy', mdx: false });
 ```
 */
export async function createNativeMarkdownParser({ expectedVersion }: {
  readonly expectedVersion: string;
}): Promise<NativeMarkdownParser> {
  /**
   Qualification and later parse calls share this captured diagnostic context.
   */
  const rl = tagged({ tag: createNativeMarkdownParser.name, l });
  rl.debug(`qualifying installed Markdown parser: ${expectedVersion}`);
  /**
   Resolve the already declared dependency before loading its executable entry.
   */
  const ownerRequire = createRequire(import.meta.url);
  /**
   CommonJS and ESM must identify the same measured file.
   */
  const entry = ownerRequire.resolve('satteri');
  /**
   The installed manifest remains adjacent to the qualified dist directory.
   */
  const packagePath = join(dirname(entry), '../package.json');
  /**
   Manifest identity and hash describe the same captured bytes.
   */
  const packageBytes = await readFile(packagePath);
  /**
   JSON metadata remains unknown until its required identity fields are checked.
   */
  const packageMetadata: unknown = JSON.parse(packageBytes.toString('utf8'));
  if (typeof packageMetadata !== 'object' || packageMetadata === null || !('name' in packageMetadata)
    || packageMetadata.name !== 'satteri' || !('version' in packageMetadata)
    || packageMetadata.version !== expectedVersion) throw new NativePolicyParserError(`Installed parser manifest must identify satteri ${expectedVersion}: ${packagePath}`);
  if (expectedVersion !== '0.10.5') throw new NativePolicyParserError(`This native adapter is qualified only for satteri 0.10.5; requested ${expectedVersion}`);
  if (import.meta.resolve('satteri') !== pathToFileURL(entry).href) throw new NativePolicyParserError(`ESM parser resolution differs from the measured entry: ${entry}`);
  /**
   The installed export map selects the verified file while preserving declared return types.
   */
  const { markdownToMdast } = await import('satteri');
  /**
   Flags retain the measured Markdown extension profile.
   */
  const features = Object.freeze({ gfm: true, frontmatter: true });
  /**
   Parse only Markdown and keep original source offsets.

   @param source - original policy text

   @param mdx - explicit selection whose supported value is false

   @returns original Markdown root

   @throws NativePolicyParserError when MDX is requested or the parser returns another node kind
   */
  function parse({ source, mdx }: {
    readonly source: string;
    readonly mdx: boolean;
  }): NativeMarkdownTree {
    /**
     Parse diagnostics identify the operation without logging policy content.
     */
    const parseLog = tagged({ tag: parse.name, l: rl });
    if (mdx !== false) throw new NativePolicyParserError('MDX is outside this native parser qualification');
    parseLog.debug('parsing original Markdown policy text');
    /**
     The installed parser declares all Markdown node kinds, so root admission is checked.
     */
    const tree = markdownToMdast(source, { features });
    if (tree.type !== 'root') throw new NativePolicyParserError('Native parser did not return a root');
    return tree;
  }
  /**
   A non-BMP character makes code-point and UTF-16 offsets observably different.
   */
  const source = '\u{1F680}\n\nx\n';
  /**
   Exercise the same callback returned to the native policy index.
   */
  const tree = parse({ source, mdx: false });
  /**
   The later paragraph is the coordinate control target.
   */
  const target = tree.children.find(function isParserControlParagraph(node): boolean {
    return node.type === 'paragraph' && node.children.some(function isParserControlText(child): boolean {
      return child.type === 'text' && child.value === 'x';
    });
  });
  if (target?.position?.start.offset !== source.indexOf('x') || target.position.end.offset === undefined
    || source.slice(target.position.start.offset, target.position.end.offset) !== 'x') throw new NativePolicyParserError('Installed parser failed its UTF-16 coordinate control');
  rl.debug('verified installed Markdown parser identity and original coordinates');
  return {
    parse,
    metadata: {
      package: `satteri@${expectedVersion}`,
      entry,
      entrySha256: sourceHash(await readFile(entry)),
      packageSha256: sourceHash(packageBytes),
      features,
      observedCoordinateUnit: 'UTF16-code-units',
      extraCorrectionApplied: false,
      scope: 'Measured Markdown adapter; no MDX/visitor/future-version or native binary provenance attestation',
    },
  };
}

//endregion Installed source checks precede parser use
