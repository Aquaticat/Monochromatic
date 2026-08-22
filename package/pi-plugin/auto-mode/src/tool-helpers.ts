/**
 * ToolCallEvent introspection helpers.
 *
 * Adapters between pi-coding-agent's `ToolCallEvent` discriminated
 * union and the strings the rest of auto-mode uses:
 * - `extractToolText`: pull the textual payload out of write/edit.
 * - `getFilePath`: pull the path out of read/write/edit/grep.
 * - `describeAction`: render a short human description used in
 *   judge prompts and trust prompts.
 * - `isRelevantTool`: predicate for circumvention re-flagging.
 *
 * @module
 */

import { createHash, } from 'node:crypto';

import type { ToolCallEvent, } from '@earendil-works/pi-coding-agent';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { RELEVANT_TOOLS, } from './constants.ts';
import {
  isBashToolEvent,
  isEditToolEvent,
  isFindToolEvent,
  isGrepToolEvent,
  isLsToolEvent,
  isReadToolEvent,
  isWriteToolEvent,
} from './tool-event.ts';

/**
 * Hash algorithm used for approval fingerprints.
 */
const APPROVAL_FINGERPRINT_HASH_ALGORITHM = 'sha256';

/**
 * Digest encoding used for approval fingerprints.
 */
const APPROVAL_FINGERPRINT_HASH_ENCODING = 'hex';

/**
 * Width of JSON Unicode escape in hexadecimal digits.
 */
const JSON_UNICODE_ESCAPE_WIDTH = 4;

/**
 * First UTF-16 high-surrogate code unit.
 */
const HIGH_SURROGATE_START = 0xD8_00;

/**
 * Last UTF-16 high-surrogate code unit.
 */
const HIGH_SURROGATE_END = 0xDB_FF;

/**
 * First UTF-16 low-surrogate code unit.
 */
const LOW_SURROGATE_START = 0xDC_00;

/**
 * Last UTF-16 low-surrogate code unit.
 */
const LOW_SURROGATE_END = 0xDF_FF;

/**
 * First non-control Unicode code unit.
 */
const CONTROL_CHARACTER_LIMIT = 0x20;

/**
 * Encode one UTF-16 code unit as JSON Unicode escape.
 *
 * @param codeUnit - UTF-16 code unit requiring escaping.
 *
 * @returns Six-character JSON escape.
 *
 * @example
 * ```typescript
 * jsonUnicodeEscape(0); // '\\u0000'
 * ```
 */
function jsonUnicodeEscape(codeUnit: number,): string {
  return `\\u${codeUnit
    .toString(16,)
    .padStart(
      JSON_UNICODE_ESCAPE_WIDTH,
      '0',
    )}`;
}

/**
 * Quote string using well-formed JSON escaping.
 *
 * Iteration preserves valid surrogate pairs and escapes lone surrogates so
 * output remains valid Unicode JSON.
 *
 * @param value - String value to quote.
 *
 * @returns JSON string token.
 *
 * @example
 * ```typescript
 * quoteJsonString('line\n'); // '"line\\n"'
 * ```
 */
