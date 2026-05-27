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

import {
  isToolCallEventType,
  type ToolCallEvent,
} from '@earendil-works/pi-coding-agent';
import { RELEVANT_TOOLS, } from './constants.ts';

/** Hash algorithm used for approval fingerprints. */
const APPROVAL_FINGERPRINT_HASH_ALGORITHM = 'sha256';

/** Digest encoding used for approval fingerprints. */
const APPROVAL_FINGERPRINT_HASH_ENCODING = 'hex';

/**
 * Build a stable fingerprint for exact same-session approval reuse.
 *
 * The fingerprint includes the tool name, current working directory, and full
 * tool input. Only the digest is stored in the session, so write or edit
 * payloads are compared without persisting their contents in custom entries.
 *
 * @param event - tool call event being guarded
 *
 * @param cwd - current extension working directory
 *
 * @returns SHA-256 digest for the guarded tool call
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
  }: {
    readonly event: ToolCallEvent;
    readonly cwd: string;
  },
): string {
  /** Serialized call identity with canonical object key order. */
  const serializedCall = stableSerialize({
    cwd,
    input: event.input,
    toolName: event.toolName,
  },);
  return createHash(APPROVAL_FINGERPRINT_HASH_ALGORITHM,)
    .update(serializedCall,)
    .digest(APPROVAL_FINGERPRINT_HASH_ENCODING,);
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
    return `[${
      value
        .map(function serializeArrayItem(item,) {
          return item === undefined
            ? 'null'
            : stableSerialize(item,);
        },)
        .join(',',)
    }]`;
  }

  if ((value === null) || ((typeof value) !== 'object')) {
    return JSON.stringify(value,)
      ?? 'null';
  }

  /** Object value narrowed to JSON-like record for key sorting. */
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Tool inputs are JSON-compatible plain objects after arrays, null, and primitives are handled; this narrows values for Object.entries without changing runtime data.
  const record = value as Readonly<Record<string, unknown>>;
  return `{${
    Object
      .entries(record,)
      .filter(function keepsJsonObjectEntry(entry,) {
        /** Entry value tested against JSON.stringify object omission semantics. */
        const [, entryValue,] = entry;
        return entryValue !== undefined;
      },)
      .toSorted(function compareEntryKeys(
        leftEntry,
        rightEntry,
      ) {
        /** Left object key. */
        const [leftKey,] = leftEntry;
        /** Right object key. */
        const [rightKey,] = rightEntry;
        return leftKey.localeCompare(rightKey,);
      },)
      .map(function serializeObjectEntry(entry,) {
        /** Object key and value serialized into canonical key order. */
        const [entryKey, entryValue,] = entry;
        return `${JSON.stringify(entryKey,)}:${stableSerialize(entryValue,)}`;
      },)
      .join(',',)
  }}`;
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
  event: ToolCallEvent,
): string {
  if (isToolCallEventType(
    'write',
    event,
  )) {
    return event.input
      .content;
  }
  if (isToolCallEventType(
    'edit',
    event,
  )) {
    return event
      .input
      .edits
      .map(
        function extractNewText(e,) {
          return e.newText;
        },
      )
      .join('\n',);
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
  event: ToolCallEvent,
): string {
  if (isToolCallEventType(
    'read',
    event,
  )) {
    return event.input
      .path;
  }
  if (isToolCallEventType(
    'write',
    event,
  )) {
    return event.input
      .path;
  }
  if (isToolCallEventType(
    'edit',
    event,
  )) {
    return event.input
      .path;
  }
  if (isToolCallEventType(
    'grep',
    event,
  )) {
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
  event: ToolCallEvent,
): string {
  if (isToolCallEventType(
    'bash',
    event,
  )) {
    return `bash: ${event.input
      .command}`;
  }
  if (isToolCallEventType(
    'read',
    event,
  )) {
    return `read ${event.input
      .path}`;
  }
  if (isToolCallEventType(
    'write',
    event,
  )) {
    return `write ${event.input
      .path}`;
  }
  if (isToolCallEventType(
    'edit',
    event,
  )) {
    return `edit ${event.input
      .path}`;
  }
  if (isToolCallEventType(
    'grep',
    event,
  )) {
    return `grep ${event.input
      .path
      ?? ''}`;
  }
  if (isToolCallEventType(
    'find',
    event,
  )) {
    return `find ${event.input
      .path
      ?? ''}`;
  }
  if (isToolCallEventType(
    'ls',
    event,
  )) {
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
  event: ToolCallEvent,
): boolean {
  return RELEVANT_TOOLS.includes(event.toolName,);
}

export {
  buildApprovalFingerprint,
  describeAction,
  extractToolText,
  getFilePath,
  isRelevantTool,
};
