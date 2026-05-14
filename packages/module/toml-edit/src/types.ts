/**
 * Shared types for `@monochromatic-dev/module-toml-edit`.
 *
 * The state is immutable; the AST (from toml-eslint-parser) and the source
 * string are shared by reference across every derived state. Mutations
 * accumulate as entries in `edits`, `insertions`, and `deletions`, applied at
 * emit time.
 *
 * @module
 */

import type { AST, } from 'toml-eslint-parser';

/**
 * Path into a TOML document.
 *
 * String segments name keys (bare or quoted; both forms collapse to the same
 * raw string). Numeric segments index into arrays and into array-of-tables.
 *
 * @example
 * ```ts
 * const fruitsFirstName = ['fruits', 0, 'name',] as const satisfies TomlPath;
 * ```
 */
export type TomlPath = readonly (string | number)[];

/**
 * Fidelity mode.
 *
 * `'splice'`: original bytes are kept verbatim for unmutated regions; only
 * delta-marked nodes are re-emitted.
 *
 * `'canonical'`: every byte is produced by walking the AST. Supports a
 * synthesized fresh AST (no source) and produces output that matches the
 * configured `CanonicalOptions`.
 */
export type TomlEditMode = 'splice' | 'canonical';

/**
 * `Block`-typed comment node from toml-eslint-parser.
 *
 * The `type` field is always `'Block'` despite TOML having no block-comment
 * syntax; this mirrors the ESTree shape the parser implements.
 */
export type TomlComment = AST.Comment;

/**
 * Formatting options for canonical emission.
 *
 * Also consulted by splice mode when re-emitting a mutated node.
 */
export type CanonicalOptions = {
  readonly indent: number;
  readonly lineBreak: '\n' | '\r\n';
  readonly arrayInlineThreshold: number;
  readonly arrayInlineMaxColumns: number;
  readonly preferDottedKeysForCreate: boolean;
  readonly trailingNewline: boolean;
};

/**
 * Options for `parseTomlEdit`.
 */
export type TomlEditOptions = {
  readonly source: string;
  readonly mode?: TomlEditMode;
  readonly canonical?: Partial<CanonicalOptions>;
  readonly tomlVersion?: '1.0' | '1.1' | '1.0.0' | '1.1.0' | 'latest' | 'next';
};

/**
 * Options for `emptyTomlEdit`.
 */
export type TomlEmptyOptions = {
  readonly canonical?: Partial<CanonicalOptions>;
};

/**
 * A pending textual replacement on an AST node.
 *
 * `replace-value`: when keyed on a `TOMLKeyValue`, replaces just the value
 * bytes (`node.value.range`), preserving leading whitespace, `=`, and the
 * trailing inline comment. When keyed on a non-keyvalue node
 * (`TOMLArray`, `TOMLInlineTable`, etc.), replaces the node's entire
 * `range`. The fallthrough in `splice.ts:valueRangeOf` handles the
 * difference at emit time.
 *
 * `replace-keyvalue`: replaces the entire key-value line.
 *
 * `jsValue` carries the original JS input so that effective reads
 * (`tomlGetValue` on the same edit or a branched edit) reflect the pending
 * value without parsing the emitted `newText`.
 */
export type Edit =
  | {
    readonly kind: 'replace-value';
    readonly newText: string;
    readonly jsValue: unknown
  }
  | {
    readonly kind: 'replace-keyvalue';
    readonly newText: string;
    readonly jsValue: unknown
  };

/**
 * Where a pending `Insertion` should land at emit time.
 */
export type AnchorKind =
  | 'eof'
  | {
    readonly position: 'after-node';
    readonly node: AST.TOMLNode
  }
  | {
    readonly position: 'before-node';
    readonly node: AST.TOMLNode
  }
  | {
    readonly position: 'same-line-after';
    readonly node: AST.TOMLNode
  }
  | {
    readonly position: 'inside-table';
    readonly table: AST.TOMLTable | AST.TOMLTopLevelTable;
    readonly atEnd: true;
  };

/**
 * A pending insertion of fresh TOML text at a resolved position.
 *
 * `path` and `jsValue` are populated when the insertion came from
 * `tomlSet` so that effective reads see the new value before reparse.
 */
export type Insertion = {
  readonly anchor: AnchorKind;
  readonly text: string;
  readonly path?: TomlPath;
  readonly jsValue?: unknown;
};

/**
 * Immutable edit state.
 *
 * Returned by `parseTomlEdit`, `emptyTomlEdit`, and every mutating function.
 * The `program` AST and the `source` string are shared by reference;
 * `edits`, `insertions`, `deletions`, and the outer object are immutable.
 */
export type TomlEditState = {
  readonly source: string;
  readonly program: AST.TOMLProgram;
  readonly edits: ReadonlyMap<AST.TOMLNode, Edit>;
  readonly insertions: readonly Insertion[];
  readonly deletions: ReadonlySet<AST.TOMLNode>;
  readonly headerComment: string | null;
  readonly mode: TomlEditMode;
  readonly canonical: Readonly<CanonicalOptions>;
};

/**
 * Tagged value-input shape used to disambiguate JS-to-TOML coercion.
 *
 * Constructed via the factory functions in `./wrappers.ts`.
 */
export type TomlWrappedInput = {
  readonly tomlKind:
    | 'integer'
    | 'float'
    | 'local-date'
    | 'local-date-time'
    | 'local-time';
  readonly value: number | bigint | string;
};

/**
 * Accepted runtime shape for `tomlSet`.
 *
 * Runtime validation in `./values.ts` produces a `TOMLContentNode`-equivalent
 * payload; the static type stays `unknown` to avoid restricting the recursive
 * shape past the point of usefulness.
 */
export type TomlValueInput = unknown;

/**
 * Default canonical-mode options.
 *
 * Mode is `'splice'` for `parseTomlEdit`; `emptyTomlEdit` forces
 * `'canonical'` since there is no source to splice.
 */
export const DEFAULT_CANONICAL_OPTIONS: CanonicalOptions = Object.freeze({
  indent: 2,
  lineBreak: '\n',
  arrayInlineThreshold: 4,
  arrayInlineMaxColumns: 80,
  preferDottedKeysForCreate: false,
  trailingNewline: true,
},);
