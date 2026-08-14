/**
 * Policy JSONL schema compatibility tests.
 *
 * @module
 */
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  createCommitLandedEvent,
  createConfigurationWarningEvent,
  createCoreFindingEvent,
  createEngineFailureEvent,
  createFindingEvent,
  createFixSummaryEvent,
  type EngineFailureCode,
  renderPolicyEvents,
} from './events.ts';

/** Every stable schema-one engine failure code. */
const ENGINE_FAILURE_CODES: readonly EngineFailureCode[] = [
  'config-invalid',
  'config-untrusted',
  'config-changed',
  'core-incomplete',
  'plugin-threw',
  'policy-incomplete',
  'content-unavailable',
  'patch-invalid',
  'patch-conflict',
  'fix-cycle',
  'fix-pass-limit',
  'transaction-failed',
  'trust-consent-unavailable',
  'trust-failed',
];

await describe({
  name: 'policy JSONL compatibility',
  children: [
    it({
      name: 'renders every event shape compactly in exact sequence with terminal LF',
      fn: async function testCompleteEventStream() {
        expect(renderPolicyEvents([
          createFindingEvent({
            sequence: 0,
            trigger: 'direct-check',
            policyId: 'fixture/policy',
            severity: 'error',
            code: 'denied',
            message: 'Denied.',
            path: 'value.txt',
            location: {
              byteStart: 1,
              byteEnd: 2,
            },
            fix: 'available',
          },),
          createConfigurationWarningEvent({
            sequence: 1,
            trigger: 'direct-check',
            policyId: 'fixture/unsafe',
          },),
          createCoreFindingEvent({
            sequence: 2,
            coreId: 'commit-only',
            code: 'pathspec-required',
            message: 'Name a path.',
          },),
          createFixSummaryEvent({
            sequence: 3,
            trigger: 'direct-fix',
            passes: 2,
            changedPaths: ['a.txt',],
          },),
          createEngineFailureEvent({
            sequence: 4,
            code: 'patch-conflict',
            message: 'Patch conflicted.',
            trigger: 'direct-fix',
            policyId: 'fixture/policy',
            path: 'value.txt',
          },),
          createCommitLandedEvent({
            sequence: 5,
            oid: 'abc123',
          },),
        ],),).toBe([
          '{"schemaVersion":1,"sequence":0,"type":"finding","trigger":"direct-check","policyId":"fixture/policy","severity":"error","code":"fixture/policy/denied","message":"Denied.","path":"value.txt","location":{"byteStart":1,"byteEnd":2},"fix":"available"}',
          '{"schemaVersion":1,"sequence":1,"type":"configuration-warning","trigger":"direct-check","policyId":"fixture/unsafe","code":"warn-unsafe","message":"Policy fixture/unsafe is warn-unsafe but configured as warn."}',
          '{"schemaVersion":1,"sequence":2,"type":"core-finding","trigger":"pre-forward","coreId":"commit-only","code":"commit-only/pathspec-required","message":"Name a path."}',
          '{"schemaVersion":1,"sequence":3,"type":"fix-summary","trigger":"direct-fix","passes":2,"changedPaths":["a.txt"]}',
          '{"schemaVersion":1,"sequence":4,"type":"engine-failure","code":"patch-conflict","message":"Patch conflicted.","trigger":"direct-fix","policyId":"fixture/policy","path":"value.txt"}',
          '{"schemaVersion":1,"sequence":5,"type":"commit-landed","oid":"abc123","outcome":"post-commit-blocked","message":"Commit abc123 remains local; post-commit gate blocked automatic backup."}',
          '',
        ].join('\n',),);
      },
    },),
    it({
      name: 'renders every stable engine failure code without optional fields',
      fn: async function testFailureCodes() {
        /** Events covering complete stable failure-code union. */
        const events = ENGINE_FAILURE_CODES.map(function failureForCode(code, sequence,) {
          return createEngineFailureEvent({
            sequence,
            code,
            message: code,
          },);
        },);
        /** Parsed rendered JSONL objects. */
        const parsed = renderPolicyEvents(events,)
          .trimEnd()
          .split('\n',)
          .map(function parseLine(line,): unknown {
            return JSON.parse(line,);
          },);
        expect(parsed,).toEqual(ENGINE_FAILURE_CODES.map(function expectedFailure(code, sequence,) {
          return {
            schemaVersion: 1,
            sequence,
            type: 'engine-failure',
            code,
            message: code,
          };
        },),);
      },
    },),
    it({
      name: 'renders no bytes for empty event sequence',
      fn: async function testEmptyStream() {
        expect(renderPolicyEvents([],),).toBe('',);
      },
    },),
  ],
},);
