import type { UnknownRecord, } from 'type-fest';

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

export type PlainJsonBase = {
  json: UnknownRecord;
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

export type $ = Value;

// Narrowed variant aliases for ergonomic typing of specific JSONC node kinds
export type String = StringBase & ValueBase;
export type Number = NumberBase & ValueBase;
export type Boolean = BooleanBase & ValueBase;
export type Null = NullBase & ValueBase;
export type Array = ArrayBase & ValueBase;
export type Record = RecordBase & ValueBase;
export type PlainJson = PlainJsonBase & ValueBase;
