/**
 Policy `inputs` declarations: valid shapes, every rejected shape, function resolution after option parsing, and config failures.

 @module
 */
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import * as v from 'valibot';
import { internalTestExports, } from '../../dist/final/node/index.mjs';

const {
  ConfigValidationError,
  INPUTS_UNDECLARED,
  parsePolicyInputs,
  resolvePolicyInputs,
  validateConfig,
  validateInputsDeclaration,
} = internalTestExports;

/**
 Captures a config failure message.

 @param validate - validation expected to fail

 @returns failure message
 */
function rejection(validate: () => unknown,): string {
  try {
    validate();
  }
  catch (error: unknown) {
    if (error instanceof ConfigValidationError)
      return error.message;
    throw error;
  }
  throw new Error('Inputs unexpectedly validated.',);
}

/**
 A plugin config whose one policy declares the given inputs.

 @param inputs - declared inputs member

 @param setting - policy setting

 @param options - options schema

 @returns config
 */
function configWith({
  inputs,
  setting = 'error',
  options,
}: Readonly<{
  inputs: unknown;
  setting?: unknown;
  options?: unknown;
}>,): Readonly<Record<string, unknown>> {
  return {
    plugins: {
      probe: {
        name: 'probe',
        policies: [{
          name: 'check',
          defaultSeverity: 'error',
          warnSafe: true,
          triggers: ['pre-forward',],
          ...(options === undefined ? {} : { options, }),
          inputs,
          check: async function check(): Promise<readonly never[]> {
            return [];
          },
        },],
      },
    },
    policies: { 'probe/check': setting, },
  };
}

/**
 Resolved inputs of the probe policy.

 @param config - validated config source

 @returns resolved inputs member
 */
function probeInputs(config: Readonly<Record<string, unknown>>,): unknown {
  return validateConfig(config,).registeredPolicies
    .find(function isProbe(policy,): boolean {
      return policy.name === 'probe/check';
    },)
    ?.inputs;
}

