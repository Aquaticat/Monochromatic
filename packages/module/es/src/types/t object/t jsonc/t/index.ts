import type { JsonValue, } from 'type-fest';

/** Branded string type for JSONC fragments (partial JSONC content). */
export type FragmentStringJsonc = string & { __brand: { jsonc: 'fragment'; }; };

/**
 * Comment attached to a JSONC value
 */
export type Comment = {
  /** Type of comment */
  type: 'inline' | 'block' | 'mixed';
  /** Untrimmed comment content without delimiters */
  commentValue: string;
};

/**
 * Base structure for all parsed JSONC values
 */
export type ValueBase = {
  /** Optional comment attached to this value */
  comment?: Comment;
};

/**
 * Parsed JSONC string value
 */
export type StringBase = {
  value: string;
};

/**
 * Parsed JSONC number value
 */
export type NumberBase = {
  value: number;
};

/**
 * Parsed JSONC boolean value
 */
export type BooleanBase = {
  value: boolean;
};

/**
 * Parsed JSONC null value
 */
export type NullBase = {
  value: null;
};

/**
 * Parsed JSONC array value
 */
export type ArrayBase = {
  value: Value[];
};

/**
 * Record key in a parsed JSONC object
 */
export type RecordKey = StringBase & ValueBase;

/**
 * Parsed JSONC object/record value
 */
export type RecordBase = { value: Map<RecordKey, Value>; };

/** Wrapper for plain JSON values that passed through without JSONC-specific parsing. */
export type PlainJsonBase = {
  json: JsonValue;
};

/**
 * Union of all possible parsed JSONC values
 */
export type Value =
  & (
    | StringBase
    | NumberBase
    | BooleanBase
    | NullBase
    | ArrayBase
    | RecordBase
    | PlainJsonBase
  )
  & ValueBase;

/** Union of all parsed JSONC value types. */
export type $ = Value;

/** Narrowed JSONC string node. */
export type String = StringBase & ValueBase;
/** Narrowed JSONC number node. */
export type Number = NumberBase & ValueBase;
/** Narrowed JSONC boolean node. */
export type Boolean = BooleanBase & ValueBase;
/** Narrowed JSONC null node. */
export type Null = NullBase & ValueBase;
/** Narrowed JSONC array node. */
export type Array = ArrayBase & ValueBase;
/** Narrowed JSONC record (object) node. */
export type Record = RecordBase & ValueBase;
/** Narrowed JSONC plain JSON node. */
export type PlainJson = PlainJsonBase & ValueBase;
