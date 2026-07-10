/** Repository policy plugin unit tests. @module */
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  forbiddenRootContext,
  hasForbiddenRootContext,
  repositoryPolicyPlugin,
} from '../dist/final/node/index.mjs';

await describe({
  name: forbiddenRootContext.name,
  children: [
    it({
      name: 'declares warning-safe error default and lifecycle triggers',
      fn: async function testPolicyMetadata(): Promise<void> {
        expect(repositoryPolicyPlugin.name).toBe('repository',);
        expect(forbiddenRootContext.defaultSeverity).toBe('error',);
        expect(forbiddenRootContext.warnSafe).toBe(true,);
        expect(forbiddenRootContext.triggers).toEqual(['pre-forward', 'direct-check',],);
      },
    },),
    it({
      name: 'matches only non-deleted root context candidate',
      fn: async function testCandidatePath(): Promise<void> {
        expect(hasForbiddenRootContext([{ path: 'CONTEXT.md', change: 'added', }],)).toBe(true,);
        expect(hasForbiddenRootContext([{ path: 'CONTEXT.md', change: 'modified', }],)).toBe(true,);
        expect(hasForbiddenRootContext([{ path: 'CONTEXT.md', change: 'deleted', }],)).toBe(false,);
        expect(hasForbiddenRootContext([{ path: 'nested/CONTEXT.md', change: 'added', }],)).toBe(false,);
        expect(hasForbiddenRootContext([{ path: '--', change: 'added', }],)).toBe(false,);
      },
    },),
  ],
},);
