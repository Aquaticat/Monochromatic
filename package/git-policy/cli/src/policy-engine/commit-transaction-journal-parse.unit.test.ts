/**
 Schema-version-2 journal record parsers: every record round-trips, and malformed records fail closed.

 @module
 */
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { internalTestExports, } from '../../dist/final/node/index.mjs';

const {
  CommitTransactionRecoveryError,
  parseIndexLockRecord,
  parseLandingRecord,
  parsePreparedRecord,
  parsePreparingRecord,
  parseRefUpdatedRecord,
} = internalTestExports;

/**
 Commit ID of the right length.
 */
const OID = 'b'.repeat(40,);

/**
 Recorded lock identity.
 */
const LOCK = { device: '1', inode: '2', fsId: 'fs', } as const;

/**
 Valid `preparing.json` value.
 */
const PREPARING = {
  schemaVersion: 2,
  state: 'preparing',
  transactionId: '0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10',
  mode: 'index',
  base: { kind: 'commit', oid: OID, },
  symbolicHead: { kind: 'branch', ref: 'refs/heads/main', },
  targetRef: 'refs/heads/main',
  conclusion: 'merge',
  repositoryRoot: '/repo',
  gitDir: '/repo/.git',
  commonDir: '/repo/.git',
  realIndexPath: '/repo/.git/index',
  objectDirectory: '/repo/.git/objects',
  refFormat: 'files',
  emptyTreeOid: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
  shadowPath: '/repo/.git/cli-git/shadow/0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10',
  selectedPathspecs: ['a.txt',],
  invokedAt: '2026-01-01T00:00:00.000Z',
} as const;

/**
 Valid `landing-<n>.json` value.
 */
const LANDING = {
  schemaVersion: 2,
  state: 'landing',
  attempt: 1,
  operation: 'commit',
  expectedOld: { kind: 'unborn', },
  newOid: OID,
  landedTreeOid: OID,
  preLandingIndex: { device: '1', inode: '3', },
  postIndex: { device: '1', inode: '4', },
  lock: LOCK,
  packName: 'pack-abc',
  addedPaths: [],
  selectedWorktreePaths: [],
} as const;

/**
 Encodes a value as record bytes.

 @param value - record value

 @returns JSON bytes
 */
function bytes(value: unknown,): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value,)}\n`,);
}

/**
 Captures the recovery error a parse must throw.

 @param parse - parse call

 @returns error message
 */
function rejection(parse: () => unknown,): string {
  try {
    parse();
  }
  catch (error: unknown) {
    if (error instanceof CommitTransactionRecoveryError)
      return error.message;
    throw error;
  }
  throw new Error('Parse unexpectedly accepted a malformed record.',);
}

await describe({
  name: 'journal record parsers',
  children: [
    it({
      name: 'every record kind round-trips through its parser',
      fn: async function testRoundTrip(): Promise<void> {
        /** Prepared record. */
        const prepared = {
          schemaVersion: 2,
          state: 'prepared',
          shadowPath: '/s',
          preparedOid: OID,
          signed: true,
          intendedTreeOid: OID,
          committedPaths: ['a.txt',],
          addedPaths: [],
          selectedWorktreePaths: [],
        };
        /** Normalization landing without commit fields. */
        const normalization = {
          schemaVersion: 2,
          state: 'landing',
          attempt: 2,
          operation: 'normalize-only',
          expectedOld: { kind: 'commit', oid: OID, },
          landedTreeOid: OID,
          preLandingIndex: LANDING.preLandingIndex,
          postIndex: LANDING.postIndex,
          lock: LOCK,
          addedPaths: [],
          selectedWorktreePaths: [],
        };
        expect(
          parsePreparingRecord(bytes(PREPARING,),),
        ).toEqual(PREPARING,);
        expect(parsePreparingRecord(bytes({ ...PREPARING, symbolicHead: { kind: 'detached', }, targetRef: 'HEAD', },),).symbolicHead,).toEqual({ kind: 'detached', },);
        expect(
          parsePreparedRecord(bytes(prepared,),),
        ).toEqual(prepared,);
        expect(
          parseIndexLockRecord(bytes({ schemaVersion: 2, state: 'index-locked', attempt: 3, lock: LOCK, },),),
        ).toEqual({ schemaVersion: 2, state: 'index-locked', attempt: 3, lock: LOCK, },);
        expect(
          parseLandingRecord(bytes(LANDING,),),
        ).toEqual(LANDING,);
        expect(
          parseLandingRecord(bytes(normalization,),),
        ).toEqual(normalization,);
        expect(
          parseRefUpdatedRecord(bytes({ schemaVersion: 2, state: 'ref-updated', landedOid: OID, },),),
        ).toEqual({ schemaVersion: 2, state: 'ref-updated', landedOid: OID, },);
      },
    },),
    ...([
      ['an array root', function arrayRoot(): unknown {
        return parsePreparingRecord(bytes([PREPARING,],),);
      },],
      ['another schema version', function otherVersion(): unknown {
        return parsePreparingRecord(bytes({ ...PREPARING, schemaVersion: 1, },),);
      },],
      ['another state', function otherState(): unknown {
        return parsePreparingRecord(bytes({ ...PREPARING, state: 'prepared', },),);
      },],
      ['an unknown mode', function badMode(): unknown {
        return parsePreparingRecord(bytes({ ...PREPARING, mode: 'all', },),);
      },],
      ['an unknown conclusion', function badConclusion(): unknown {
        return parsePreparingRecord(bytes({ ...PREPARING, conclusion: 'rebase', },),);
      },],
      ['an unknown ref format', function badRefFormat(): unknown {
        return parsePreparingRecord(bytes({ ...PREPARING, refFormat: 'loose', },),);
      },],
      ['an unknown symbolic HEAD kind', function badHead(): unknown {
        return parsePreparingRecord(bytes({ ...PREPARING, symbolicHead: { kind: 'tag', }, },),);
      },],
      ['a missing field', function missingField(): unknown {
        return parsePreparingRecord(bytes({ ...PREPARING, realIndexPath: undefined, },),);
      },],
      ['a mistyped path list', function badPathspecs(): unknown {
        return parsePreparingRecord(bytes({ ...PREPARING, selectedPathspecs: [1,], },),);
      },],
      ['a commit landing without a new commit', function missingNewOid(): unknown {
        return parseLandingRecord(bytes({ ...LANDING, newOid: undefined, },),);
      },],
      ['an unknown landing operation', function badOperation(): unknown {
        return parseLandingRecord(bytes({ ...LANDING, operation: 'replay', },),);
      },],
      ['a zero attempt', function zeroAttempt(): unknown {
        return parseIndexLockRecord(bytes({ schemaVersion: 2, state: 'index-locked', attempt: 0, lock: LOCK, },),);
      },],
      ['a lock without a filesystem identity', function badLock(): unknown {
        return parseIndexLockRecord(bytes({ schemaVersion: 2, state: 'index-locked', attempt: 1, lock: { device: '1', inode: '2', }, },),);
      },],
      ['a mistyped signature flag', function badSigned(): unknown {
        return parsePreparedRecord(bytes({ schemaVersion: 2, state: 'prepared', shadowPath: '/s', preparedOid: OID, signed: 'yes', intendedTreeOid: OID, committedPaths: [], addedPaths: [], selectedWorktreePaths: [], },),);
      },],
    ] as const).map(function rejectionTest([description, parse,],) {
      return it({
        name: `rejects ${description}`,
        fn: async function testRejection(): Promise<void> {
          expect(rejection(parse,),).toContain('Transaction record',);
        },
      },);
    },),
  ],
},);
