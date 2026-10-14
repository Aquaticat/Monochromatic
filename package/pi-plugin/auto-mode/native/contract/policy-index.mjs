import { createHash } from 'node:crypto';

/** Structural admission failures retain their category without inventing an instruction interpretation. */
export class PolicyIndexError extends Error {
  constructor({
    code,
    message
  }) {
    super(message);
    this.name = 'PolicyIndexError';
    this.code = code;
  }
}

/** Preserve source positions from the incumbent parser rather than searching rendered text. */
function sourceSpan({
  node,
  source
}) {
  /** Positions are required for every indexed or unclassified top-level node. */
  const start = node.position
    ?.start
    ?.offset;
  /** End is exclusive in the parser's UTF-16 source representation. */
  const end = node.position
    ?.end
    ?.offset;
  if ((!Number.isSafeInteger(start)) || (!Number.isSafeInteger(end))
    || (start < 0)
    || (end <= start)
    || (end > source.length)) {
    throw new PolicyIndexError({
      code: 'source-span',
      message: `Missing or invalid source span for ${node.type}`
    });
  }
  return {
    start,
    end,
    text: source.slice(
      start,
      end
    )
  };
}

/** Admit only the literal project tag format; this assigns no instruction authority. */
function literalCode(text) {
  /** Project instruction tags occupy exactly three ASCII uppercase/digit characters. */
  const width = 3;
  if ((text.length <= (width
    + 1)) || (text[width] !== ':')
    || (![
      ' ',
      '\t',
      '\r',
      '\n'
    ].includes(text[width + 1]))) return undefined;
  /** Constant-width lexical check does not interpret Markdown or instruction meaning. */
  const candidate = text.slice(
    0,
    width
  );
  return [...candidate].every(character => ((character >= 'A') && (character <= 'Z')) || ((character >= '0') && (character <= '9')))
    ? candidate
    : undefined;
}

/** Index top-level tagged policy paragraphs while preserving headings and all unclassified nodes. */
export function indexPolicyDocument({
  source,
  parse
}) {
  /** Use the existing repository parser, including its astral offset correction. */
  const tree = parse({
    source,
    mdx: false
  });
  if (tree.type !== 'root') throw new PolicyIndexError({
    code: 'root-node',
    message: 'Markdown parser did not return a root'
  });
  /** Mutable owned accumulation avoids rebuilding arrays during this single top-level traversal. */
  const state = {
    headingStack: [],
    headings: [],
    records: [],
    unclassified: []
  };
  /** Duplicate handles must not silently overwrite an earlier source interval. */
  const seen = new Set();
  for (const node of tree.children) {
    /** Even unsupported nodes retain their exact raw source interval. */
    const span = sourceSpan({
      node,
      source
    });
    if (node.type === 'heading') {
      /** Heading structure is recorded, not interpreted as authority or applicability. */
      const heading = {
        ...span,
        depth: node.depth
      };
      state.headingStack = [
        ...state.headingStack
          .filter(parent => parent.depth < node.depth),
        heading
      ];
      state.headings
        .push(heading);
      continue;
    }
    /** Formatting, quotations and fenced examples cannot impersonate the admitted literal prefix. */
    const code = node.type === 'paragraph' ? literalCode(span.text) : undefined;
    if (code === undefined) {
      state.unclassified
        .push({
          ...span,
          type: node.type,
          headings: [...state.headingStack]
        });
      continue;
    }
    if (seen.has(code)) throw new PolicyIndexError({
      code: 'duplicate-code',
      message: `Duplicate policy handle: ${code}`
    });
    seen.add(code);
    state.records
      .push({
        ...span,
        code,
        headings: [...state.headingStack]
      });
  }
  return {
    sourceSha256: createHash('sha256')
      .update(source)
      .digest('hex'),
    sourceBytes: Buffer.byteLength(source),
    headings: state.headings,
    records: state.records,
    unclassified: state.unclassified,
    structuralCoverage: state.unclassified
      .length
      === 0 ? 'all-top-level-nodes-indexed' : 'unclassified-nodes-retained',
    semanticCoverage: 'not-established',
    authorityEstablishedByIndex: false,
  };
}
