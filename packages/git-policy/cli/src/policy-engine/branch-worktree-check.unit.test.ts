import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { BRANCH_WORKTREE_ESCAPE_HATCH, } from '../parser/branch-create.ts';
import { checkBranchWorktree as branchWorktreeOnly, } from './branch-worktree-check.ts';

/**
 * Captures asynchronous error from branch-worktree-only invocation.
 *
 * @param args - Git argv to pass through branch-worktree-only rule.
 *
 * @returns Error thrown by rule, or `undefined` when rule passes.
 *
 * @example
 * ```ts
 * const caught = await catchBranchWorktreeOnlyError(['switch', '-c', 'topic']);
 * expect(caught).toBeInstanceOf(Error);
 * ```
 */
async function catchBranchWorktreeOnlyError(args: readonly string[],): Promise<unknown> {
  try {
    await branchWorktreeOnly(args,);
  }
  catch (error) {
    return error;
  }
  return undefined;
}

/**
 * Asserts that argv is rejected as current-worktree branch creation.
 *
 * @param args - Git argv to pass through branch-worktree-only rule.
 *
 * @returns Nothing after rejection is asserted.
 *
 * @example
 * ```ts
 * await expectBranchCreationRejected(['branch', 'topic']);
 * ```
 */
async function expectBranchCreationRejected(args: readonly string[],): Promise<void> {
  /**
   * Error thrown for rejected branch creation.
   */
  const caught = await catchBranchWorktreeOnlyError(args,);

  expect(caught,).toBeInstanceOf(Error,);
  expect((caught as Error).message,).toContain(
    'branch creation is rejected in the current worktree',
  );
}

await describe({
  name: branchWorktreeOnly.name,
  children: [
    it({
      name: 'passes worktree branch creation through unchanged',
      fn: async function testWorktreeAddBranch(): Promise<void> {
        /** Worktree add argv that creates a branch and checkout together. */
        const args = [
          'worktree',
          'add',
          '-b',
          'topic',
          '../topic',
        ] as const;

        expect(await branchWorktreeOnly(args,),).toBe(args,);
      },
    },),
    it({
      name: 'passes branch listing patterns through unchanged',
      fn: async function testBranchListPattern(): Promise<void> {
        expect(await branchWorktreeOnly([
          'branch',
          '--list',
          'feature/*',
        ],),).toEqual([
          'branch',
          '--list',
          'feature/*',
        ],);
      },
    },),
    it({
      name: 'passes branch deletion and rename through unchanged',
      fn: async function testBranchDeleteRename(): Promise<void> {
        expect(await branchWorktreeOnly([
          'branch',
          '--delete',
          'old-topic',
        ],),).toEqual([
          'branch',
          '--delete',
          'old-topic',
        ],);
        expect(await branchWorktreeOnly([
          'branch',
          '--move',
          'old-topic',
          'new-topic',
        ],),).toEqual([
          'branch',
          '--move',
          'old-topic',
          'new-topic',
        ],);
      },
    },),
    it({
      name: 'passes checkout path mode through unchanged',
      fn: async function testCheckoutPathMode(): Promise<void> {
        expect(await branchWorktreeOnly([
          'checkout',
          '--',
          'file.txt',
        ],),).toEqual([
          'checkout',
          '--',
          'file.txt',
        ],);
      },
    },),
    it({
      name: 'strips escape hatch while preserving option values',
      fn: async function testEscapeHatchStrip(): Promise<void> {
        expect(await branchWorktreeOnly([
          'checkout',
          '-b',
          BRANCH_WORKTREE_ESCAPE_HATCH,
          BRANCH_WORKTREE_ESCAPE_HATCH,
        ],),).toEqual([
          'checkout',
          '-b',
          BRANCH_WORKTREE_ESCAPE_HATCH,
        ],);
      },
    },),
    it({
      name: 'rejects git branch creation and copy modes',
      fn: async function testBranchCreateAndCopy(): Promise<void> {
        await expectBranchCreationRejected([
          'branch',
          'topic',
        ],);
        await expectBranchCreationRejected([
          'branch',
          '--cop',
          'old-topic',
          'new-topic',
        ],);
      },
    },),
    it({
      name: 'rejects checkout branch creation modes',
      fn: async function testCheckoutCreateModes(): Promise<void> {
        await expectBranchCreationRejected([
          'checkout',
          '-b',
          'topic',
        ],);
        await expectBranchCreationRejected([
          'checkout',
          '--orphan',
          'topic',
        ],);
        await expectBranchCreationRejected([
          'checkout',
          '--track',
          'origin/topic',
        ],);
      },
    },),
    it({
      name: 'rejects switch branch creation modes',
      fn: async function testSwitchCreateModes(): Promise<void> {
        await expectBranchCreationRejected([
          'switch',
          '--cre',
          'topic',
        ],);
        await expectBranchCreationRejected([
          'switch',
          '--force-c',
          'topic',
        ],);
        await expectBranchCreationRejected([
          'switch',
          '--track',
          'origin/topic',
        ],);
      },
    },),
  ],
},);
