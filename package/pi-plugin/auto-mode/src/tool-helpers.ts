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
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { RELEVANT_TOOLS, } from './constants.ts';

/**
 * Hash algorithm used for approval fingerprints.
 */
const APPROVAL_FINGERPRINT_HASH_ALGORITHM = 'sha256';

/**
 * Digest encoding used for approval fingerprints.
 */
const APPROVAL_FINGERPRINT_HASH_ENCODING = 'hex';

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
 * @mutates value - `JSON.stringify` and recursive `stableSerialize` calls can invoke caller-owned hooks
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
        .map(
          /**
           * Serializes one caller-reachable array item.
           *
           * @param item - Item read from supplied array.
           *
           * @returns Canonical JSON text for item.
           *
           * @mutates item - `stableSerialize` and nested `JSON.stringify` can invoke caller-owned hooks.
           */
          function serializeArrayItem(item: unknown,) {
          return item === undefined
            ? 'null'
            : stableSerialize(item,);
          },
        )
        .join(',',)
    }]`;
  }

  if ((value === null) || ((typeof value) !== 'object')) {
    return JSON.stringify(value,)
      ?? 'null';
  }

  /**
   * Object value narrowed to JSON-like record for key sorting.
   */
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Tool inputs are JSON-compatible plain objects after arrays, null, and primitives are handled; this narrows values for Object.entries without changing runtime data.
  const record = value as Readonly<Record<string, unknown>>;
  return `{${
    Object
      .entries(record,)
      .filter(function keepsJsonObjectEntry(entry,) {
        /**
         * Entry value tested against JSON.stringify object omission semantics.
         */
        const [, entryValue,] = entry;
        return entryValue !== undefined;
      },)
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
      },)
      .map(
        /**
         * Serializes one caller-reachable object entry.
         *
         * @param entry - Key and value produced by object enumeration.
         *
         * @returns Canonical JSON property text.
         *
         * @mutates entry - `stableSerialize` and nested `JSON.stringify` can invoke caller-owned hooks.
         */
        function serializeObjectEntry(
          entry: ForeignBorrowed<readonly [
            string,
            unknown,
          ]>,
        ) {
          /**
           * Object key and value serialized into canonical key order.
           */
          const [entryKey, entryValue,] = entry;
          return `${JSON.stringify(entryKey,)}:${stableSerialize(entryValue,)}`;
        },
      )
      .join(',',)
  }}`;
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
 * @returns serialized call identity for approval reuse
 *
 * @mutates event - `stableSerialize` can invoke caller-owned hooks reachable from tool input
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
  }: {
    readonly event: ForeignBorrowed<ToolCallEvent>;
    readonly cwd: string;
  },
): string {
  if (isToolCallEventType(
    'read',
    event,
  )) {
    return `{"cwd":${JSON.stringify(cwd,)},"input":${stableSerialize({
      path: event.input
        .path,
    },)},"toolName":${JSON.stringify(event.toolName,)}}`;
  }

  return `{"cwd":${JSON.stringify(cwd,)},"input":${stableSerialize(event.input,)},"toolName":${JSON.stringify(event.toolName,)}}`;
}

/**
 * Build a stable fingerprint for same-session approval reuse.
 *
 * Normalizes the call identity with {@link buildApprovalFingerprintIdentity}
 * and serializes it with {@link stableSerialize} before hashing.
 *
 * The fingerprint includes the tool name and current working directory. Read
 * calls include only the read path, ignoring `offset` and `limit`, so repeated
 * reads of one file at different ranges reuse approval. Other tools include
 * full tool input. Only the digest is stored in the session, so write or edit
 * payloads are compared without persisting their contents in custom entries.
 *
 * @param event - tool call event being guarded
 *
 * @param cwd - current extension working directory
 *
 * @returns SHA-256 digest for the guarded tool call
 *
 * @mutates event - canonical serialization can invoke caller-owned hooks reachable from tool input
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
    readonly event: ForeignBorrowed<ToolCallEvent>;
    readonly cwd: string;
  },
): string {
  /**
   * Permission identity after per-tool normalization.
   */
  const serializedCall = buildApprovalFingerprintIdentity({
    event,
    cwd,
  },);
  return createHash(APPROVAL_FINGERPRINT_HASH_ALGORITHM,)
    .update(serializedCall,)
    .digest(APPROVAL_FINGERPRINT_HASH_ENCODING,);
}

/**
 * Judge-facing name for canonical JSON-compatible input serialization.
 *
 * The alias preserves every current tool-input field while keeping the generic
 * serializer reusable for approval fingerprints.
 *
 * @example
 * ```typescript
 * serializeToolInputForJudge({ path: 'src/index.ts', content: 'export {};\n' });
 * ```
 */
const serializeToolInputForJudge = stableSerialize;

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
        function extractNewText(e: Readonly<{ readonly newText: string; }>,) {
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
  event: ForeignBorrowed<ToolCallEvent>,
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
  event: ForeignBorrowed<ToolCallEvent>,
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
};