await describe({
  name: '',
  children: [
    describe({
      name: parsePolicyInputs.name,
      children: [
        it({
          name: 'accepts unrestricted, context-only, and every input kind',
          fn: async function testValid(): Promise<void> {
            expect(parsePolicyInputs({ value: 'unrestricted', effectiveId: 'x', },),).toBe('unrestricted',);
            expect(parsePolicyInputs({ value: { external: [], }, effectiveId: 'x', },),).toEqual({ external: [], },);
            /** Every kind at once. */
            const every = {
              external: [
                { kind: 'worktree', pathspecs: ['rules.txt', ':(glob)**/*.md',], },
                { kind: 'executable', path: 'forbidden-strings', },
                { kind: 'revision', rev: 'refs/remotes/origin/main', },
                { kind: 'env', name: 'FORBIDDEN_STRINGS_RULES', },
              ],
            };
            expect(parsePolicyInputs({ value: every, effectiveId: 'x', },),).toEqual(every,);
          },
        },),
        it({
          name: 'returns a copy, so later mutation of the declaration cannot change it',
          fn: async function testCopy(): Promise<void> {
            /** Mutable declaration. */
            const pathspecs = ['a.txt',];
            /** Parsed copy. */
            const parsed = parsePolicyInputs({ value: { external: [{ kind: 'worktree', pathspecs, },], }, effectiveId: 'x', },);
            pathspecs.push('b.txt',);
            expect(parsed,).toEqual({ external: [{ kind: 'worktree', pathspecs: ['a.txt',], },], },);
          },
        },),
        ...[
          ['an unknown kind', { external: [{ kind: 'network', url: 'x', },], }, 'unknown input kind',],
          ['an empty pathspec list', { external: [{ kind: 'worktree', pathspecs: [], }, ], }, 'worktree pathspecs must be non-empty',],
          ['an empty pathspec', { external: [{ kind: 'worktree', pathspecs: ['',], },], }, 'must be non-empty',],
          ['a NUL in a path', { external: [{ kind: 'executable', path: 'a\0b', },], }, 'must not contain NUL',],
          ['a revision starting with -', { external: [{ kind: 'revision', rev: '--all', },], }, 'must not start with -',],
          ['a multi-line revision', { external: [{ kind: 'revision', rev: 'HEAD\nmain', },], }, 'one line',],
          ['a variable name with =', { external: [{ kind: 'env', name: 'A=B', },], }, 'must not contain =',],
          ['an unknown key', { external: [{ kind: 'env', name: 'A', extra: 1, },], }, 'Policy x has invalid inputs',],
          ['a wrong type', { external: [{ kind: 'executable', path: 7, },], }, 'Policy x has invalid inputs',],
          ['a non-array external', { external: 'rules.txt', }, 'Policy x has invalid inputs',],
          ['another string', 'everything', 'Policy x has invalid inputs',],
          ['a missing external', {}, 'Policy x has invalid inputs',],
        ].map(function rejectedCase([label, value, message,]) {
          return it({
            name: `rejects ${String(label,)}`,
            fn: async function testRejected(): Promise<void> {
              expect(rejection(function parse() {
                return parsePolicyInputs({ value, effectiveId: 'x', },);
              },),).toContain(String(message,),);
            },
          },);
        },),
      ],
    },),
    describe({
      name: validateInputsDeclaration.name,
      children: [
        it({
          name: 'keeps absence and functions, and validates a static value',
          fn: async function testDeclaration(): Promise<void> {
            expect(validateInputsDeclaration({ value: undefined, effectiveId: 'x', },),).toBe(INPUTS_UNDECLARED,);
            /** Function declaration. */
            const declared = function declared(): string {
              return 'unrestricted';
            };
            expect(validateInputsDeclaration({ value: declared, effectiveId: 'x', },),).toBe(declared,);
            expect(rejection(function validate() {
              return validateInputsDeclaration({ value: { external: [{ kind: 'x', },], }, effectiveId: 'x', },);
            },),).toContain('unknown input kind',);
          },
        },),
      ],
    },),
    describe({
      name: resolvePolicyInputs.name,
      children: [
        it({
          name: 'treats an absent declaration as unrestricted',
          fn: async function testAbsent(): Promise<void> {
            expect(resolvePolicyInputs({ options: undefined, effectiveId: 'x', },),).toBe('unrestricted',);
          },
        },),
        it({
          name: 'calls a function once with the options and validates its result',
          fn: async function testFunction(): Promise<void> {
            /** Received options. */
            const received: unknown[] = [];
            /** Resolved inputs. */
            const resolved = resolvePolicyInputs({
              declaration: function inputs(options: unknown,) {
                received.push(options,);
                return { external: [{ kind: 'executable', path: 'scanner', },], };
              },
              options: { executable: 'scanner', },
              effectiveId: 'x',
            },);
            expect(received,).toEqual([{ executable: 'scanner', },],);
            expect(resolved,).toEqual({ external: [{ kind: 'executable', path: 'scanner', },], },);
          },
        },),
        it({
          name: 'turns a throwing or invalid function into a config failure',
          fn: async function testFunctionFailures(): Promise<void> {
            expect(rejection(function resolve() {
              return resolvePolicyInputs({
                declaration: function inputs(): never {
                  throw new Error('no scanner',);
                },
                options: undefined,
                effectiveId: 'probe/check',
              },);
            },),).toContain('Policy probe/check inputs function threw: no scanner',);
            expect(rejection(function resolve() {
              return resolvePolicyInputs({
                // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The test declares an invalid result the types forbid.
                declaration: function inputs() {
                  return { external: [{ kind: 'worktree', pathspecs: [], },], };
                } as () => 'unrestricted',
                options: undefined,
                effectiveId: 'probe/check',
              },);
            },),).toContain('worktree pathspecs must be non-empty',);
          },
        },),
      ],
    },),
    describe({
      name: 'config loading',
      children: [
        it({
          name: 'resolves a function declaration with the parsed options, defaults applied',
          fn: async function testConfigFunction(): Promise<void> {
            expect(probeInputs(configWith({
              inputs: function inputs(options: Readonly<{ executable: string; }>,) {
                return { external: [{ kind: 'executable', path: options.executable, },], };
              },
              options: v.optional(v.object({ executable: v.optional(v.string(), 'default-scanner',), },), {},),
            },),),).toEqual({ external: [{ kind: 'executable', path: 'default-scanner', },], },);
            expect(probeInputs(configWith({
              inputs: function inputs(options: Readonly<{ executable: string; }>,) {
                return { external: [{ kind: 'executable', path: options.executable, },], };
              },
              options: v.optional(v.object({ executable: v.optional(v.string(), 'default-scanner',), },), {},),
              setting: ['warn', { executable: './configured', },],
            },),),).toEqual({ external: [{ kind: 'executable', path: './configured', },], },);
          },
        },),
        it({
          name: 'keeps static declarations, and an absent one resolves to unrestricted',
          fn: async function testConfigStatic(): Promise<void> {
            expect(probeInputs(configWith({ inputs: { external: [], }, },),),).toEqual({ external: [], },);
            expect(probeInputs(configWith({ inputs: undefined, },),),).toBe('unrestricted',);
          },
        },),
        it({
          name: 'never calls the function of a disabled policy',
          fn: async function testDisabled(): Promise<void> {
            /** Calls made. */
            const calls: unknown[] = [];
            validateConfig(configWith({
              inputs: function inputs(options: unknown,) {
                calls.push(options,);
                return 'unrestricted';
              },
              setting: 'off',
            },),);
            expect(calls,).toEqual([],);
          },
        },),
        it({
          name: 'rejects invalid static inputs and throwing or invalid functions',
          fn: async function testConfigFailures(): Promise<void> {
            expect(rejection(function validate() {
              return validateConfig(configWith({ inputs: { external: [{ kind: 'network', }, ], }, },),);
            },),).toContain('Policy probe/check has invalid inputs',);
            expect(rejection(function validate() {
              return validateConfig(configWith({ inputs: { external: [{ kind: 'worktree', pathspecs: [], },], }, },),);
            },),).toContain('worktree pathspecs must be non-empty',);
            expect(rejection(function validate() {
              return validateConfig(configWith({
                inputs: function inputs(): never {
                  throw new Error('broken',);
                },
              },),);
            },),).toContain('inputs function threw: broken',);
            expect(rejection(function validate() {
              return validateConfig(configWith({
                inputs: function inputs() {
                  return 42;
                },
              },),);
            },),).toContain('Policy probe/check has invalid inputs',);
          },
        },),
        it({
          name: 'validates options before inputs, so an option failure wins',
          fn: async function testOrder(): Promise<void> {
            expect(rejection(function validate() {
              return validateConfig(configWith({
                inputs: function inputs(): never {
                  throw new Error('broken',);
                },
                options: v.object({ executable: v.string(), },),
                setting: ['error', { executable: 7, },],
              },),);
            },),).toContain('options failed Valibot validation',);
          },
        },),
      ],
    },),
  ],
},);
