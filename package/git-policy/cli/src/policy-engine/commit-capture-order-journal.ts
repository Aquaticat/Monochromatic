/**
 `captured.json`: a transaction's position in its worktree's capture order.

 Written once right after the capture,
 before any hook,
 editor,
 or landing runs.
 It names the capture stamp,
 the next capture sequence number read before the preparation base
 (which keeps the landed-capture records this transaction may replay over from being pruned),
 and the paths whose bytes the capture read from the worktree.
 Paths are Latin-1 decoded Git path bytes,
 as replay's shared-path listing decodes them,
 so every byte survives the JSON round trip.

 @module
 */
import { join, } from 'node:path';
import {
  isMissingPath,
  syncDirectory,
  writePrivateFile,
} from '../trust/registry-io.ts';
import {
  type CaptureStamp,
  readStoreFile,
} from './commit-capture-order-store.ts';
import { JOURNAL_SCHEMA_VERSION, } from './commit-transaction-journal-states.ts';

/**
 Capture-order record filename inside a transaction directory.
 */
export const CAPTURED_FILENAME = 'captured.json';

/**
 The record is absent: the transaction has not captured yet, or predates capture order.
 */
export const CAPTURED_ABSENT: unique symbol = Symbol('captured.json absent',);

/**
 `captured.json` contents.
 */
export type CapturedRecord = CaptureStamp & Readonly<{
  /**
   Record schema version.
   */
  schemaVersion: 2;
  /**
   Record discriminator.
   */
  state: 'captured';
  /**
   Next capture sequence number read before the preparation base;
   every commit that landed after the base was read recorded a larger or equal next number after its landing.
   */
  nextSequenceBeforeBase: number;
  /**
   Paths whose committed bytes the capture read from the worktree, Latin-1 decoded, in Git order.
   */
  worktreePaths: readonly string[];
}>;

/**
 Malformed capture-order state.
 */
export class CaptureOrderRecordError extends Error {
  /**
   Creates a malformed-record failure.

   @param message - diagnostic naming the record
   */
  public constructor(message: string,) {
    super(message,);
    this.name = 'CaptureOrderRecordError';
  }
}

/**
 Reads a required positive safe integer field.

 @param value - parsed object

 @param key - field name

 @param name - record name used in diagnostics

 @returns field value

 @throws {@link CaptureOrderRecordError} for a missing or mistyped field

 @example
 ```ts
 positiveField({ value: { sequence: 1 }, key: 'sequence', name: 'captured.json' }); // 1
 ```
 */
export function positiveField({
  value,
  key,
  name,
}: Readonly<{
  value: object;
  key: string;
  name: string;
}>,): number {
  /**
   Field value.
   */
  const field: unknown = Reflect.get(
    value,
    key,
  );
  if (((typeof field) !== 'number') || (!Number.isSafeInteger(field,))
    || (field < 1))
    throw new CaptureOrderRecordError(`${name} has a malformed ${key} field.`,);
  return field;
}

/**
 Reads a required nonempty string field.

 @param value - parsed object

 @param key - field name

 @param name - record name used in diagnostics

 @returns field value

 @throws {@link CaptureOrderRecordError} for a missing or mistyped field

 @example
 ```ts
 stringField({ value: { worktreeId: 'w' }, key: 'worktreeId', name: 'captured.json' }); // 'w'
 ```
 */
export function stringField({
  value,
  key,
  name,
}: Readonly<{
  value: object;
  key: string;
  name: string;
}>,): string {
  /**
   Field value.
   */
  const field: unknown = Reflect.get(
    value,
    key,
  );
  if (((typeof field) !== 'string') || (field === ''))
    throw new CaptureOrderRecordError(`${name} has a malformed ${key} field.`,);
  return field;
}

/**
 Reads a required string-array field.

 @param value - parsed object

 @param key - field name

 @param name - record name used in diagnostics

 @returns field value

 @throws {@link CaptureOrderRecordError} for a missing or mistyped field

 @example
 ```ts
 pathsField({ value: { worktreePaths: ['a'] }, key: 'worktreePaths', name: 'captured.json' }); // ['a']
 ```
 */
