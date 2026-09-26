/**
 The per-branch `last-pushed` record single-flight auto-push coordinates through.

 The record names the tip the most recent push attempt resolved,
 its outcome,
 and the owner-lock token of the attempt,
 so a waiting commit can tell a push that finished while it waited from one that finished before.
 A failed attempt also keeps its complete push output,
 which every commit that joined it surfaces.
 The record is a cache:
 an absent or unreadable record only costs an extra push.

 @module
 */
import { randomUUID, } from 'node:crypto';
import {
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Record schema version.
 */
const LAST_PUSHED_SCHEMA_VERSION = 1;

/**
 Private record file mode; failed-push output stays readable by the owner only.
 */
const PRIVATE_FILE_MODE = 0o600;

/**
 Record file name suffix after the encoded branch key.
 */
export const LAST_PUSHED_SUFFIX = '.last-pushed.json';

/**
 Record absent or unreadable; the caller behaves as if no push ever ran.
 */
export const LAST_PUSHED_ABSENT: unique symbol = Symbol('last-pushed record file absent or unreadable',);

/**
 Outcome of one recorded push attempt.
 */
export type LastPushedOutcome = 'pushed' | 'failed';

/**
 Most recent push attempt for one branch.
 */
export type LastPushedRecord = Readonly<{
  /**
   Record schema version.
   */
  schemaVersion: 1;
  /**
   Branch tip the attempt resolved before pushing.
   */
  tip: string;
  /**
   Whether the push succeeded.
   */
  outcome: LastPushedOutcome;
  /**
   Owner-lock token of the attempt, unique per attempt.
   */
  ownerToken: string;
  /**
   Process that ran the attempt.
   */
  ownerPid: number;
  /**
   Push exit code, `0` on success.
   */
  exitCode: number;
  /**
   Complete push output of a failed attempt; empty on success.
   */
  output: string;
}>;

/**
 Parses a record.

 @param text - record file text

 @returns validated record

 @throws {@link TypeError} when a field is missing or mistyped

 @example
 ```ts
 parseLastPushedRecord('{"schemaVersion":1,"tip":"abc","outcome":"pushed","ownerToken":"t","ownerPid":1,"exitCode":0,"output":""}');
 ```
 */
export function parseLastPushedRecord(text: string,): LastPushedRecord {
  /**
   Untrusted parsed JSON value.
   */
  const value: unknown = JSON.parse(text,);
  if (((typeof value) !== 'object')
    || (value === null)
    || (!('schemaVersion' in value))
    || (value.schemaVersion !== LAST_PUSHED_SCHEMA_VERSION)
    || (!('tip' in value))
    || ((typeof value.tip) !== 'string')
    || (value.tip === '')
    || (!('outcome' in value))
    || ((value.outcome !== 'pushed') && (value.outcome !== 'failed'))
    || (!('ownerToken' in value))
    || ((typeof value.ownerToken) !== 'string')
    || (value.ownerToken === '')
    || (!('ownerPid' in value))
    || ((typeof value.ownerPid) !== 'number')
    || (!Number.isSafeInteger(value.ownerPid,))
    || (!('exitCode' in value))
    || ((typeof value.exitCode) !== 'number')
    || (!Number.isSafeInteger(value.exitCode,))
    || (!('output' in value))
    || ((typeof value.output) !== 'string'))
    throw new TypeError('last-pushed record is malformed.',);
  return {
    schemaVersion: LAST_PUSHED_SCHEMA_VERSION,
    tip: value.tip,
    outcome: value.outcome,
    ownerToken: value.ownerToken,
    ownerPid: value.ownerPid,
    exitCode: value.exitCode,
    output: value.output,
  };
}

/**
 Reads a branch's record, treating an absent or unreadable one as absent.

 @param recordPath - record file

 @returns record or absence sentinel

 @example
 ```ts
 await readLastPushedRecord('/repo/.git/cli-git/push/refs%2Fheads%2Fmain.last-pushed.json');
 ```
 */
export async function readLastPushedRecord(recordPath: string,): Promise<LastPushedRecord | typeof LAST_PUSHED_ABSENT> {
  /**
   Tagged reader logger.
   */
  const rl = tagged({
    tag: readLastPushedRecord.name,
    l,
  },);
  /**
   Record text.
   */
  const text = await (async function readRecordText(): Promise<string | typeof LAST_PUSHED_ABSENT> {
    try {
      return await readFile(
        recordPath,
        'utf8',
      );
    }
    catch (error: unknown) {
      if (Error.isError(error,) && ('code' in error)
        && (error.code === 'ENOENT')) {
        rl.debug(`no last-pushed record at ${recordPath}`,);
        return LAST_PUSHED_ABSENT;
      }
      throw error;
    }
  })();
  if (text === LAST_PUSHED_ABSENT)
    return LAST_PUSHED_ABSENT;
  try {
    return parseLastPushedRecord(text,);
  }
  catch (error: unknown) {
    rl.warn(`ignoring unreadable last-pushed record ${recordPath}; the next push replaces it: ${caughtValueText(error,)}`,);
    return LAST_PUSHED_ABSENT;
  }
}

/**
 Publishes a branch's record by rename, so readers never see a partial record.

 @param recordPath - record file

 @param record - attempt to record

 @example
 ```ts
 await writeLastPushedRecord({ recordPath, record });
 ```
 */
export async function writeLastPushedRecord({
  recordPath,
  record,
}: Readonly<{
  recordPath: string;
  record: LastPushedRecord;
}>,): Promise<void> {
  /**
   Unpublished candidate beside the record.
   */
  const candidatePath = `${recordPath}.${randomUUID()}.pending`;
  try {
    await writeFile(
      candidatePath,
      `${JSON.stringify(record,)}\n`,
      {
        encoding: 'utf8',
        mode: PRIVATE_FILE_MODE,
        flag: 'wx',
      },
    );
    await rename(
      candidatePath,
      recordPath,
    );
  }
  catch (error: unknown) {
    await rm(
      candidatePath,
      { force: true, },
    );
    throw error;
  }
}
