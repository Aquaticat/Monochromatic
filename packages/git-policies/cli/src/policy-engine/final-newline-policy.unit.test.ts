/**
 * Core final-newline policy tests.
 *
 * @module
 */
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { ABSENT_GIT_VALUE, } from '../api/context-types.ts';
import type {
  CandidateFile,
  PolicyContext,
  PolicyTrigger,
} from '../api/policy-types.ts';
import {
  isFinalNewlineExcluded,
  normalizeFinalNewline,
} from './final-newline-normalize.ts';
import { createFinalNewlinePatch, } from './final-newline-patch.ts';
import { finalNewlinePolicy, } from './final-newline-policy.ts';

/** Text fixture encoder. */
const ENCODER = new TextEncoder();
/** Text fixture decoder. */
const DECODER = new TextDecoder();
/** Fixture Git object identity. */
const REVISION = '1111111111111111111111111111111111111111';

/**
 * Encodes fixture text.
 *
 * @param value - fixture text
 *
 * @returns encoded bytes
 */
function bytes(value: string,): Uint8Array {
  return ENCODER.encode(value,);
}

/**
 * Decodes changed normalization result.
 *
 * @param value - input text
 *
 * @returns replacement text or unchanged marker
 */
function normalizedText(value: string,): string {
  /** Exact normalization result. */
  const result = normalizeFinalNewline(bytes(value,),);
  if (result.kind === 'unchanged')
    return 'unchanged';
  return DECODER.decode(result.bytes,);
}

/**
 * Creates ordinary candidate fixture.
 *
 * @param path - repository path
 *
 * @param value - exact text bytes
 *
 * @returns candidate fixture
 */
function candidate({
  path,
  value,
}: Readonly<{
  path: string;
  value: string;
}>,): CandidateFile {
  return {
    targetId: `target:${path}`,
    path,
    revision: REVISION,
    mode: 'regular',
    change: 'modified',
    bytes: function loadBytes(): Promise<Uint8Array> {
      return Promise.resolve(bytes(value,),);
    },
  };
}

/**
 * Creates lifecycle context over exact candidates.
 *
 * @param trigger - policy lifecycle trigger
 *
 * @param candidates - exact candidate fixtures
 *
 * @returns policy context
 */
function context({
  trigger,
  candidates,
}: Readonly<{
  trigger: PolicyTrigger;
  candidates: readonly CandidateFile[];
}>,): PolicyContext {
  return {
    candidateVersion: 0,
    trigger,
    command: {
      rawArgs: [],
      transformedArgs: [],
      subcommand: ABSENT_GIT_VALUE,
      effectiveCwd: '/repo',
      repositoryRoot: '/repo',
      escapedPolicyIds: new Set(),
    },
    git: {
      candidates: function loadCandidates() { return Promise.resolve(candidates,); },
      headOid: function headOid() { return Promise.resolve(ABSENT_GIT_VALUE,); },
      landedCommitOid: function landedCommitOid() { return Promise.resolve(ABSENT_GIT_VALUE,); },
      pushUpdates: function pushUpdates() { return Promise.resolve([],); },
    },
    signal: new AbortController().signal,
  };
}