export function pathsField({
  value,
  key,
  name,
}: Readonly<{
  value: object;
  key: string;
  name: string;
}>,): readonly string[] {
  /**
   Field value.
   */
  const field: unknown = Reflect.get(
    value,
    key,
  );
  if ((!Array.isArray(field,)) || (!field.every(function isPath(path: unknown,): boolean {
    return ((typeof path) === 'string') && (path !== '');
  },)))
    throw new CaptureOrderRecordError(`${name} has a malformed ${key} field.`,);
  return field.map(String,);
}

/**
 Parses a JSON object record.

 @param text - record text

 @param name - record name used in diagnostics

 @returns parsed object

 @throws {@link CaptureOrderRecordError} when the text is not a JSON object

 @example
 ```ts
 parseObject({ text: '{}', name: 'captured.json' });
 ```
 */
export function parseObject({
  text,
  name,
}: Readonly<{
  text: string;
  name: string;
}>,): object {
  /**
   Untrusted JSON value.
   */
  const value: unknown = JSON.parse(text,);
  if (((typeof value) !== 'object') || (value === null)
    || Array.isArray(value,))
    throw new CaptureOrderRecordError(`${name} is not a JSON object.`,);
  return value;
}

/**
 Parses `captured.json`.

 @param text - record text

 @returns validated record

 @throws {@link CaptureOrderRecordError} for any malformed field

 @example
 ```ts
 parseCapturedRecord('{"schemaVersion":2,"state":"captured",...}');
 ```
 */
export function parseCapturedRecord(text: string,): CapturedRecord {
  /**
   Parsed object.
   */
  const value = parseObject({
    text,
    name: CAPTURED_FILENAME,
  },);
  if ((Reflect.get(
    value,
    'schemaVersion',
  ) !== JOURNAL_SCHEMA_VERSION) || (Reflect.get(
    value,
    'state',
  ) !== 'captured'))
    throw new CaptureOrderRecordError(`${CAPTURED_FILENAME} is not a schema-version-2 captured record.`,);
  /**
   Field reader arguments shared by every field.
   */
  const source = {
    value,
    name: CAPTURED_FILENAME,
  };
  return {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    state: 'captured',
    worktreeId: stringField({
      ...source,
      key: 'worktreeId',
    },),
    sequence: positiveField({
      ...source,
      key: 'sequence',
    },),
    nextSequenceBeforeBase: positiveField({
      ...source,
      key: 'nextSequenceBeforeBase',
    },),
    worktreePaths: pathsField({
      ...source,
      key: 'worktreePaths',
    },),
  };
}

/**
 Writes `captured.json` exclusively and makes it durable.

 @param directory - transaction directory

 @param record - record to write

 @example
 ```ts
 await writeCapturedRecord({ directory, record });
 ```
 */
export async function writeCapturedRecord({
  directory,
  record,
}: Readonly<{
  directory: string;
  record: CapturedRecord;
}>,): Promise<void> {
  await writePrivateFile({
    path: join(
      directory,
      CAPTURED_FILENAME,
    ),
    bytes: new TextEncoder().encode(`${JSON.stringify(record,)}\n`,),
  },);
  await syncDirectory(directory,);
}

/**
 Reads `captured.json` of a transaction.

 @param directory - transaction directory

 @returns record, or {@link CAPTURED_ABSENT} when the transaction has not captured

 @throws {@link CaptureOrderRecordError} when the record is malformed

 @example
 ```ts
 await readCapturedRecord('/repo/.git/cli-git-transactions/<id>');
 ```
 */
export async function readCapturedRecord(directory: string,): Promise<CapturedRecord | typeof CAPTURED_ABSENT> {
  try {
    return parseCapturedRecord(
      await readStoreFile(join(
      directory,
      CAPTURED_FILENAME,
    ),),
    );
  }
  catch (error: unknown) {
    if (isMissingPath(error,))
      return CAPTURED_ABSENT;
    throw error;
  }
}
