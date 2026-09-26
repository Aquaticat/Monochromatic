/**
 Context-tolerant containment of a landed change in prepared bytes, on zero-context patches real Git writes.

 @module
 */
import { execFileSync, } from 'node:child_process';
import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { internalTestExports, } from '../../dist/final/node/index.mjs';
import {
  FIXED_IDENTITY,
  REAL_GIT,
} from './commit-landing-fixture.unit.test.ts';

const {
  containsLandedChange,
  parseIndexedPatch,
  splitKeepingNewlines,
} = internalTestExports;

/**
 Twelve numbered lines with some replaced and some removed.

 @param replaced - replacement lines per index; an empty list removes the line

 @returns file text
 */
function lines(replaced: Readonly<Record<number, readonly string[]>> = {},): string {
  return Array.from({ length: 12, }, function line(_unused, index,): string {
    return (replaced[index] ?? [`line ${String(index,)}`,]).map(function withNewline(text,): string {
      return `${text}\n`;
    },).join('',);
  },).join('',);
}

/**
 Decides containment with the zero-context patches real Git writes.

 @param base - base text

 @param landed - landed text

 @param prepared - prepared text

 @returns whether the prepared text contains the landed change
 */
async function contains({
  base,
  landed,
  prepared,
}: Readonly<{
  base: string;
  landed: string;
  prepared: string;
}>,): Promise<boolean> {
  /** Scratch worktree. */
  const path = await mkdtemp(join(tmpdir(), 'cli-git-containment-',),);
  await using _removed = {
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(path, { recursive: true, force: true, },);
    },
  };
  /** Hermetic environment. */
  const env = { ...process.env, ...FIXED_IDENTITY, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', };
  execFileSync(REAL_GIT, ['init', '--quiet', path,], { env, },);
  await writeFile(join(path, 'f',), base,);
  execFileSync(REAL_GIT, ['add', 'f',], { cwd: path, env, },);
  /**
   Zero-context hunks from the base to a text.

   @param text - changed text

   @returns hunks
   */
  async function hunks(text: string,): Promise<Parameters<typeof containsLandedChange>[0]['landed']> {
    await writeFile(join(path, 'f',), text,);
    return parseIndexedPatch(execFileSync(REAL_GIT, ['diff', '--unified=0', '--no-color', '--', 'f',], { cwd: path, env, },).toString('latin1',),).get('f',) ?? [];
  }
  return containsLandedChange({
    landed: await hunks(landed,),
    prepared: await hunks(prepared,),
    base: splitKeepingNewlines(base,),
  },);
}

await describe({
  name: 'containment of a landed change',
  children: [
    it({
      name: 'an own edit directly after, before, or inserted next to the landed edit still contains it',
      fn: async function testAdjacent(): Promise<void> {
        /** Landed edit of line 5. */
        const landed = lines({ 5: ['landed',], },);
        expect(await contains({ base: lines(), landed, prepared: lines({ 5: ['landed',], 6: ['mine',], },), },),).toBe(true,);
        expect(await contains({ base: lines(), landed, prepared: lines({ 4: ['mine',], 5: ['landed',], },), },),).toBe(true,);
        expect(await contains({ base: lines(), landed, prepared: lines({ 5: ['landed', 'inserted',], },), },),).toBe(true,);
        expect(await contains({ base: lines(), landed, prepared: landed, },),).toBe(true,);
      },
    },),
    it({
      name: 'an own edit on both sides, a missing landed edit, or a different edit of the same line is not contained',
      fn: async function testNotContained(): Promise<void> {
        /** Landed edit of line 5. */
        const landed = lines({ 5: ['landed',], },);
        expect(await contains({ base: lines(), landed, prepared: lines({ 4: ['mine',], 5: ['landed',], 6: ['also mine',], },), },),).toBe(false,);
        expect(await contains({ base: lines(), landed, prepared: lines({ 6: ['mine',], },), },),).toBe(false,);
        expect(await contains({ base: lines(), landed, prepared: lines({ 5: ['other',], },), },),).toBe(false,);
        expect(await contains({ base: lines(), landed, prepared: lines({ 10: ['far',], },), },),).toBe(false,);
      },
    },),
    it({
      name: 'a landed deletion is contained only when the deleted line is gone',
      fn: async function testDeletion(): Promise<void> {
        /** Landed deletion of line 5. */
        const landed = lines({ 5: [], },);
        expect(await contains({ base: lines(), landed, prepared: lines({ 5: [], 6: ['mine',], },), },),).toBe(true,);
        expect(await contains({ base: lines(), landed, prepared: lines({ 6: ['mine',], },), },),).toBe(false,);
        expect(await contains({ base: lines(), landed, prepared: lines({ 10: ['far',], },), },),).toBe(false,);
        // The deleted line rewritten in place is a modify/delete conflict.
        expect(await contains({ base: lines(), landed, prepared: lines({ 5: ['line 5 rewritten',], },), },),).toBe(false,);
      },
    },),
    it({
      name: 'several landed hunks inside one prepared hunk need the base lines between them unchanged',
      fn: async function testSeveral(): Promise<void> {
        /** Landed edits of lines 3 and 5. */
        const landed = lines({ 3: ['landed 3',], 5: ['landed 5',], },);
        expect(await contains({ base: lines(), landed, prepared: lines({ 3: ['landed 3',], 5: ['landed 5',], 6: ['mine',], },), },),).toBe(true,);
        expect(await contains({ base: lines(), landed, prepared: lines({ 3: ['landed 3',], 4: ['mine',], 5: ['landed 5',], },), },),).toBe(false,);
      },
    },),
  ],
},);
