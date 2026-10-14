/**
 Built-artifact rejection of unbound or malformed prerequisite evidence.

 @module
 */
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  AuthorizationEvidenceError,
  InstructionResolutionInputError,
  flushPolicyDiagnostics,
} from '../dist/final/node/index.mjs';
import {
  authorizationCaptureFailures,
  createAuthorizationEvidenceFixture,
} from './authorization-evidence-test-fixture.ts';

await describe({
  name: '',
  children: [
    //region Original binding cannot be replaced by equal-looking fields
    ...(['judgment', 'rule', 'source', 'request',] as const).map(function bindingCase(field,) {
      return it({
        name: `rejects evidence for a different original ${field}`,
        fn: async function checkOriginalBinding() {
          const f = createAuthorizationEvidenceFixture();
          Reflect.set(f.evidence, field, {},);
          const failures = await authorizationCaptureFailures(f.options,);
          expect(failures,).toHaveLength(1,);
          expect(failures[0],).toBeInstanceOf(AuthorizationEvidenceError,);
        },
      },);
    },),
    it({
      name: 'rejects copied evidence even when its original fields match',
      fn: async function checkOwnerIdentity() {
        const f = createAuthorizationEvidenceFixture();
        f.owner.capture = async function copyEvidence() {
          return { ...f.evidence, };
        };
        const failures = await authorizationCaptureFailures(f.options,);
        expect(failures,).toHaveLength(1,);
        expect(failures[0],).toBeInstanceOf(AuthorizationEvidenceError,);
      },
    },),
    ...(['source-absent', 'request-absent', 'request-mismatch',] as const).map(function sourceCase(mode,) {
      return it({
        name: `rejects an original fact owner with ${mode}`,
        fn: async function checkSourceBinding() {
          const f = createAuthorizationEvidenceFixture();
          const { requestObservation, ...remainingInputs } = f.inputs;
          const failures = await authorizationCaptureFailures({
            ...f.options,
            inputs: {
              ...remainingInputs,
              instructionSources: mode === 'source-absent' ? [] : [f.source,],
              ...(mode === 'request-absent' ? {} : { requestObservation: mode === 'request-mismatch' ? {} : requestObservation, }),
            },
          },);
          expect(failures,).toHaveLength(1,);
          expect(failures[0],).toBeInstanceOf(AuthorizationEvidenceError,);
          expect(f.controls.captures,).toBe(0,);
        },
      },);
    },),
    //endregion Original reference checks
    //region Closed vocabulary and reflection reject inferred permission metadata
    ...([
      { satisfaction: true, channel: 'incumbent-approval', },
      { satisfaction: 'unsatisfied', channel: 'allow-button', },
      { satisfaction: 'satisfied', channel: 'incumbent-approval', permission: true, },
    ] as const).map(function factCase(authorization, index,) {
      return it({
        name: `rejects unsupported condition vocabulary ${index}`,
        fn: async function checkFacts() {
          const f = createAuthorizationEvidenceFixture();
          Reflect.set(f.evidence, 'authorization', authorization,);
          const failures = await authorizationCaptureFailures(f.options,);
          expect(failures,).toHaveLength(1,);
          expect(failures[0],).toBeInstanceOf(InstructionResolutionInputError,);
        },
      },);
    },),
    ...(['extra-evidence', 'missing-evidence', 'extra-owner', 'non-callable', 'null-owner',] as const).map(function recordShapeCase(mode,) {
      return it({
        name: `rejects unsupported record shape ${mode}`,
        fn: async function checkRecordShapes() {
          const f = createAuthorizationEvidenceFixture();
          if (mode === 'extra-evidence')
            Reflect.set(f.evidence, 'permission', true,);
          if (mode === 'missing-evidence')
            Reflect.deleteProperty(f.evidence, 'source',);
          if (mode === 'extra-owner')
            Reflect.set(f.owner, 'modelSays', true,);
          if (mode === 'non-callable')
            Reflect.set(f.owner, 'capture', false,);
          const failures = await authorizationCaptureFailures({
            ...f.options,
            ownerFor() { return mode === 'null-owner' ? null : f.owner; },
          },);
          expect(failures,).toHaveLength(1,);
          expect(failures[0],).toBeInstanceOf(AuthorizationEvidenceError,);
        },
      },);
    },),
    ...(['evidence', 'owner',] as const).map(function accessorCase(mode,) {
      return it({
        name: `does not invoke ${mode} getters, with a positive getter control`,
        fn: async function checkAccessors() {
          const counts = { reads: 0, };
          const f = createAuthorizationEvidenceFixture();
          const target = mode === 'owner' ? f.owner : f.evidence;
          const field = mode === 'owner' ? 'capture' : 'authorization';
          Object.defineProperty(target, field, {
            enumerable: true,
            get() { counts.reads++;
            return f.authorization; },
          },);
          const before = counts.reads;
          const failures = await authorizationCaptureFailures(f.options,);
          expect(failures,).toHaveLength(1,);
          expect(failures[0],).toBeInstanceOf(AuthorizationEvidenceError,);
          expect(counts.reads,).toBe(before,);
          Reflect.get(target, field,);
          expect(counts.reads,).toBe(before + 1,);
        },
      },);
    },),
    it({
      name: 'rejects proxy owners before reflection, with a positive trap control',
      fn: async function checkProxy() {
        const f = createAuthorizationEvidenceFixture();
        const state = { traps: 0, };
        const owner = new Proxy(f.owner, {
          getPrototypeOf() { state.traps++;
          return Object.prototype; },
        },);
        const failures = await authorizationCaptureFailures({
          ...f.options,
          ownerFor() {
            return owner;
          },
        },);
        expect(failures,).toHaveLength(1,);
        expect(failures[0],).toBeInstanceOf(AuthorizationEvidenceError,);
        expect(state.traps,).toBe(0,);
        Object.getPrototypeOf(owner,);
        expect(state.traps,).toBe(1,);
      },
    },),
    //endregion Structural and vocabulary rejection
  ],
},);
await flushPolicyDiagnostics();
