/**
 * Emit a {@link TomlEditState} to TOML text by walking its block tree.
 *
 * A clean node emits its original bytes verbatim (`source.slice(range)`); a
 * value-only-edited key-value reuses the exact key prefix and trailing bytes
 * and re-renders just the value; a synthetic node renders canonically. Fillers
 * always emit verbatim, so a fully-clean document round-trips byte-for-byte.
 *
 * @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import type {
  Block,
  KeyValueNode,
  TableNode,
} from './document.ts';
import { renderValueNode, } from './emit-value-node.ts';
import { encodeKey, } from './keys.ts';
import type { TomlEditState, } from './types.ts';

/**
 * Emit the full document text for `edit`.
 *
 * @returns Output TOML text.
 *
 * @example
 * ```ts
 * emitDocument({ edit, },);
 * ```
 */
export function emitDocument({ edit, }: { readonly edit: TomlEditState; },): string {
  /**
   * Optional header comment block for {@link emptyTomlEdit}-derived documents.
   */
  const header = (edit.headerComment === undefined) || (edit.headerComment
    === '')
    ? ''
    : renderHeaderComment({ headerComment: edit.headerComment, },);
  /**
   * Concatenated block text; the ordered blocks partition the source.
   */
  const body = emitBlocks({
    blocks: edit.blocks,
    edit,
  },);
  /**
   * Combined output before the synthetic-document trailing-newline fixup.
   */
  const result = `${header}${body}`;
  if (
    (edit.source
      === '')
      && edit.canonical
      .trailingNewline
      && (result !== '')
      && (!result.endsWith('\n',))
  )
    return `${result}\n`;
  return result;
}

/**
 * Render a header comment as `# line` rows plus a trailing blank line.
 *
 * @returns Computed string.
 */
function renderHeaderComment(
  { headerComment, }: { readonly headerComment: string; },
): string {
  return `${
    headerComment
      .split('\n',)
      .map(function each(line,) {
        return `# ${line}\n`;
      },)
      .join('',)
  }\n`;
}

/**
 * Concatenate the emitted text of an ordered block list.
 *
 * @returns Computed string.
 */
function emitBlocks(
  {
    blocks,
    edit,
  }: {
    readonly blocks: readonly Block[];
    readonly edit: TomlEditState;
  },
): string {
  return blocks
    .map(function each(block,) {
      if (block.kind
        === 'filler')
        return block.text;
      if (block.kind
        === 'keyvalue')
        return emitKeyValue({
          kv: block,
          edit,
        },);
      return emitTable({
        table: block,
        edit,
      },);
    },)
    .join('',);
}

/**
 * Emit one key-value block.
 *
 * @returns Computed string.
 */
function emitKeyValue(
  {
    kv,
    edit,
  }: {
    readonly kv: KeyValueNode;
    readonly edit: TomlEditState;
  },
): string {
  return appendTrailing({
    base: emitKeyValueBase({
      kv,
      edit,
    },),
    ...(kv.trailingCommentAppend === undefined
      ? {}
      : { append: kv.trailingCommentAppend, }),
  },);
}

/**
 * Emit the key-value line without any inserted trailing comment.
 *
 * @returns Computed string.
 */
function emitKeyValueBase(
  {
    kv,
    edit,
  }: {
    readonly kv: KeyValueNode;
    readonly edit: TomlEditState;
  },
): string {
  if (kv.origin
    .kind
    === 'synthetic')
    return emitSyntheticKeyValue({
      kv,
      edit,
    },);
  if (kv.value
    .origin
    .kind
    === 'clean') {
    return edit.source
      .slice(
      kv.origin
        .range[0],
      kv.origin
        .range[1],
    );
  }
  /**
   * Original value span so the key prefix and trailing bytes stay byte-exact.
   */
  const valueRange = nonNullishOrThrow(kv.valueRange,);
  /**
   * Exact `key = ` prefix (indent handled by the preceding filler).
   */
  const prefix = edit.source
    .slice(
    kv.origin
      .range[0],
    valueRange[0],
  );
  /**
   * Trailing bytes: any spaces, a same-line comment, and the newline.
   */
  const suffix = edit.source
    .slice(
    valueRange[1],
    kv.origin
      .range[1],
  );
  return `${prefix}${
    renderValueNode({
      value: kv.value,
      options: edit.canonical,
      depth: 0,
    },)
  }${suffix}`;
}

/**
 * Splice an inserted trailing comment before the line's final newline.
 *
 * @returns Computed string.
 */
function appendTrailing(
  {
    base,
    append,
  }: {
    readonly base: string;
    readonly append?: string;
  },
): string {
  if (append === undefined)
    return base;
  if (base.endsWith('\n',))
    return `${base.slice(
      0,
      -1,
    )}${append}\n`;
  return `${base}${append}`;
}

/**
 * Emit a created (synthetic) key-value as a canonical line with its comments.
 *
 * @returns Computed string.
 */
function emitSyntheticKeyValue(
  {
    kv,
    edit,
  }: {
    readonly kv: KeyValueNode;
    readonly edit: TomlEditState;
  },
): string {
  /**
   * Leading attached comment lines rendered above the entry.
   */
  const before = kv.commentsBefore
    .map(function each(c,) {
      return `#${c}\n`;
    },)
    .join('',);
  /**
   * Encoded dotted key spelling.
   */
  const keyText = kv.keySegments
    .map(function eachSeg(seg,) {
      return encodeKey({ key: seg, },);
    },)
    .join('.',);
  /**
   * Trailing inline comment, when the entry carries one.
   */
  const after = kv.commentAfter === undefined ? '' : `  #${kv.commentAfter}`;
  return `${before}${keyText} = ${
    renderValueNode({
      value: kv.value,
      options: edit.canonical,
      depth: 0,
    },)
  }${after}\n`;
}

/**
 * Emit a table section: header then its body blocks.
 *
 * @returns Computed string.
 */
function emitTable(
  {
    table,
    edit,
  }: {
    readonly table: TableNode;
    readonly edit: TomlEditState;
  },
): string {
  /**
   * Body text follows the header regardless of the header's provenance.
   */
  const body = emitBlocks({
    blocks: table.body,
    edit,
  },);
  if (table.headerOrigin
    .kind
    === 'clean') {
    return `${
      edit.source
        .slice(
        table.headerOrigin
          .range[0],
        table.headerOrigin
          .range[1],
      )
    }${body}`;
  }
  /**
   * Leading attached comment lines above a created table header.
   */
  const before = table.commentsBefore
    .map(function each(c,) {
      return `#${c}\n`;
    },)
    .join('',);
  /**
   * Encoded dotted header path.
   */
  const seg = table.headerSegments
    .map(function eachSeg(s,) {
      return encodeKey({ key: String(s,), },);
    },)
    .join('.',);
  /**
   * Bracket form: `[[foo]]` for an array-of-tables instance, else `[foo]`.
   */
  const bracket = table.tableKind
    === 'array' ? `[[${seg}]]` : `[${seg}]`;
  /**
   * Trailing inline comment after the header, when present.
   */
  const after = table.commentAfter === undefined ? '' : `  #${table.commentAfter}`;
  return `${before}${bracket}${after}\n${body}`;
}
