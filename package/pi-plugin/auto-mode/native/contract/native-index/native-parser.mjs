import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Private parser admission failures are distinct from instruction semantics. */
export class NativePolicyParserError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NativePolicyParserError';
  }
}

/** Use the existing dependency without the repository's obsolete code-point correction. */
export async function createNativeMarkdownParser({ repositoryRoot, expectedVersion }) {
  /** Resolve the declared private dependency after the historical linter owner was retired. */
  const ownerRequire = createRequire(import.meta.url);
  /** Package entry and metadata are measured before invoking the parser. */
  const entry = ownerRequire.resolve('satteri');
  const packagePath = join(dirname(entry), '../package.json');
  const packageMetadata = JSON.parse(readFileSync(packagePath, 'utf8'));
  assert.equal(packageMetadata.name, 'satteri');
  assert.equal(packageMetadata.version, expectedVersion, 'Unqualified parser version');
  /** This source epoch deliberately admits only the directly measured version, not all future catalogue matches. */
  assert.equal(expectedVersion, '0.10.5', 'This private adapter has only been scoped to 0.10.5');
  /** Actual installed parser function; no new dependency is installed. */
  const { markdownToMdast } = await import(pathToFileURL(entry).href);
  /** Flags match the repository wrapper's Markdown path. */
  const features = Object.freeze({ gfm: true, frontmatter: true });
  /** Markdown-only interface prevents an untested MDX path from being silently accepted. */
  function parse({ source, mdx }) {
    if (mdx !== false) throw new NativePolicyParserError('MDX is outside this private parser qualification');
    const tree = markdownToMdast(source, { features });
    if (tree.type !== 'root') throw new NativePolicyParserError('Native parser did not return a root');
    return tree;
  }
  /** A fixed coordinate self-check validates behavior, not only the package label. */
  const source = '\u{1f680}\n\nx\n';
  const tree = parse({ source, mdx: false });
  const target = tree.children.find(node => node.type === 'paragraph' && node.children?.some(child => child.type === 'text' && child.value === 'x'));
  assert(target, 'Missing coordinate self-check target');
  assert.equal(target.position.start.offset, source.indexOf('x'));
  assert.equal(source.slice(target.position.start.offset, target.position.end.offset), 'x');
  return {
    parse,
    metadata: {
      package: `${packageMetadata.name}@${packageMetadata.version}`,
      entry,
      entrySha256: createHash('sha256').update(readFileSync(entry)).digest('hex'),
      packageSha256: createHash('sha256').update(readFileSync(packagePath)).digest('hex'),
      features,
      observedCoordinateUnit: 'UTF16-code-units',
      extraCorrectionApplied: false,
      scope: 'Measured Markdown adapter; no MDX/visitor/future-version or native binary provenance attestation',
    },
  };
}
