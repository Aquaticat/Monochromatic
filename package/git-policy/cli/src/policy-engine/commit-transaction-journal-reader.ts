/**
 Field reader over one untrusted journal record,
 failing closed with the record and field named.

 @module
 */
import type { AddedPathRecord, } from './commit-transaction-added-paths.ts';
import type { PreparationBase, } from './commit-transaction-capture.ts';
import type {
  FileIdentity,
  LockIdentity,
} from './commit-transaction-journal-states.ts';
import { CommitTransactionRecoveryError, } from './commit-transaction-recovery-validation.ts';

/**
 Optional record field is absent.
 */
export const FIELD_ABSENT: unique symbol = Symbol('journal record field absent',);

/**
 Typed accessors over one record object.
 */
export type RecordReader = Readonly<{
  /**
   Reads a required string.
   */
  string: (key: string) => string;
  /**
   Reads an optional string.
   */
  optionalString: (key: string) => string | typeof FIELD_ABSENT;
  /**
   Reads a required boolean.
   */
  boolean: (key: string) => boolean;
  /**
   Reads a required positive safe integer.
   */
  positiveInteger: (key: string) => number;
  /**
   Reads a required array of strings.
   */
  strings: (key: string) => readonly string[];
  /**
   Reads a required nested object.
   */
  object: (key: string) => RecordReader;
  /**
   Reads a preparation base.
   */
  base: (key: string) => PreparationBase;
  /**
   Reads a file identity.
   */
  identity: (key: string) => FileIdentity;
  /**
   Reads a lock identity.
   */
  lock: (key: string) => LockIdentity;
  /**
   Reads added-path or selected-worktree records.
   */
  addedPaths: (key: string) => readonly AddedPathRecord[];
}>;

/**
 Builds a reader over one parsed object.

 @param name - record name used in diagnostics

 @param value - parsed JSON object

 @returns field reader

 @example
 ```ts
 createRecordReader({ name: 'preparing.json', value: {} }).string('mode');
 ```
 */
export function createRecordReader({
  name,
  value,
}: Readonly<{
  name: string;
  value: object;
}>,): RecordReader {
  /**
   Builds the malformed-field failure.

   @param key - field name

   @returns recovery error
   */
  function malformed(key: string,): CommitTransactionRecoveryError {
    return new CommitTransactionRecoveryError(`Transaction record ${name} has a malformed ${key} field.`,);
  }

  /**
   Untrusted field value.

   @param key - field name

   @returns field value
   */
  function field(key: string,): unknown {
    return Reflect.get(
      value,
      key,
    );
  }

  /**
   Reads a required string.

   @param key - field name

   @returns string
   */
  function readString(key: string,): string {
    /**
     Candidate value.
     */
    const candidate = field(key,);
    if ((typeof candidate) !== 'string')
      throw malformed(key,);
    return candidate;
  }

  /**
   Reads a nested object.

   @param key - field name

   @returns nested reader
   */
  function readObject(key: string,): RecordReader {
    /**
     Candidate value.
     */
    const candidate = field(key,);
    if (((typeof candidate) !== 'object') || (candidate === null)
      || Array.isArray(candidate,))
      throw malformed(key,);
    return createRecordReader({
      name: `${name}#${key}`,
      value: candidate,
    },);
  }

  /**
   Reads a file identity.

   @param key - field name

   @returns identity
   */
  function readIdentity(key: string,): FileIdentity {
    /**
     Nested identity.
     */
    const nested = readObject(key,);
    return {
      device: nested.string('device',),
      inode: nested.string('inode',),
    };
  }

  return {
    string: readString,
    optionalString: function readOptionalString(key: string,): string | typeof FIELD_ABSENT {
      return (key in value) ? readString(key,) : FIELD_ABSENT;
    },
    boolean: function readBoolean(key: string,): boolean {
      /**
       Candidate value.
       */
      const candidate = field(key,);
      if ((typeof candidate) !== 'boolean')
        throw malformed(key,);
      return  candidate;
    },
    positiveInteger: function readPositiveInteger(key: string,): number {
      /**
       Candidate value.
       */
      const candidate = field(key,);
      if (((typeof candidate) !== 'number') || (!Number.isSafeInteger(candidate,))
        || (candidate < 1))
        throw malformed(key,);
      return candidate;
    },
    strings: function readStrings(key: string,): readonly string[] {
      /**
       Candidate value.
       */
      const candidate = field(key,);
      if (!Array.isArray(candidate,))
        throw malformed(key,);
      return candidate.map(function stringItem(item: unknown,): string {
        if ((typeof item) !== 'string')
          throw malformed(key,);
        return item;
      },);
    },
    object: readObject,
    base: function readBase(key: string,): PreparationBase {
      /**
       Nested base.
       */
      const nested = readObject(key,);
      /**
       Base discriminator.
       */
      const kind = nested.string('kind',);
      if (kind === 'unborn')
        return { kind: 'unborn', };
      if (kind !== 'commit')
        throw malformed(key,);
      return {
        kind: 'commit',
        oid: nested.string('oid',),
      };
    },
    identity: readIdentity,
    lock: function readLock(key: string,): LockIdentity {
      return {
        ...readIdentity(key,),
        fsId: readObject(key,)
          .string('fsId',),
      };
    },
    addedPaths: function readAddedPaths(key: string,): readonly AddedPathRecord[] {
      /**
       Candidate value.
       */
      const candidate = field(key,);
      if (!Array.isArray(candidate,))
        throw malformed(key,);
      return candidate.map(function parseRecord(item: unknown,): AddedPathRecord {
        if (((typeof item) !== 'object') || (item === null))
          throw malformed(key,);
        /**
         Nested record reader.
         */
        const nested = createRecordReader({
          name: `${name}#${key}`,
          value: item,
        },);
        /**
         Recorded Git mode.
         */
        const gitMode = nested.string('gitMode',);
        if ((gitMode !== '100644') && (gitMode !== '100755'))
          throw malformed(key,);
        return {
          path: nested.string('path',),
          gitMode,
          originalOid: nested.string('originalOid',),
          intendedOid: nested.string('intendedOid',),
        };
      },);
    },
  };
}
