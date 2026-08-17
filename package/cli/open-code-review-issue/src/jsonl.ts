/**
 * OCR session JSONL replay.
 *
 * @module
 */

import { normalizeComment, } from './comment-normalize.ts';
import { InputValidationError, } from './input-validation-error.ts';
import { isRecord, } from './json-record.ts';
import type {
  NormalizedFinding,
  NormalizedInput,
} from './model.ts';

/**
 * Replay group preserving first checkpoint order across supersession.
 */
type ReplayGroup = {
  readonly fingerprint: string;
  readonly findings: readonly NormalizedFinding[];
};

/**
 * Reads optional string field from JSONL event.
 *
 * @param record - Event carrying candidate field.
 *
 * @param key - Event property to inspect.
 *
 * @param line - One-based JSONL line number.
 *
 * @returns Empty string when absent or supplied string.
 *
 * @throws {@link InputValidationError} when supplied field is not string.
 *
 * @example
 * ```ts
 * eventString({ record: {}, key: 'filePath', line: 1 }); // ''
 * ```
 */
function eventString({
  record,
  key,
  line,
}: {
  readonly record: Readonly<Record<string, unknown>>;
  readonly key: string;
  readonly line: number;
},): string {
  const value = record[key];
  if (value === undefined) {
    return '';
  }
  if ((typeof value) !== 'string') {
    throw new InputValidationError(`line ${String(line,)} property ${key} must be a string`,);
  }
  return value;
}

/**
 * Extracts resolved head from session-end manifest when present.
 *
 * @param record - Session event carrying optional run manifest.
 *
 * @param line - One-based JSONL line number.
 *
 * @returns Resolved head or absence.
 *
 * @throws {@link InputValidationError} when manifest shape is malformed.
 *
 * @example
 * ```ts
 * jsonlResolvedHead({ record: {}, line: 1 }); // undefined
 * ```
 */
function jsonlResolvedHead({
  record,
  line,
}: {
  readonly record: Readonly<Record<string, unknown>>;
  readonly line: number;
},): string | undefined {
  if (record.run_manifest === undefined) {
    return undefined;
  }
  if ((!isRecord(record.run_manifest,))
    || (!isRecord(record.run_manifest
      .input,)))
  {
    throw new InputValidationError(`line ${String(line,)} run_manifest.input must be an object`,);
  }
  const value = record.run_manifest
    .input
    .resolved_head;
  if ((value === undefined) || (value === '')) {
    return undefined;
  }
  if ((typeof value) !== 'string') {
    throw new InputValidationError(
      `line ${String(line,)} run_manifest.input.resolved_head must be a string`,
    );
  }
  return value;
}

/**
 * Parses one JSONL line as event record.
 *
 * @param text - One physical JSONL line without newline delimiter.
 *
 * @param line - One-based line number.
 *
 * @returns Validated event record.
 *
 * @throws {@link InputValidationError} when line is blank, invalid JSON, or non-object.
 *
 * @example
 * ```ts
 * parseJsonlRecord({ text: '{"type":"session_start"}', line: 1 });
 * ```
 */
function parseJsonlRecord({
  text,
  line,
}: {
  readonly text: string;
  readonly line: number;
},): Readonly<Record<string, unknown>> {
  if (text.trim() === '') {
    throw new InputValidationError(`line ${String(line,)} must not be blank`,);
  }
  let value: unknown;
  try {
    value = JSON.parse(text,);
  }
  catch (error: unknown) {
    throw new InputValidationError(`line ${String(line,)} must be valid JSON: ${String(error,)}`,);
  }
  if ((!isRecord(value,)) || ((typeof value.type) !== 'string')) {
    throw new InputValidationError(`line ${String(line,)} must be an event object with string type`,);
  }
  return value;
}

/**
 * Normalizes comments carried by a completed or reused checkpoint.
 *
 * @param record - Checkpoint event.
 *
 * @param line - One-based JSONL line number.
 *
 * @returns Findings inheriting event path when comment path is empty.
 *
 * @throws {@link InputValidationError} when comments or path fields are malformed.
 *
 * @example
 * ```ts
 * checkpointFindings({ record: { comments: [] }, line: 2 }); // []
 * ```
 */
function checkpointFindings({
  record,
  line,
}: {
  readonly record: Readonly<Record<string, unknown>>;
  readonly line: number;
},): readonly NormalizedFinding[] {
  if (!Array.isArray(record.comments,)) {
    throw new InputValidationError(`line ${String(line,)} property comments must be an array`,);
  }
  const filePath = eventString({
    record,
    key: 'filePath',
    line,
  });
  const newPath = eventString({
    record,
    key: 'newPath',
    line,
  });
  const fallbackPath = filePath === '' ? newPath : filePath;
  return record.comments
    .map(function normalizeCheckpointComment(value,): NormalizedFinding {
    return normalizeComment({
      value,
      position: {
        kind: 'line',
        value: line,
      },
      fallbackPath,
    },);
  },);
}

/**
 * Replays OCR JSONL checkpoint semantics into one finding collection.
 *
 * @param text - Complete JSONL transcript text.
 *
 * @returns Replayed findings and resolved head provenance.
 *
 * @throws {@link InputValidationError} when any physical record is malformed.
 *
 * @example
 * ```ts
 * parseJsonlInput({ text: '{"type":"session_start"}' });
 * ```
 */
export function parseJsonlInput({ text, }: { readonly text: string; },): NormalizedInput {
  const physicalLines = text.split('\n',);
  const lines = physicalLines.at(-1,) === '' ? physicalLines.slice(
    0,
    -1,
  ) : physicalLines;
  const groups: ReplayGroup[] = [];
  const groupByFingerprint = new Map<string, number>();
  let resolvedHead: string | undefined;

  lines.forEach(function replayLine(
    lineText,
    zeroBasedLine,
  ): void {
    const line = zeroBasedLine + 1;
    const record = parseJsonlRecord({
      text: lineText.endsWith('\r',) ? lineText.slice(
        0,
        -1,
      ) : lineText,
      line,
    });
    if ((record.type === 'review_item_done') || (record.type === 'review_item_reused')) {
      const fingerprint = eventString({
        record,
        key: 'fingerprint',
        line,
      });
      const group = {
        fingerprint,
        findings: checkpointFindings({
          record,
          line,
        }),
      };
      const existingIndex = fingerprint === '' ? undefined : groupByFingerprint.get(fingerprint,);
      if (existingIndex === undefined) {
        groups.push(group,);
        if (fingerprint !== '') {
          groupByFingerprint.set(
            fingerprint,
            groups.length - 1,
          );
        }
      }
      else {
        groups[existingIndex] = group;
      }
      return;
    }
    if (record.type === 'review_item_failed') {
      const fingerprint = eventString({
        record,
        key: 'fingerprint',
        line,
      });
      const existingIndex = fingerprint === '' ? undefined : groupByFingerprint.get(fingerprint,);
      if (existingIndex !== undefined) {
        groups[existingIndex] = {
          fingerprint,
          findings: [],
        };
      }
      return;
    }
    if (record.type === 'session_end') {
      resolvedHead = jsonlResolvedHead({
        record,
        line,
      }) ?? resolvedHead;
    }
  },);

  return {
    inputKind: 'jsonl',
    ...(resolvedHead === undefined ? {} : { resolvedHead, }),
    findings: groups.flatMap(function groupFindings(group,): readonly NormalizedFinding[] {
      return group.findings;
    },),
  };
}
