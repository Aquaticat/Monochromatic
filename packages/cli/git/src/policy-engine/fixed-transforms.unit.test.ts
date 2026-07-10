import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { applyFixedTransforms, } from './fixed-transforms.ts';

await describe({
  name: 'fixed transform stage',
  children: [
    it({
      name: 'applies atomic push idempotently after global options',
      fn: async function testAtomicPushIdempotence() {
        /** First fixed-transform pass. */
        const first = await applyFixedTransforms({
          args: ['-C', '/tmp', 'push', 'origin', 'main',],
          sequence: 0,
        },);
        /** Repeated pass over transformed arguments. */
        const second = await applyFixedTransforms({ args: first.args, sequence: 0, },);
        expect(first.events,).toEqual([],);
        expect(first.args,).toEqual(['-C', '/tmp', 'push', '--atomic', 'origin', 'main',],);
        expect(second.args,).toEqual(first.args,);
      },
    },),
    it({
      name: 'preserves explicit atomic override idempotently',
      fn: async function testAtomicOverride() {
        /** Explicit opt-out pass. */
        const first = await applyFixedTransforms({
          args: ['push', '--no-atomic', 'origin',],
          sequence: 0,
        },);
        /** Repeated explicit opt-out pass. */
        const second = await applyFixedTransforms({ args: first.args, sequence: 0, },);
        expect(first.args,).toEqual(['push', '--no-atomic', 'origin',],);
        expect(second.args,).toEqual(first.args,);
      },
    },),
    it({
      name: 'applies commit only idempotently',
      fn: async function testCommitOnlyIdempotence() {
        /** First commit transform pass. */
        const first = await applyFixedTransforms({
          args: ['commit', '-m', 'message', 'file.ts',],
          sequence: 0,
        },);
        /** Repeated commit transform pass. */
        const second = await applyFixedTransforms({ args: first.args, sequence: 0, },);
        expect(first.args,).toEqual(['commit', '-o', '-m', 'message', 'file.ts',],);
        expect(second.args,).toEqual(first.args,);
      },
    },),
    it({
      name: 'applies status hints override idempotently',
      fn: async function testStatusHintsIdempotence() {
        /** First status transform pass. */
        const first = await applyFixedTransforms({ args: ['status',], sequence: 0, },);
        /** Repeated status transform pass. */
        const second = await applyFixedTransforms({ args: first.args, sequence: 0, },);
        expect(first.args,).toEqual(['-c', 'advice.statusHints=false', 'status',],);
        expect(second.args,).toEqual(first.args,);
      },
    },),
    it({
      name: 'emits structured non-configurable commit rejection',
      fn: async function testCommitCoreFinding() {
        /** Fixed-core rejection result. */
        const result = await applyFixedTransforms({
          args: ['commit', '-a', '-m', 'message',],
          sequence: 4,
        },);
        expect(result.events,).toEqual([{
          schemaVersion: 1,
          sequence: 4,
          type: 'core-finding',
          trigger: 'pre-forward',
          coreId: 'commit-only',
          code: 'commit-only/all-flag',
          message: 'cli-git: git commit rejects -a/--all because it stages every tracked modification before committing. Stage paths explicitly and commit with git commit -m <msg> <path>, or pass --no-enforce-only to bypass for this invocation.',
        },],);
      },
    },),
  ],
},);
