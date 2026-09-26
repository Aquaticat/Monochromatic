/**
 Strict parsers of schema-version-2 transaction journal records.

 Every missing or mistyped field fails closed with the record and field named.

 @module
 */
import type {
  ConclusionKind,
  SymbolicHeadTarget,
} from './commit-transaction-capture.ts';
import {
  type IndexLockRecord,
  JOURNAL_SCHEMA_VERSION,
  type LandingRecord,
  type PreparedRecord,
  type PreparingRecord,
  type RefUpdatedRecord,
} from './commit-transaction-journal-states.ts';
import {
  createRecordReader,
  FIELD_ABSENT,
  type RecordReader,
} from './commit-transaction-journal-reader.ts';
import { CommitTransactionRecoveryError, } from './commit-transaction-recovery-validation.ts';

/**
 Strict record decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 Accepted conclusion kinds.
 */
const CONCLUSION_KINDS: readonly ConclusionKind[] = [
  'none',
  'amend',
  'merge',
  'cherry-pick',
  'revert',
];

/**
 Narrows a recorded conclusion kind.

 @param value - recorded value

 @returns whether it names a conclusion kind
 */
function isConclusionKind(value: string,): value is ConclusionKind {
  return CONCLUSION_KINDS.some(function sameKind(kind,): boolean {
    return kind === value;
  },);
}

/**
 Parses a record's JSON object and checks its schema version and state.

 @param bytes - record bytes

 @param name - record name used in diagnostics

 @param state - expected state discriminator

 @returns field reader
 */
function openRecord({
  bytes,
  name,
  state,
}: Readonly<{
  bytes: Uint8Array;
  name: string;
  state: string;
}>,): RecordReader {
  /**
   Untrusted JSON value.
   */
  const value: unknown = JSON.parse(DECODER.decode(bytes,),);
  if (((typeof value) !== 'object') || (value === null)
    || Array.isArray(value,)
    || (Reflect.get(
      value,
      'schemaVersion',
    ) !== JOURNAL_SCHEMA_VERSION)
    || (Reflect.get(
      value,
      'state',
    ) !== state))
    throw new CommitTransactionRecoveryError(`Transaction record ${name} is not a schema-version-2 ${state} record.`,);
  return createRecordReader({
    name,
    value,
  },);
}

/**
 Reads a recorded symbolic `HEAD` target.

 @param read - record reader

 @returns symbolic target
 */
function readSymbolicHead(read: RecordReader,): SymbolicHeadTarget {
  /**
   Nested target.
   */
  const head = read.object('symbolicHead',);
  /**
   Target discriminator.
   */
  const kind = head.string('kind',);
  if (kind === 'detached')
    return { kind: 'detached', };
  if (kind !== 'branch')
    throw new CommitTransactionRecoveryError('Transaction record preparing.json has a malformed symbolicHead field.',);
  return {
    kind: 'branch',
    ref: head.string('ref',),
  };
}

/**
 Parses `preparing.json`.

 @param bytes - record bytes

 @returns validated record

 @throws {@link CommitTransactionRecoveryError} for any malformed field

 @example
 ```ts
 parsePreparingRecord(bytes);
 ```
 */
export function parsePreparingRecord(bytes: Uint8Array,): PreparingRecord {
  /**
   Record reader.
   */
  const read = openRecord({
    bytes,
    name: 'preparing.json',
    state: 'preparing',
  },);
  /**
   Recorded mode, conclusion, and ref backend.
   */
  const [mode, conclusion, refFormat,] = [
    read.string('mode',),
    read.string('conclusion',),
    read.string('refFormat',),
  ];
  if (((mode !== 'explicit-path') && (mode !== 'index'))
    || (!isConclusionKind(conclusion,))
    || ((refFormat !== 'files') && (refFormat !== 'reftable')))
    throw new CommitTransactionRecoveryError('Transaction record preparing.json has a malformed mode, conclusion, or refFormat field.',);
  return {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    state: 'preparing',
    transactionId: read.string('transactionId',),
    mode,
    base: read.base('base',),
    symbolicHead: readSymbolicHead(read,),
    targetRef: read.string('targetRef',),
    conclusion,
    repositoryRoot: read.string('repositoryRoot',),
    gitDir: read.string('gitDir',),
    commonDir: read.string('commonDir',),
    realIndexPath: read.string('realIndexPath',),
    objectDirectory: read.string('objectDirectory',),
    refFormat,
    emptyTreeOid: read.string('emptyTreeOid',),
    shadowPath: read.string('shadowPath',),
    selectedPathspecs: read.strings('selectedPathspecs',),
    invokedAt: read.string('invokedAt',),
  };
}