function quoteJsonString(value: string,): string {
  /**
   * Encoded token segments, including surrounding quotes.
   */
  const segments: string[] = ['"',];
  for (let index = 0; index < value.length; index += 1) {
    /**
     * Current UTF-16 unit as string.
     */
    const unit = value.charAt(index,);
    if (unit === '"') {
      segments[segments.length] = String.raw`\"`;
      continue;
    }
    if (unit === '\\') {
      segments[segments.length] = String.raw`\\`;
      continue;
    }
    if (unit === '\b') {
      segments[segments.length] = String.raw`\b`;
      continue;
    }
    if (unit === '\t') {
      segments[segments.length] = String.raw`\t`;
      continue;
    }
    if (unit === '\n') {
      segments[segments.length] = String.raw`\n`;
      continue;
    }
    if (unit === '\f') {
      segments[segments.length] = String.raw`\f`;
      continue;
    }
    if (unit === '\r') {
      segments[segments.length] = String.raw`\r`;
      continue;
    }
    /**
     * Numeric UTF-16 code unit for control and surrogate handling.
     */
    // oxlint-disable-next-line unicorn/prefer-code-point -- Well-formed JSON escaping must identify unpaired UTF-16 surrogate code units.
    const codeUnit = value.charCodeAt(index,);
    if (codeUnit < CONTROL_CHARACTER_LIMIT) {
      segments[segments.length] = jsonUnicodeEscape(codeUnit,);
      continue;
    }
    if ((codeUnit >= HIGH_SURROGATE_START)
      && (codeUnit <= HIGH_SURROGATE_END)) {
      /**
       * Possible paired low surrogate immediately after current unit.
       */
      // oxlint-disable-next-line unicorn/prefer-code-point -- Pair validation needs following UTF-16 code unit rather than combined code point.
      const nextCodeUnit = value.charCodeAt(index + 1,);
      if ((nextCodeUnit >= LOW_SURROGATE_START)
        && (nextCodeUnit <= LOW_SURROGATE_END)) {
        segments[segments.length] = unit;
        segments[segments.length] = value.charAt(index + 1,);
        index += 1;
        continue;
      }
      segments[segments.length] = jsonUnicodeEscape(codeUnit,);
      continue;
    }
    if ((codeUnit >= LOW_SURROGATE_START)
      && (codeUnit <= LOW_SURROGATE_END)) {
      segments[segments.length] = jsonUnicodeEscape(codeUnit,);
      continue;
    }
    segments[segments.length] = unit;
  }
  segments[segments.length] = '"';
  return segments.join('',);
}

/**
 * Serialize JSON-compatible data with sorted object keys.
 *
 * Tool inputs arrive as JSON-compatible objects. Sorting object keys keeps the
 * approval fingerprint stable when semantically identical input objects have
 * different insertion order. `undefined` mirrors JSON.stringify semantics:
 * omitted in objects and encoded as `null` in arrays.
 *
 * @param value - JSON-compatible value to serialize
 *
 * @returns canonical JSON string
 *
 * @example
 * ```typescript
 * stableSerialize({ b: 2, a: 1 }); // '{"a":1,"b":2}'
 * ```
 */
function stableSerialize(
  value: unknown,
): string {
  if (Array.isArray(value,)) {
    /**
     * Canonical text for array items in source order.
     */
    const serializedItems: string[] = [];
    for (const item of value) {
      serializedItems[serializedItems.length] = item === undefined
        ? 'null'
        : stableSerialize(item,);
    }
    return `[${serializedItems.join(',',)}]`;
  }

  if (value === null)
    return 'null';
  if ((typeof value) === 'string')
    return quoteJsonString(value,);
  if ((typeof value) === 'number')
    return Number.isFinite(value,)
      ? String(value,)
      : 'null';
  if ((typeof value) === 'boolean')
    return value ? 'true' : 'false';
  if ((typeof value) !== 'object')
    return 'null';

  /**
   * Object value narrowed to JSON-like record for key sorting.
   */
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Tool inputs are JSON-compatible plain objects after arrays, null, and primitives are handled; this narrows values for Object.entries without changing runtime data.
  const record = value as Readonly<Record<string, unknown>>;
  /**
   * Entries sorted by key before recursive value serialization.
   */
  const sortedEntries = Object
    .entries(record,)
    .toSorted(function compareEntryKeys(
      leftEntry,
      rightEntry,
    ) {
      /**
       * Left object key.
       */
      const [leftKey,] = leftEntry;
      /**
       * Right object key.
       */
      const [rightKey,] = rightEntry;
      return leftKey.localeCompare(rightKey,);
    },);
  /**
   * Canonical JSON property texts, excluding undefined values.
   */
  const serializedEntries: string[] = [];
  for (const [entryKey, entryValue,] of sortedEntries) {
    if (entryValue !== undefined) {
      serializedEntries[serializedEntries.length] = `${quoteJsonString(entryKey,)}:${stableSerialize(entryValue,)}`;
    }
  }
  return `{${serializedEntries.join(',',)}}`;
}

