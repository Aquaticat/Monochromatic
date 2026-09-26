/**
 Strict parsers of schema-version-2 transaction journal records.

 Every missing or mistyped field fails closed with the record and field named.

 @module
 */
import type { AddedPathRecord, } from './commit-transaction-added-paths.ts';
import type {
  ConclusionKind,
  PreparationBase,
  SymbolicHeadTarget,
} from './commit-transaction-capture.ts';
import {
  type FileIdentity,
  type IndexLockRecord,
  JOURNAL_SCHEMA_VERSION,
  type LandingRecord,
  type LockIdentity,
  type PreparedRecord,
  type PreparingRecord,
  type RefUpdatedRecord,
} from './commit-transaction-journal-states.ts';
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
const CONCLUSION_KINDS: ReadonlySet<string> = new Set([
  'none',
  'amend',
  'merge',
  'cherry-pick',
  'revert',
],);

/**
 Record being parsed, named in diagnostics.
 */
type ParseScope = Readonly<{
  /**
   Record filename.
   */
  record: string;
  /**
   Parsed JSON object.
   */
  value: object;
}>;

/**
 Builds the malformed-field failure.

 @param scope - record scope

 @param key - field name

 @returns recovery error naming both
 */
function malformed({
  scope,
  key,
}: Readonly<{
  scope: ParseScope;
  key: string;
}>,): CommitTransactionRecoveryError {
  return new CommitTransactionRecoveryError(`Transaction record ${scope.record} has a malformed ${key} field.`,);
}

/**
 Reads a required string field.

 @param scope - record scope

 @param key - field name

 @returns string value
 */
function stringField({
  scope,
  key,
}: Readonly<{
  scope: ParseScope;
  key: string;
}>,): string {
  /**
   Untrusted field value.
   */
  const value: unknown = Reflect.get(
    scope.value,
    key,
  );
  if ((typeof value) !== 'string')
    throw malformed({
      scope,
      key,
    },);
  return String(value,);
}

/**
 Reads an optional string field.

 @param scope - record scope

 @param key - field name

 @returns string value or absence
 */
function optionalStringField({
  scope,
  key,
}: Readonly<{
  scope: ParseScope;
  key: string;
}>,): string | undefined {
  return (key in scope.value)
    ? stringField({
      scope,
      key,
    },)
    : undefined;
}

/**
 Reads a required object field.

 @param scope - record scope

 @param key - field name

 @returns nested scope
 */
function objectField({
  scope,
  key,
}: Readonly<{
  scope: ParseScope;
  key: string;
}>,): ParseScope {
  /**
   Untrusted field value.
   */
  const value: unknown = Reflect.get(
    scope.value,
    key,
  );
  if (((typeof value) !== 'object') || (value === null) || Array.isArray(value,))
    throw malformed({
      scope,
      key,
    },);
  return {
    record: `${scope.record}#${key}`,
    value,
  };
}

/**
 Reads a required array of strings.

 @param scope - record scope

 @param key - field name

 @returns strings
 */
function stringArrayField({
  scope,
  key,
}: Readonly<{
  scope: ParseScope;
  key: string;
}>,): readonly string[] {
  /**
   Untrusted field value.
   */
  const value: unknown = Reflect.get(
    scope.value,
    key,
  );
  if (!Array.isArray(value,))
    throw malformed({
      scope,
      key,
    },);
  return value.map(function stringItem(item: unknown,): string {
    if ((typeof item) !== 'string')
      throw malformed({
        scope,
        key,
      },);
    return String(item,);
  },);
}

/**
 Reads a positive safe integer field.

 @param scope - record scope

 @param key - field name

 @returns integer
 */
function positiveIntegerField({
  scope,
  key,
}: Readonly<{
  scope: ParseScope;
  key: string;
}>,): number {
  /**
   Untrusted field value.
   */
  const value: unknown = Reflect.get(
    scope.value,
    key,
  );
  if (((typeof value) !== 'number') || (!Number.isSafeInteger(value,)) || (Number(value,) < 1))
    throw malformed({
      scope,
      key,
    },);
  return Number(value,);
}

/**
 Reads a preparation base.

 @param scope - record scope

 @param key - field name

 @returns base
 */
function baseField({
  scope,
  key,
}: Readonly<{
  scope: ParseScope;
  key: string;
}>,): PreparationBase {
  /**
   Nested base object.
   */
  const nested = objectField({
    scope,
    key,
  },);
  /**
   Base discriminator.
   */
  const kind = stringField({
    scope: nested,
    key: 'kind',
  },);
  if (kind === 'unborn')
    return { kind: 'unborn', };
  if (kind !== 'commit')
    throw malformed({
      scope,
      key,
    },);
  return {
    kind: 'commit',
    oid: stringField({
      scope: nested,
      key: 'oid',
    },),
  };
}

