/**
 Structural policy indexing retains complete original source intervals and unclassified nodes.
 @module
 */
import { createHash } from 'node:crypto';
import type {MdastNode} from 'satteri';
import type {
  IndexedPolicyRule,
  PolicyHeading,
  PolicyIndex,
  PolicyIndexInput,
  PolicySourceSpan,
  UnclassifiedPolicyNode
} from './policy-index-types.ts';

//region Structural admission preserves original diagnostics and coordinates.
/** Structural admission failures retain their category without inventing an instruction interpretation. */
export class PolicyIndexError extends Error {
  /** Original structural index error category. */
  override readonly name='PolicyIndexError';
  /** Exact failed index invariant. */
  readonly code:string;
  /**
   Preserve original structural diagnostic and invariant identifier.
   @param code - failed original index invariant
   @param message - diagnostic explaining the missing or invalid structure
   */
  constructor({
    code,
    message
  }:{readonly code:string;readonly message:string}) {
    super(message);
    this.code = code;
  }
}

/**
 Preserve source positions from the incumbent parser rather than searching rendered text.
 @param node - original parser node with source positions
 @param source - complete original text
 @returns exact original source interval
 @throws PolicyIndexError when source offsets are absent or invalid
 */
function sourceSpan({
  node,
  source
}:{readonly node:MdastNode;readonly source:string}):PolicySourceSpan {
  /** Positions are required for every indexed or unclassified top-level node. */
  const start = node.position
    ?.start
    ?.offset;
  /** End is exclusive in the parser's UTF-16 source representation. */
  const end = node.position
    ?.end
    ?.offset;
  if ((typeof start!=='number')||(typeof end!=='number')
    ||(!Number.isSafeInteger(start)) || (!Number.isSafeInteger(end))
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

/** Fixed source tag width, independent of semantic rule meaning. */
const codeWidth=3;
/**
 Admit only the literal project tag format; this assigns no instruction authority.
 @param text - exact original paragraph text
 @returns whether the paragraph starts with the admitted source tag spelling
 */
function hasLiteralCodePrefix(text:string):boolean {
  /** Project instruction tags occupy exactly three ASCII uppercase/digit characters. */
  const width = codeWidth;
  if ((text.length <= (width
    + 1)) || (text[width] !== ':')
    || (![
      ' ',
      '\t',
      '\r',
      '\n'
    ].includes(text.charAt(width + 1)))) return false;
  /** Constant-width lexical check does not interpret Markdown or instruction meaning. */
  const candidate = text.slice(
    0,
    width
  );
  return [...candidate].every(function isInstructionCodeCharacter(character) { return ( ((character >= 'A') && (character <= 'Z')) || ((character >= '0') && (character <= '9'))); });
}
//endregion

//region Original source order retains headings, paragraphs, and every unclassified node.
/**
 Index top-level tagged policy paragraphs while preserving headings and all unclassified nodes.
 @param source - complete original policy text
 @param parse - incumbent Markdown parser retaining source offsets
 @returns structural index without authority or semantic qualification
 @throws PolicyIndexError when parser structure, source offsets, or unique tag membership fail
 @example
 ```ts
 const index = indexPolicyDocument({ source, parse: parser.parse });
 ```
 */
export function indexPolicyDocument({
  source,
  parse
}:PolicyIndexInput):PolicyIndex {
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
  const state:{
    headingStack:PolicyHeading[];
    readonly headings:PolicyHeading[];
    readonly records:IndexedPolicyRule[];
    readonly unclassified:UnclassifiedPolicyNode[];
  } = {
    headingStack: [],
    headings: [],
    records: [],
    unclassified: []
  };
  /** Duplicate handles must not silently overwrite an earlier source interval. */
  const seen = new Set<string>();
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
          .filter(function isParentHeading(parent) { return ( parent.depth < node.depth); }),
        heading
      ];
      state.headings
        .push(heading);
      continue;
    }
    // Formatting, quotations and fenced examples cannot impersonate the admitted literal prefix.
    if ((node.type!=='paragraph')||(!hasLiteralCodePrefix(span.text))) {
      state.unclassified
        .push({
          ...span,
          type: node.type,
          headings: [...state.headingStack]
        });
      continue;
    }
    /** Only the admitted literal prefix contributes a tag identity. */
    const code=span.text.slice(0,codeWidth);
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
//endregion