/**
 * Build approval identity from tool call fields that change permission scope.
 *
 * Read calls intentionally use only `path`, so a user approval for one segment
 * of a file also covers later reads of another segment from the same path.
 * Mutating tools keep full input, so changed write or edit content needs a new
 * approval.
 *
 * @param event - tool call event being guarded
 *
 * @param cwd - current extension working directory
 *
 * @param projectContext - canonical loaded context affecting judge decision
 *
 * @returns serialized call identity for approval reuse
 *
 * @example
 * ```typescript
 * const identity = buildApprovalFingerprintIdentity({ event, cwd: '/repo' });
 * ```
 */
function buildApprovalFingerprintIdentity(
  {
    event,
    cwd,
    projectContext = '',
  }: {
    readonly event: ForeignBorrowed<ToolCallEvent>;
    readonly cwd: string;
    readonly projectContext?: string;
  },
): string {
  /** Context identity omitted when no context files loaded, preserving prior empty-context fingerprints. */
  const contextIdentity = projectContext === ''
    ? ''
    : `,"projectContext":${quoteJsonString(projectContext,)}`;
  if (isReadToolEvent(event,)) {
    return `{"cwd":${quoteJsonString(cwd,)},"input":${stableSerialize({
      path: event.input
        .path,
    },)}${contextIdentity},"toolName":${quoteJsonString(event.toolName,)}}`;
  }

  return `{"cwd":${quoteJsonString(cwd,)},"input":${stableSerialize(event.input,)}${contextIdentity},"toolName":${quoteJsonString(event.toolName,)}}`;
}

/**
 * Build a stable fingerprint for same-session approval reuse.
 *
 * Normalizes the call identity with {@link buildApprovalFingerprintIdentity}
 * and serializes it with {@link stableSerialize} before hashing.
 *
 * The fingerprint includes the tool name and current working directory. Read
 * calls include only read path, ignoring `offset` and `limit`, so repeated
 * reads of one file at different ranges reuse approval. Other tools include
 * full tool input. Loaded project context participates when present, preventing
 * reuse after context changes. Only digest is stored in session, so inputs and
 * context are compared without persisting their contents in custom entries.
 *
 * @param event - tool call event being guarded
 *
 * @param cwd - current extension working directory
 *
 * @param projectContext - canonical loaded context affecting judge decision
 *
 * @returns SHA-256 digest for guarded tool call and active context
 *
 * @example
 * ```typescript
 * const fingerprint = buildApprovalFingerprint({ event, cwd: '/repo' });
 * ```
 */
function buildApprovalFingerprint(
  {
    event,
    cwd,
    projectContext = '',
  }: {
    readonly event: ForeignBorrowed<ToolCallEvent>;
    readonly cwd: string;
    readonly projectContext?: string;
  },
): string {
  /**
   * Permission identity after per-tool normalization.
   */
  const serializedCall = buildApprovalFingerprintIdentity({
    event,
    cwd,
    projectContext,
  },);
  return createHash(APPROVAL_FINGERPRINT_HASH_ALGORITHM,)
    .update(serializedCall,)
    .digest(APPROVAL_FINGERPRINT_HASH_ENCODING,);
}

/**
 * Serialize complete untrusted JSON-compatible data for judge prompt.
 *
 * @param value - Request-only data to preserve.
 *
 * @returns Canonical JSON containing every data field.
 *
 * @example
 * ```typescript
 * serializeUntrustedDataForJudge({ role: 'user', content: 'Run tests.' });
 * ```
 */
function serializeUntrustedDataForJudge(value: unknown,): string {
  return stableSerialize(value,);
}