/**
 Reads a file identity.

 @param scope - record scope

 @param key - field name

 @returns identity
 */
function identityField({
  scope,
  key,
}: Readonly<{
  scope: ParseScope;
  key: string;
}>,): FileIdentity {
  /**
   Nested identity object.
   */
  const nested = objectField({
    scope,
    key,
  },);
  return {
    device: stringField({
      scope: nested,
      key: 'device',
    },),
    inode: stringField({
      scope: nested,
      key: 'inode',
    },),
  };
}

/**
 Reads a lock identity.

 @param scope - record scope

 @param key - field name

 @returns lock identity
 */
function lockField({
  scope,
  key,
}: Readonly<{
  scope: ParseScope;
  key: string;
}>,): LockIdentity {
  return {
    ...identityField({
      scope,
      key,
    },),
    fsId: stringField({
      scope: objectField({
        scope,
        key,
      },),
      key: 'fsId',
    },),
  };
}

/**
 Reads added-path or selected-worktree records.

 @param scope - record scope

 @param key - field name

 @returns records
 */
function addedPathsField({
  scope,
  key,
}: Readonly<{
  scope: ParseScope;
  key: string;
}>,): readonly AddedPathRecord[] {
  /**
   Untrusted field value.
   */
  const value: unknown = Reflect.get(
    scope.value,
    key,
  );
  if (!Array.isArray(value,))
    throw malformed({
      scope,
      key,
    },);
  return value.map(function parseRecord(item: unknown,): AddedPathRecord {
    if (((typeof item) !== 'object') || (item === null))
      throw malformed({
        scope,
        key,
      },);
    /**
     Nested record scope.
     */
    const nested: ParseScope = {
      record: `${scope.record}#${key}`,
      value: item,
    };
    /**
     Recorded Git mode.
     */
    const gitMode = stringField({
      scope: nested,
      key: 'gitMode',
    },);
    if ((gitMode !== '100644') && (gitMode !== '100755'))
      throw malformed({
        scope: nested,
        key: 'gitMode',
      },);
    return {
      path: stringField({
        scope: nested,
        key: 'path',
      },),
      gitMode,
      originalOid: stringField({
        scope: nested,
        key: 'originalOid',
      },),
      intendedOid: stringField({
        scope: nested,
        key: 'intendedOid',
      },),
    };
  },);
}

/**
 Parses a record's JSON object and checks its schema version and state.

 @param bytes - record bytes

 @param record - filename named in diagnostics

 @param state - expected state discriminator

 @returns parse scope
 */
