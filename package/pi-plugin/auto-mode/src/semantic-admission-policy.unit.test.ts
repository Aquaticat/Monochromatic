/**
 Built-artifact bootstrap admission capture controls.

 @module
 */
import {
  copySemanticAdmissionPolicy,
  flushPolicyDiagnostics,
  SemanticAdmissionPolicyError,
} from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';

/**
 Each caller receives fresh mutable configuration and a distinct callback.
 */
function declaration() {
  const calls = { count: 0, };
  return {
    calls,
    input: {
      model: 'fixture-model',
      definitionId: 'clause_operation_relation',
      programProfile: 'fixture-profile',
      accepts(): boolean {
        calls.count++;
        return true;
      },
    },
  };
}

await describe({
  name: copySemanticAdmissionPolicy.name,
  children: [
    ...(['clause_operation_relation', 'request_instruction_content', 'heading_instruction_content', 'unit_adoption',] as const).map(function definitionCase(definitionId,) {
      return it({
        name: `captures ${definitionId} without invoking or freezing borrowed capabilities`,
        fn: async function checkCapture() {
          const f = declaration();
          f.input.definitionId = definitionId;
          const original = f.input.accepts;
          const policy = copySemanticAdmissionPolicy({ input: f.input, definitionId, },);
          if (policy === undefined)
            throw new Error('Configured policy was not captured',);
          expect(f.calls.count,).toBe(0,);
          f.input.model = 'changed';
          f.input.definitionId = 'changed';
          f.input.programProfile = 'changed';
          f.input.accepts = () => false;
          expect(policy.model,).toBe('fixture-model',);
          expect(policy.definitionId,).toBe(definitionId,);
          expect(policy.programProfile,).toBe('fixture-profile',);
          expect(policy.accepts,).toBe(original,);
          expect(Object.isFrozen(policy,),).toBe(true,);
          expect(Object.isFrozen(f.input,),).toBe(false,);
          expect(Object.isFrozen(original,),).toBe(false,);
          expect(policy.accepts({},),).toBe(true,);
          expect(f.calls.count,).toBe(1,);
        },
      },);
    },),
    it({
      name: 'absence keeps the consumer unconfigured rather than enabling default admission',
      fn: async function checkAbsence() {
        expect(copySemanticAdmissionPolicy({ input: undefined, definitionId: 'clause_operation_relation', },),).toBeUndefined();
      },
    },),
    it({
      name: 'rejects unsupported object shapes, fields, definitions and acceptance values',
      fn: async function checkInvalid() {
        const { input, } = declaration();
        const invalid: readonly unknown[] = [
          null, false, 0, '', [], new Date(), Object.create(input,), Object.create(null,), {},
          { ...input, qualified: true, }, { ...input, premises: 'complete', }, { ...input, verdict: 'approve', },
          { ...input, model: '', }, { ...input, model: 1, }, { ...input, programProfile: '', }, { ...input, programProfile: false, },
          { ...input, definitionId: 'operation_violates_rule', }, { ...input, accepts: true, },
          { ...input, accepts: undefined, },
        ];
        for (const value of invalid) {
          expect(function invoke() {
            copySemanticAdmissionPolicy({ input: value, definitionId: 'clause_operation_relation', },);
          },).toThrow(SemanticAdmissionPolicyError,);
        }
      },
    },),
    it({
      name: 'rejects getters and non-enumerable data without invoking any accessor',
      fn: async function checkDescriptors() {
        const f = declaration();
        const reads = { count: 0, };
        const accessor = { ...f.input, };
        Object.defineProperty(accessor, 'model', { enumerable: true, get(): string { reads.count++; return 'fixture-model'; }, },);
        const hidden = { ...f.input, };
        Object.defineProperty(hidden, 'model', { enumerable: false, value: 'fixture-model', },);
        const symbol = { ...f.input, [Symbol('model')]: 'fixture-model', };
        Reflect.deleteProperty(symbol, 'model',);
        for (const input of [accessor, hidden, symbol,]) {
          expect(function invoke() {
            copySemanticAdmissionPolicy({ input, definitionId: 'clause_operation_relation', },);
          },).toThrow(SemanticAdmissionPolicyError,);
        }
        expect(reads.count,).toBe(0,);
        expect(f.calls.count,).toBe(0,);
      },
    },),
    it({
      name: 'rejects ordinary and revoked proxies before reflection with a positive trap control',
      fn: async function checkProxy() {
        const f = declaration();
        const state = { traps: 0, };
        const input = new Proxy(f.input, {
          getPrototypeOf(): never {
            state.traps++;
            throw new Error('Unexpected configuration reflection',);
          },
        },);
        const revoked = Proxy.revocable(f.input, {},);
        revoked.revoke();
        for (const value of [input, revoked.proxy,]) {
          expect(function invoke() {
            copySemanticAdmissionPolicy({ input: value, definitionId: 'clause_operation_relation', },);
          },).toThrow(SemanticAdmissionPolicyError,);
        }
        expect(state.traps,).toBe(0,);
        expect(function positiveControl() { Object.getPrototypeOf(input,); },).toThrow('Unexpected configuration reflection',);
        expect(state.traps,).toBe(1,);
      },
    },),
  ],
},);
await flushPolicyDiagnostics();