/**
 * Serialize complete judge-facing JSON-compatible tool input.
 *
 * @param value - Current tool input to preserve.
 *
 * @returns Canonical JSON containing every input field.
 *
 * @example
 * ```typescript
 * serializeToolInputForJudge({ path: 'src/index.ts', content: 'export {};\n' });
 * ```
 */
function serializeToolInputForJudge(value: unknown,): string {
  return serializeUntrustedDataForJudge(value,);
}

/**
 * Extract text content from a tool call event.
 *
 * @param event - the tool call event
 *
 * @returns text content from write/edit tools, or empty string for
 *   tools that carry no editable text
 *
 * @example
 * ```typescript
 * extractToolText(writeEvent); // "file contents"
 * ```
 */
function extractToolText(
  event: ForeignBorrowed<ToolCallEvent>,
): string {
  if (isWriteToolEvent(event,)) {
    return event.input
      .content;
  }
  if (isEditToolEvent(event,)) {
    /**
     * Replacement texts in edit order.
     */
    const newTexts: string[] = [];
    /**
     * Edit hunks from narrowed built-in input.
     */
    const { edits, } = event.input;
    for (const edit of edits) {
      newTexts[newTexts.length] = edit.newText;
    }
    return newTexts.join('\n',);
  }
  return '';
}

/**
 * Extract the file path from a tool call event.
 *
 * @param event - the tool call event
 *
 * @returns file path, or empty string if not a file-targeting tool
 *
 * @example
 * ```typescript
 * getFilePath(readEvent); // "/project/src/index.ts"
 * ```
 */
function getFilePath(
  event: ForeignBorrowed<ToolCallEvent>,
): string {
  if (isReadToolEvent(event,)) {
    return event.input
      .path;
  }
  if (isWriteToolEvent(event,)) {
    return event.input
      .path;
  }
  if (isEditToolEvent(event,)) {
    return event.input
      .path;
  }
  if (isGrepToolEvent(event,)) {
    return event.input
      .path
      ?? '';
  }
  return '';
}

/**
 * Describe the tool action for the judge.
 *
 * No signal/reason annotations; the judge forms its own assessment.
 *
 * @param event - the tool call event
 *
 * @returns a human-readable description of the action
 *
 * @example
 * ```typescript
 * describeAction(bashEvent); // "bash: sudo rm -rf /"
 * ```
 */
function describeAction(
  event: ForeignBorrowed<ToolCallEvent>,
): string {
  if (isBashToolEvent(event,)) {
    return `bash: ${event.input
      .command}`;
  }
  if (isReadToolEvent(event,)) {
    return `read ${event.input
      .path}`;
  }
  if (isWriteToolEvent(event,)) {
    return `write ${event.input
      .path}`;
  }
  if (isEditToolEvent(event,)) {
    return `edit ${event.input
      .path}`;
  }
  if (isGrepToolEvent(event,)) {
    return `grep ${event.input
      .path
      ?? ''}`;
  }
  if (isFindToolEvent(event,)) {
    return `find ${event.input
      .path
      ?? ''}`;
  }
  if (isLsToolEvent(event,)) {
    return `ls ${event.input
      .path
      ?? ''}`;
  }
  return event.toolName;
}

/**
 * Check if a tool could be used for circumvention.
 *
 * Checked after a denial: all relevant tools are re-flagged
 * to detect circumvention attempts across turn boundaries.
 *
 * @param event - the tool call event
 *
 * @returns `true` if the tool is relevant for circumvention detection
 *
 * @example
 * ```typescript
 * isRelevantTool(bashEvent); // true
 * isRelevantTool(mcpEvent); // false
 * ```
 */
function isRelevantTool(
  event: ForeignBorrowed<ToolCallEvent>,
): boolean {
  return RELEVANT_TOOLS.includes(event.toolName,);
}

export {
  buildApprovalFingerprint,
  describeAction,
  extractToolText,
  getFilePath,
  isRelevantTool,
  serializeToolInputForJudge,
  serializeUntrustedDataForJudge,
};
