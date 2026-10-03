/**
 Owner record encoding, parsing, and liveness classification.

 @module
 */
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { internalTestExports, } from '../../dist/final/node/index.mjs';
import { exitedProcessIdentity, } from './commit-transaction-recovery-fixture.unit.test.ts';

const {
  classifyTransactionOwner,
  CommitTransactionRecoveryError,
  createTransactionOwnerRecord,
  encodeTransactionOwner,
  parseTransactionOwner,
  resolveProcessBirthIdentity,
} = internalTestExports;

/**
 Owner record fields a valid record carries.
 */
const VALID_FIELDS: Readonly<Record<string, unknown>> = {
  schemaVersion: 2,
  transactionId: '0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10',
  ownerPid: 100,
  ownerIdentity: 'linux:1',
  createdAt: '2026-01-01T00:00:00.000Z',
};

/**
 Field values a record must not carry, labelled for test names.
 */
const INVALID_VALUES: readonly Readonly<{
  /**
   Test-name label.
   */
  label: string;
  /**
   Replaced fields.
   */
  fields: Readonly<Record<string, unknown>>;
}>[] = [
  { label: 'a nonpositive PID', fields: { ownerPid: 0, }, },
  { label: 'a fractional PID', fields: { ownerPid: 1.5, }, },
  { label: 'an empty identity', fields: { ownerIdentity: '', }, },
  { label: 'another schema version', fields: { schemaVersion: 1, }, },
];

/**
 Encodes arbitrary JSON as owner record bytes.

 @param value - JSON value

 @returns UTF-8 bytes
 */
function bytesOf(value: unknown,): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value,),);
}

/**
 Captures a synchronous rejection.

 @param operation - rejecting operation

 @returns thrown value
 */
function thrownBy(operation: () => unknown,): unknown {
  try {
    operation();
  }
  catch (error: unknown) {
    return error;
  }
  throw new Error('Operation unexpectedly succeeded.',);
}

await describe({
  name: '',
  children: [
    describe({
      name: parseTransactionOwner.name,
      children: [
        it({
          name: 'round-trips a record the current process creates',
          fn: async function testRoundTrip(): Promise<void> {
            /** Current process owner record. */
            const owner = await createTransactionOwnerRecord({
              transactionId: '0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10',
              createdAt: '2026-01-01T00:00:00.000Z',
            },);
            expect(owner.ownerPid,).toBe(process.pid,);
            /** Encoded record bytes. */
            const encoded = encodeTransactionOwner(owner,);
            expect(parseTransactionOwner(encoded,),).toEqual(owner,);
          },
        },),
        ...Object.keys(VALID_FIELDS,).flatMap(function fieldCases(field,) {
          /** Record without one required field. */
          const { [field]: _removed, ...missing } = VALID_FIELDS;
          return [
            it({
              name: `rejects a record missing ${field}`,
              fn: async function testMissing(): Promise<void> {
                expect(thrownBy(() => parseTransactionOwner(bytesOf(missing,),),),).toBeInstanceOf(CommitTransactionRecoveryError,);
              },
            },),
            it({
              name: `rejects a record with mistyped ${field}`,
              fn: async function testMistyped(): Promise<void> {
                expect(thrownBy(() => parseTransactionOwner(bytesOf({ ...VALID_FIELDS, [field]: [], },),),),)
                  .toBeInstanceOf(CommitTransactionRecoveryError,);
              },
            },),
          ];
        },),
        ...INVALID_VALUES.map(function invalidValue({ label, fields, },) {
          return it({
            name: `rejects ${label}`,
            fn: async function testInvalid(): Promise<void> {
              /** Record carrying the invalid value. */
              const bytes = bytesOf({ ...VALID_FIELDS, ...fields, },);
              expect(thrownBy(() => parseTransactionOwner(bytes,),),).toBeInstanceOf(CommitTransactionRecoveryError,);
            },
          },);
        },),
        it({
          name: 'rejects a non-object record',
          fn: async function testNonObject(): Promise<void> {
            expect(thrownBy(() => parseTransactionOwner(bytesOf(null,),),),).toBeInstanceOf(CommitTransactionRecoveryError,);
          },
        },),
      ],
    },),
    describe({
      name: classifyTransactionOwner.name,
      children: [
        it({
          name: 'classifies the current process as alive',
          fn: async function testAlive(): Promise<void> {
            /** Current process birth identity. */
            const ownerIdentity = await resolveProcessBirthIdentity(process.pid,);
            if ((typeof ownerIdentity) === 'symbol')
              throw new Error('Current process identity was unavailable.',);
            expect(await classifyTransactionOwner({ ownerPid: process.pid, ownerIdentity, },),).toBe('alive',);
          },
        },),
        it({
          name: 'classifies an exited process as dead',
          fn: async function testExited(): Promise<void> {
            /** Identity of a process that has exited. */
            const exited = await exitedProcessIdentity();
            expect(await classifyTransactionOwner(exited,),).toBe('dead',);
          },
        },),
        it({
          name: 'classifies a PID now naming a different process birth as dead',
          fn: async function testReused(): Promise<void> {
            expect(await classifyTransactionOwner({ ownerPid: process.pid, ownerIdentity: 'linux:0', },),).toBe('dead',);
          },
        },),
      ],
    },),
  ],
},);