function openRecord({
  bytes,
  record,
  state,
}: Readonly<{
  bytes: Uint8Array;
  record: string;
  state: string;
}>,): ParseScope {
  /**
   Untrusted JSON value.
   */
  const value: unknown = JSON.parse(DECODER.decode(bytes,),);
  if (((typeof value) !== 'object') || (value === null) || Array.isArray(value,))
    throw new CommitTransactionRecoveryError(`Transaction record ${record} is not an object.`,);
  /**
   Record scope.
   */
  const scope: ParseScope = {
    record,
    value,
  };
  if ((Reflect.get(value, 'schemaVersion',) !== JOURNAL_SCHEMA_VERSION) || (Reflect.get(value, 'state',) !== state))
    throw malformed({
      scope,
      key: 'schemaVersion or state',
    },);
  return scope;
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
   Record scope.
   */
  const scope = openRecord({
    bytes,
    record: 'preparing.json',
    state: 'preparing',
  },);
  /**
   Mode discriminator.
   */
  const mode = stringField({
    scope,
    key: 'mode',
  },);
  /**
   Commit kind.
   */
  const conclusion = stringField({
    scope,
    key: 'conclusion',
  },);
  /**
   Ref backend.
   */
  const refFormat = stringField({
    scope,
    key: 'refFormat',
  },);
  /**
   Symbolic head object.
   */
  const head = objectField({
    scope,
    key: 'symbolicHead',
  },);
  /**
   Symbolic head discriminator.
   */
  const headKind = stringField({
    scope: head,
    key: 'kind',
  },);
  if (((mode !== 'explicit-path') && (mode !== 'index'))
    || (!CONCLUSION_KINDS.has(conclusion,))
    || ((refFormat !== 'files') && (refFormat !== 'reftable'))
    || ((headKind !== 'branch') && (headKind !== 'detached')))
    throw malformed({
      scope,
      key: 'mode, conclusion, refFormat, or symbolicHead',
    },);
  /**
   Validated symbolic head.
   */
  const symbolicHead: SymbolicHeadTarget = headKind === 'branch'
    ? {
      kind: 'branch',
      ref: stringField({
        scope: head,
        key: 'ref',
      },),
    }
    : { kind: 'detached', };
  return {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    state: 'preparing',
    transactionId: stringField({ scope, key: 'transactionId', },),
    mode,
    base: baseField({ scope, key: 'base', },),
    symbolicHead,
    targetRef: stringField({ scope, key: 'targetRef', },),
    // Membership was checked against CONCLUSION_KINDS.
    conclusion: conclusion as ConclusionKind,
    repositoryRoot: stringField({ scope, key: 'repositoryRoot', },),
    gitDir: stringField({ scope, key: 'gitDir', },),
    commonDir: stringField({ scope, key: 'commonDir', },),
    realIndexPath: stringField({ scope, key: 'realIndexPath', },),
    objectDirectory: stringField({ scope, key: 'objectDirectory', },),
    refFormat,
    emptyTreeOid: stringField({ scope, key: 'emptyTreeOid', },),
    shadowPath: stringField({ scope, key: 'shadowPath', },),
    selectedPathspecs: stringArrayField({ scope, key: 'selectedPathspecs', },),
    invokedAt: stringField({ scope, key: 'invokedAt', },),
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
   Record scope.
   */
  const scope = openRecord({
    bytes,
    record: 'prepared.json',
    state: 'prepared',
  },);
  /**
   Signed flag.
   */
  const signed: unknown = Reflect.get(
    scope.value,
    'signed',
  );
  if ((typeof signed) !== 'boolean')
    throw malformed({
      scope,
      key: 'signed',
    },);
  return {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    state: 'prepared',
    shadowPath: stringField({ scope, key: 'shadowPath', },),
    preparedOid: stringField({ scope, key: 'preparedOid', },),
    signed: signed === true,
    intendedTreeOid: stringField({ scope, key: 'intendedTreeOid', },),
    committedPaths: stringArrayField({ scope, key: 'committedPaths', },),
    addedPaths: addedPathsField({ scope, key: 'addedPaths', },),
    selectedWorktreePaths: addedPathsField({ scope, key: 'selectedWorktreePaths', },),
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
   Record scope.
   */
  const scope = openRecord({
    bytes,
    record: 'index-lock record',
    state: 'index-locked',
  },);
  return {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    state: 'index-locked',
    attempt: positiveIntegerField({ scope, key: 'attempt', },),
    lock: lockField({ scope, key: 'lock', },),
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
   Record scope.
   */
  const scope = openRecord({
    bytes,
    record: 'landing record',
    state: 'landing',
  },);
  /**
   Landing kind.
   */
  const operation = stringField({
    scope,
    key: 'operation',
  },);
  if ((operation !== 'commit') && (operation !== 'normalize-only'))
    throw malformed({
      scope,
      key: 'operation',
    },);
  /**
   Optional new target value.
   */
  const newOid = optionalStringField({
    scope,
    key: 'newOid',
  },);
  /**
   Optional migrated pack.
   */
  const packName = optionalStringField({
    scope,
    key: 'packName',
  },);
  if ((operation === 'commit') && (newOid === undefined))
    throw malformed({
      scope,
      key: 'newOid',
    },);
  return {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    state: 'landing',
    attempt: positiveIntegerField({ scope, key: 'attempt', },),
    operation,
    expectedOld: baseField({ scope, key: 'expectedOld', },),
    ...(newOid === undefined ? {} : { newOid, }),
    landedTreeOid: stringField({ scope, key: 'landedTreeOid', },),
    preLandingIndex: identityField({ scope, key: 'preLandingIndex', },),
    postIndex: identityField({ scope, key: 'postIndex', },),
    lock: lockField({ scope, key: 'lock', },),
    ...(packName === undefined ? {} : { packName, }),
    addedPaths: addedPathsField({ scope, key: 'addedPaths', },),
    selectedWorktreePaths: addedPathsField({ scope, key: 'selectedWorktreePaths', },),
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
  /**
   Record scope.
   */
  const scope = openRecord({
    bytes,
    record: 'ref-updated.json',
    state: 'ref-updated',
  },);
  return {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    state: 'ref-updated',
    landedOid: stringField({ scope, key: 'landedOid', },),
  };
}