/**
 Parses `prepared.json`.

 @param bytes - record bytes

 @returns validated record

 @throws {@link CommitTransactionRecoveryError} for any malformed field

 @example
 ```ts
 parsePreparedRecord(bytes);
 ```
 */
export function parsePreparedRecord(bytes: Uint8Array,): PreparedRecord {
  /**
   Record reader.
   */
  const read = openRecord({
    bytes,
    name: 'prepared.json',
    state: 'prepared',
  },);
  return {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    state: 'prepared',
    shadowPath: read.string('shadowPath',),
    preparedOid: read.string('preparedOid',),
    signed: read.boolean('signed',),
    intendedTreeOid: read.string('intendedTreeOid',),
    committedPaths: read.strings('committedPaths',),
    addedPaths: read.addedPaths('addedPaths',),
    selectedWorktreePaths: read.addedPaths('selectedWorktreePaths',),
  };
}

/**
 Parses `index-lock-<n>.json`.

 @param bytes - record bytes

 @returns validated record

 @throws {@link CommitTransactionRecoveryError} for any malformed field

 @example
 ```ts
 parseIndexLockRecord(bytes);
 ```
 */
export function parseIndexLockRecord(bytes: Uint8Array,): IndexLockRecord {
  /**
   Record reader.
   */
  const read = openRecord({
    bytes,
    name: 'index-lock record',
    state: 'index-locked',
  },);
  return {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    state: 'index-locked',
    attempt: read.positiveInteger('attempt',),
    lock: read.lock('lock',),
  };
}

/**
 Parses `landing-<n>.json`.

 @param bytes - record bytes

 @returns validated record

 @throws {@link CommitTransactionRecoveryError} for any malformed field

 @example
 ```ts
 parseLandingRecord(bytes);
 ```
 */
export function parseLandingRecord(bytes: Uint8Array,): LandingRecord {
  /**
   Record reader.
   */
  const read = openRecord({
    bytes,
    name: 'landing record',
    state: 'landing',
  },);
  /**
   Landing kind.
   */
  const operation = read.string('operation',);
  /**
   New target value, absent for a normalization.
   */
  const newOid = read.optionalString('newOid',);
  /**
   Migrated pack, absent for a normalization.
   */
  const packName = read.optionalString('packName',);
  if (((operation !== 'commit') && (operation !== 'normalize-only'))
    || ((operation === 'commit') && (newOid === FIELD_ABSENT)))
    throw new CommitTransactionRecoveryError('Transaction record landing record has a malformed operation or newOid field.',);
  return {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    state: 'landing',
    attempt: read.positiveInteger('attempt',),
    operation,
    expectedOld: read.base('expectedOld',),
    ...(newOid === FIELD_ABSENT ? {} : { newOid, }),
    landedTreeOid: read.string('landedTreeOid',),
    preLandingIndex: read.identity('preLandingIndex',),
    postIndex: read.identity('postIndex',),
    lock: read.lock('lock',),
    ...(packName === FIELD_ABSENT ? {} : { packName, }),
    addedPaths: read.addedPaths('addedPaths',),
    selectedWorktreePaths: read.addedPaths('selectedWorktreePaths',),
  };
}

/**
 Parses `ref-updated.json`.

 @param bytes - record bytes

 @returns validated record

 @throws {@link CommitTransactionRecoveryError} for any malformed field

 @example
 ```ts
 parseRefUpdatedRecord(bytes);
 ```
 */
export function parseRefUpdatedRecord(bytes: Uint8Array,): RefUpdatedRecord {
  return {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    state: 'ref-updated',
    landedOid: openRecord({
      bytes,
      name: 'ref-updated.json',
      state: 'ref-updated',
    },)
      .string('landedOid',),
  };
}