await describe({
  name: 'core final-newline policy',
  children: [
    it({
      name: 'normalizes only terminal LF bytes',
      fn: async function testNormalization() {
        expect(normalizedText('value',),).toBe('value\n',);
        expect(normalizedText('value\n',),).toBe('unchanged',);
        expect(normalizedText('value\n\n\n',),).toBe('value\n',);
        expect(normalizedText('\n\n',),).toBe('\n',);
        expect(normalizedText('first\r\nsecond',),).toBe('first\r\nsecond\n',);
        expect(normalizedText('first\r\nsecond\r\n',),).toBe('unchanged',);
      },
    },),
    it({
      name: 'preserves empty and binary-looking bytes',
      fn: async function testBinaryPreservation() {
        expect(normalizeFinalNewline(new Uint8Array(),).kind,).toBe('unchanged',);
        expect(normalizeFinalNewline(new Uint8Array([
          1,
          0,
          2,
        ],),).kind,).toBe('unchanged',);
        expect(normalizeFinalNewline(new Uint8Array([
          0xC3,
          0x28,
        ],),).kind,).toBe('unchanged',);
      },
    },),
    it({
      name: 'matches only exact exclusion families',
      fn: async function testExclusions() {
        expect(isFinalNewlineExcluded('packages/fuzz/forbidden-strings/seeds/a',),).toBe(true,);
        expect(isFinalNewlineExcluded('packages/rust-module/forbidden-regex.fuzz/seeds/a',),).toBe(true,);
        expect(isFinalNewlineExcluded('packages/test-fixture/toml-edit/src/a.toml',),).toBe(true,);
        expect(isFinalNewlineExcluded('pkg/dist/final/node/index.mjs',),).toBe(true,);
        expect(isFinalNewlineExcluded('dist/final/node/index.d.mts',),).toBe(true,);
        expect(isFinalNewlineExcluded('packages/fuzz/forbidden-strings/corpus/a',),).toBe(false,);
        expect(isFinalNewlineExcluded('packages/fuzz/other/seeds/a',),).toBe(false,);
        expect(isFinalNewlineExcluded('pkg/dist/final/browser/index.mjs',),).toBe(false,);
        expect(isFinalNewlineExcluded('pkg/dist/final/node',),).toBe(false,);
      },
    },),
    it({
      name: 'builds complete ordinary patch with missing-newline marker',
      fn: async function testPatch() {
        /** Missing-newline candidate bytes. */
        const original = bytes('value',);
        /** Canonical replacement bytes. */
        const replacement = bytes('value\n',);
        /** Decoded generated patch. */
        const patch = DECODER.decode(createFinalNewlinePatch({
          targetId: 'target:a.txt',
          path: 'a.txt',
          revision: REVISION,
          mode: 'executable',
          original,
          replacement,
        },).bytes,);
        expect(patch,).toContain(`index ${REVISION}..0000000000000000000000000000000000000000 100755`,);
        expect(patch,).toContain('@@ -1,1 +1,1 @@\n-value\n\\ No newline at end of file\n+value\n',);
      },
    },),
    it({
      name: 'builds complete collapse patch for repeated terminal LF bytes',
      fn: async function testCollapsePatch() {
        /** Repeated-final-LF candidate bytes. */
        const original = bytes('value\n\n',);
        /** Canonical one-final-LF replacement bytes. */
        const replacement = bytes('value\n',);
        /** Decoded generated collapse patch. */
        const patch = DECODER.decode(createFinalNewlinePatch({
          targetId: 'target:a.txt',
          path: 'a.txt',
          revision: REVISION,
          mode: 'regular',
          original,
          replacement,
        },).bytes,);
        expect(patch,).toContain('@@ -1,2 +1,1 @@\n-value\n-\n+value\n',);
      },
    },),
    it({
      name: 'attaches patches only at fixable lifecycle points',
      fn: async function testLifecyclePatches() {
        /** Noncanonical ordinary candidate. */
        const input = candidate({ path: 'value.txt', value: 'value', },);
        /** Read-only direct-check findings. */
        const checked = await finalNewlinePolicy.check({
          context: context({ trigger: 'direct-check', candidates: [input,], },),
          options: undefined,
        },);
        /** Fixable pre-forward findings. */
        const fixed = await finalNewlinePolicy.check({
          context: context({ trigger: 'pre-forward', candidates: [input,], },),
          options: undefined,
        },);
        expect(checked,).toHaveLength(1,);
        expect(checked[0]?.patch,).toBeUndefined();
        expect(fixed,).toHaveLength(1,);
        expect(fixed[0]?.patch?.targetId,).toBe(input.targetId,);
      },
    },),
    it({
      name: 'reads only landed-delta candidates after commit',
      fn: async function testPostCommitDelta() {
        /** Unchanged landed candidate whose bytes must remain unread. */
        const unchanged: CandidateFile = {
          ...candidate({ path: 'stable.txt', value: 'stable', },),
          change: 'unchanged',
          bytes: function rejectRead(): Promise<Uint8Array> {
            throw new Error('Unchanged landed candidate bytes were read.',);
          },
        };
        /** Changed landed candidate requiring one finding. */
        const changed = candidate({ path: 'changed.txt', value: 'changed', },);
        /** Read-only post-commit findings limited to landed delta. */
        const findings = await finalNewlinePolicy.check({
          context: context({
            trigger: 'post-commit',
            candidates: [unchanged, changed,],
          },),
          options: undefined,
        },);
        expect(findings,).toHaveLength(1,);
        expect(findings[0]?.path,).toBe('changed.txt',);
      },
    },),
    it({
      name: 'skips deleted nonordinary excluded and canonical candidates',
      fn: async function testSkippedCandidates() {
        /** Candidate whose bytes must remain unread. */
        const unreadable: CandidateFile = {
          ...candidate({ path: 'link', value: 'ignored', },),
          mode: 'symlink',
          bytes: function rejectRead(): Promise<Uint8Array> {
            throw new Error('Skipped candidate bytes were read.',);
          },
        };
        /** Deleted candidate whose bytes must remain unread. */
        const deleted: CandidateFile = {
          ...unreadable,
          path: 'deleted.txt',
          mode: 'regular',
          change: 'deleted',
        };
        /** Excluded candidate whose bytes must remain unread. */
        const excluded: CandidateFile = {
          ...unreadable,
          path: 'pkg/dist/final/node/index.mjs',
          mode: 'regular',
        };
        /** Canonical candidate. */
        const canonical = candidate({ path: 'value.txt', value: 'value\n', },);
        expect(await finalNewlinePolicy.check({
          context: context({
            trigger: 'manual-push',
            candidates: [
              unreadable,
              deleted,
              excluded,
              canonical,
            ],
          },),
          options: undefined,
        },),).toEqual([],);
      },
    },),
  ],
},);
