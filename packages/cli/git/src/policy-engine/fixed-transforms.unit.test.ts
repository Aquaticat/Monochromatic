import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  applyFixedTransforms,
  FIXED_TRANSFORM_DEPENDENCIES,
} from './fixed-transforms.ts';

await describe({
  name: 'fixed transform stage',
  children: [
    it({
      name: 'applies atomic push idempotently after global options',
      fn: async function testAtomicPushIdempotence() {
        /** Stable raw arguments retained across passes. */
        const rawArgs = ['-C', '/tmp', 'push', 'origin', 'main',] as const;
        /** First fixed-transform pass. */
        const first = await applyFixedTransforms({ args: rawArgs, rawArgs, sequence: 0, },);
        /** Repeated pass over transformed arguments. */
        const second = await applyFixedTransforms({ args: first.args, rawArgs, sequence: 0, },);
        expect(first.events,).toEqual([],);
        expect(first.args,).toEqual(['-C', '/tmp', 'push', '--atomic', 'origin', 'main',],);
        expect(second.args,).toEqual(first.args,);
      },
    },),
    it({
      name: 'preserves explicit atomic override idempotently',
      fn: async function testAtomicOverride() {
        /** Stable raw explicit override. */
        const rawArgs = ['push', '--no-atomic', 'origin',] as const;
        /** Explicit opt-out pass. */
        const first = await applyFixedTransforms({ args: rawArgs, rawArgs, sequence: 0, },);
        /** Repeated explicit opt-out pass. */
        const second = await applyFixedTransforms({ args: first.args, rawArgs, sequence: 0, },);
        expect(first.args,).toEqual(['push', '--no-atomic', 'origin',],);
        expect(second.args,).toEqual(first.args,);
      },
    },),
    it({
      name: 'applies commit only idempotently',
      fn: async function testCommitOnlyIdempotence() {
        /** Stable raw commit arguments. */
        const rawArgs = ['commit', '-m', 'message', 'file.ts',] as const;
        /** First commit transform pass. */
        const first = await applyFixedTransforms({ args: rawArgs, rawArgs, sequence: 0, },);
        /** Repeated commit transform pass. */
        const second = await applyFixedTransforms({ args: first.args, rawArgs, sequence: 0, },);
        expect(first.args,).toEqual(['commit', '-o', '-m', 'message', 'file.ts',],);
        expect(second.args,).toEqual(first.args,);
      },
    },),
    it({
      name: 'applies status hints override idempotently',
      fn: async function testStatusHintsIdempotence() {
        /** Stable raw status arguments. */
        const rawArgs = ['status',] as const;
        /** First status transform pass. */
        const first = await applyFixedTransforms({ args: rawArgs, rawArgs, sequence: 0, },);
        /** Repeated status transform pass. */
        const second = await applyFixedTransforms({ args: first.args, rawArgs, sequence: 0, },);
        expect(first.args,).toEqual(['-c', 'advice.statusHints=false', 'status',],);
        expect(second.args,).toEqual(first.args,);
      },
    },),
    it({
      name: 'retains commit escape idempotently after stripping',
      fn: async function testCommitEscapeIdempotence() {
        /** Stable raw escaped commit arguments. */
        const rawArgs = ['commit', '--no-enforce-only', '-m', 'message',] as const;
        /** First escape-stripping pass. */
        const first = await applyFixedTransforms({ args: rawArgs, rawArgs, sequence: 0, },);
        /** Repeated pass retaining invocation escape state from raw facts. */
        const second = await applyFixedTransforms({ args: first.args, rawArgs, sequence: 0, },);
        expect(first.args,).toEqual(['commit', '-m', 'message',],);
        expect(second.args,).toEqual(first.args,);
        expect(second.events,).toEqual([],);
      },
    },),
    it({
      name: 'converts unexpected transform failure into engine failure',
      fn: async function testUnexpectedTransformFailure() {
        /** Stable raw status command. */
        const rawArgs = ['status',] as const;
        /** Injected transform failure result. */
        const result = await applyFixedTransforms({
          args: rawArgs,
          rawArgs,
          sequence: 3,
          dependencies: {
            ...FIXED_TRANSFORM_DEPENDENCIES,
            atomicPush: function throwAtomicFailure() {
              throw new Error('injected atomic failure',);
            },
          },
        },);
        expect(result.complete,).toBe(false,);
        expect(result.events,).toEqual([{
          schemaVersion: 1,
          sequence: 3,
          type: 'engine-failure',
          code: 'core-incomplete',
          message: 'injected atomic failure',
        },],);
      },
    },),
    it({
      name: 'emits structured non-configurable commit rejection',
      fn: async function testCommitCoreFinding() {
        /** Rejected raw commit arguments. */
        const rawArgs = ['commit', '-a', '-m', 'message',] as const;
        /** Fixed-core rejection result. */
        const result = await applyFixedTransforms({ args: rawArgs, rawArgs, sequence: 4, },);
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
