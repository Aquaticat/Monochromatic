import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import * as v from 'valibot';
import { validateConfig, } from './config-validation.ts';
import {
  MjsValidationError,
  validateMjs,
} from './mjs-validator.ts';

/**
 * Encodes MJS fixture source.
 *
 * @param source - JavaScript source text
 *
 * @returns UTF-8 source bytes
 */
function encode(source: string,): Uint8Array {
  return new TextEncoder().encode(source,);
}

await describe({
  name: 'MJS and config validation',
  children: [
    it({
      name: 'allows only static Node built-ins',
      fn: async function testNodeBuiltins() {
        /** Valid built-in import summary. */
        const result = validateMjs({
          bytes: encode("import fs from 'node:fs'; export { join } from 'node:path'; export default { fs };",),
          sourceName: 'valid.mjs',
        },);
        expect(result.nodeBuiltins,).toEqual(['node:fs', 'node:path',],);
      },
    },),
    it({
      name: 'rejects static local and package imports',
      fn: async function testRejectedImports() {
        expect(() => validateMjs({
          bytes: encode("import './local.mjs';",),
          sourceName: 'relative.mjs',
        },),).toThrow(MjsValidationError,);
        expect(() => validateMjs({
          bytes: encode("export { x } from 'package';",),
          sourceName: 'package.mjs',
        },),).toThrow(MjsValidationError,);
      },
    },),
    it({
      name: 'permits dynamic built-ins but rejects dynamic extra assets',
      fn: async function testDynamicImport() {
        expect(validateMjs({
          bytes: encode("export default { load: () => import('node:fs') };",),
          sourceName: 'dynamic-builtin.mjs',
        },).nodeBuiltins,).toEqual(['node:fs',],);
        expect(() => validateMjs({
          bytes: encode("export default { load: () => import('./live.mjs') };",),
          sourceName: 'dynamic-local.mjs',
        },),).toThrow(MjsValidationError,);
        expect(() => validateMjs({
          bytes: encode('export default { load: target => import(target) };',),
          sourceName: 'dynamic-computed.mjs',
        },),).toThrow(MjsValidationError,);
      },
    },),
    it({
      name: 'rejects syntax errors before execution',
      fn: async function testSyntaxError() {
        expect(() => validateMjs({
          bytes: encode('export default {',),
          sourceName: 'invalid.mjs',
        },),).toThrow(MjsValidationError,);
      },
    },),
    it({
      name: 'validates namespaced policies and Valibot options',
      fn: async function testValidConfig() {
        /** Runtime policy options schema. */
        const options = v.object({ suffix: v.string(), },);
        /** Runtime-authoritative config result. */
        const result = validateConfig({
          plugins: {
            example: {
              name: 'plugin-example',
              policies: [{
                name: 'suffix',
                defaultSeverity: 'error',
                warnSafe: true,
                triggers: ['direct-check',],
                options,
                check: function checkSuffix() { return Promise.resolve([],); },
              },],
            },
          },
          policies: {
            'example/suffix': ['warn', { suffix: '.ts', },],
          },
        },);
        expect(result.registeredPolicies.map(function policyId(policy,) {
          return policy.name;
        },),).toEqual([
      'require-root',
      'linked-worktree-only',
      'branch-worktree-only',
      'add-explicit',
      'final-newline',
      'example/suffix',
    ],);
        expect(result.policySeverities['example/suffix'],).toBe('warn',);
        expect(result.policyOptions.get('example/suffix',),).toEqual({ suffix: '.ts', },);
      },
    },),
    it({
      name: 'rejects unknown IDs duplicate names and invalid options',
      fn: async function testInvalidConfig() {
        /** Minimal runtime policy declaration. */
        const policy = {
          name: 'check',
          defaultSeverity: 'error',
          warnSafe: true,
          triggers: ['direct-check',],
          options: v.string(),
          check: function checkPolicy() { return Promise.resolve([],); },
        };
        expect(() => validateConfig({
          plugins: { example: { name: 'example', policies: [policy,], }, },
          policies: { missing: 'error', },
        },),).toThrow(Error,);
        expect(() => validateConfig({
          plugins: { example: { name: 'example', policies: [policy, policy,], }, },
        },),).toThrow(Error,);
        expect(() => validateConfig({
          plugins: { example: { name: 'example', policies: [policy,], }, },
          policies: { 'example/check': ['error', 1,], },
        },),).toThrow(Error,);
      },
    },),
  ],
},);
