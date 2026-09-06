import { createHash, } from 'node:crypto';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  AUTOFIX_CODE,
  createFullContentPatch,
  isMarkdownPath,
  MarkdownLintPluginError,
  markdownLintPlugin,
  markdownLintPolicy,
  rewriteCandidates,
  VIOLATION_CODE,
} from '@monochromatic-dev/git-policy-markdown-lint';

import {
  candidateOf,
  type FixtureCandidate,
  FIXTURE_IMAGE_BYTES,
  FIXTURE_OBJECT_BASE,
  makeLfsRepo,
  MARKDOWN_LINT_COMMAND,
} from './markdown-lint-fixture.ts';

/**
 Text encoder shared by every case.
 */
const ENCODER = new TextEncoder();

/**
 Text decoder shared by every case.
 */
const DECODER = new TextDecoder();

/**
 Object URL the rule produces for the fixture image referenced from `pkg/README.md`.
 */
const FIXTURE_URL = `${FIXTURE_OBJECT_BASE}/${createHash('sha256',)
  .update(FIXTURE_IMAGE_BYTES,)
  .digest('hex',)}/pkg/asset/shot.png`;

/**
 README source with one relative LFS image.
 */
const RELATIVE_README = '# Player\n\n![shot](asset/shot.png)\n';

/**
 Rules the fixture runs by default.
 */
const RULES: readonly string[] = ['lfs-image-url',];

/**
 Run the adapter over candidates against a fixture repository.

 @param repositoryRoot - fixture root

 @param candidates - candidates under test

 @param canApplyPatches - lifecycle patch permission

 @param rules - rule ids, defaulting to the LFS rule

 @param exclude - exclude patterns, defaulting to none

 @param command - command override, defaulting to the workspace CLI

 @returns adapter findings
 */
async function rewrite({
  repositoryRoot,
  candidates,
  canApplyPatches = true,
  rules = RULES,
  exclude = [],
  command = MARKDOWN_LINT_COMMAND,
}: Readonly<{
  repositoryRoot: string;
  candidates: readonly FixtureCandidate[];
  canApplyPatches?: boolean;
  rules?: readonly string[];
  exclude?: readonly string[];
  command?: readonly string[];
}>,): ReturnType<typeof rewriteCandidates> {
  return await rewriteCandidates({
    command,
    rules,
    exclude,
    repositoryRoot,
    canApplyPatches,
    candidates,
    signal: new AbortController().signal,
  },);
}

/**
 Run an operation and return what it threw, or `undefined` when it settled.

 @param operation - operation expected to reject

 @returns caught value
 */
async function captureRejection(operation: () => Promise<unknown>,): Promise<unknown> {
  try {
    await operation();
    return undefined;
  }
  catch (error) {
    return error;
  }
}

await describe({
  name: '',
  children: [
    describe({
      name: 'policy definition',
      children: [
        it({
          name: 'is warn-safe, defaults to warn, and covers every fix-capable lifecycle',
          fn: async function definition() {
            expect(markdownLintPolicy.name,).toBe('autofix',);
            expect(markdownLintPolicy.defaultSeverity,).toBe('warn',);
            expect(markdownLintPolicy.warnSafe,).toBe(true,);
            expect([...markdownLintPolicy.triggers,],).toEqual([
              'pre-forward',
              'post-commit',
              'manual-push',
              'direct-check',
              'direct-fix',
            ],);
            expect(markdownLintPlugin.name,).toBe('markdown-lint',);
            expect(markdownLintPlugin.policies,).toHaveLength(1,);
          },
        },),
      ],
    },),
    describe({
      name: isMarkdownPath.name,
      children: [
        it({
          name: 'accepts .md and .mdx in any case and rejects other paths',
          fn: async function classify() {
            expect(isMarkdownPath('doc/a.md',),).toBe(true,);
            expect(isMarkdownPath('src/page.MDX',),).toBe(true,);
            expect(isMarkdownPath('src/a.ts',),).toBe(false,);
            expect(isMarkdownPath('README',),).toBe(false,);
          },
        },),
      ],
    },),
    describe({
      name: createFullContentPatch.name,
      children: [
        it({
          name: 'emits one whole-file hunk with newline markers where needed',
          fn: async function shape() {
            /**
             Patch replacing a two-line file lacking a final newline.
             */
            const patch = createFullContentPatch({
              targetId: 't1',
              path: 'doc/a.md',
              revision: 'abc123',
              mode: 'regular',
              original: ENCODER.encode('one\ntwo',),
              replacement: ENCODER.encode('uno\ndos\n',),
            },);
            expect(patch.kind,).toBe('git-unified',);
            expect(patch.targetId,).toBe('t1',);
            expect(patch.path,).toBe('doc/a.md',);
            expect(DECODER.decode(patch.bytes,),).toBe([
              'diff --git a/doc/a.md b/doc/a.md',
              'index abc123..000000 100644',
              '--- a/doc/a.md',
              '+++ b/doc/a.md',
              '@@ -1,2 +1,2 @@',
              '-one',
              '-two',
              String.raw`\ No newline at end of file`,
              '+uno',
              '+dos',
              '',
            ].join('\n',),);
          },
        },),
        it({
          name: 'uses the executable mode for executable candidates',
          fn: async function executable() {
            /**
             Patch for an executable candidate.
             */
            const patch = createFullContentPatch({
              targetId: 't2',
              path: 'run.md',
              revision: 'ff',
              mode: 'executable',
              original: ENCODER.encode('a\n',),
              replacement: ENCODER.encode('b\n',),
            },);
            expect(DECODER.decode(patch.bytes,).includes('index ff..00 100755',),).toBe(true,);
          },
        },),
      ],
    },),
    describe({
      name: rewriteCandidates.name,
      children: [
        it({
          name: 'rewrites a README with a relative LFS image and carries a full-content patch',
          fn: async function rewrites() {
            await using repo = await makeLfsRepo();
            /**
             Findings for the README candidate.
             */
            const findings = await rewrite({
              repositoryRoot: repo.path,
              candidates: [candidateOf({ path: 'pkg/README.md', bytes: ENCODER.encode(RELATIVE_README,), },),],
            },);
            expect(findings,).toHaveLength(1,);
            expect(findings[0]?.code,).toBe(AUTOFIX_CODE,);
            expect(findings[0]?.path,).toBe('pkg/README.md',);
            /**
             Patch text of the autofix finding.
             */
            const patchText = DECODER.decode(findings[0]?.patch?.bytes,);
            expect(patchText.includes('+++ b/pkg/README.md',),).toBe(true,);
            expect(patchText.includes(`+![shot](${FIXTURE_URL})`,),).toBe(true,);
            expect(patchText.includes('-![shot](asset/shot.png)',),).toBe(true,);
            expect(findings[0]?.patch?.targetId,).toBe('target:pkg/README.md',);
          },
        },),
        it({
          name: 'reports without a patch when the lifecycle cannot apply patches',
          fn: async function reportOnly() {
            await using repo = await makeLfsRepo();
            /**
             Findings at a read-only lifecycle point.
             */
            const findings = await rewrite({
              repositoryRoot: repo.path,
              candidates: [candidateOf({ path: 'pkg/README.md', bytes: ENCODER.encode(RELATIVE_README,), },),],
              canApplyPatches: false,
            },);
            expect(findings,).toHaveLength(1,);
            expect(findings[0]?.code,).toBe(AUTOFIX_CODE,);
            expect(findings[0]?.patch,).toBeUndefined();
          },
        },),
        it({
          name: 'returns nothing for a README the rules leave unchanged',
          fn: async function unchanged() {
            await using repo = await makeLfsRepo();
            expect(await rewrite({
              repositoryRoot: repo.path,
              candidates: [candidateOf({ path: 'pkg/README.md', bytes: ENCODER.encode('# Player\n\nNo images.\n',), },),],
            },),).toEqual([],);
          },
        },),
        it({
          name: 'skips non-Markdown, deleted, symlink, and excluded candidates',
          fn: async function skips() {
            await using repo = await makeLfsRepo();
            /**
             Source that would be rewritten if inspected.
             */
            const bytes = ENCODER.encode(RELATIVE_README,);
            expect(await rewrite({
              repositoryRoot: repo.path,
              candidates: [
                candidateOf({ path: 'pkg/notes.txt', bytes, },),
                candidateOf({ path: 'pkg/README.md', bytes, change: 'deleted', },),
                candidateOf({ path: 'pkg/LINK.md', bytes, mode: 'symlink', },),
                candidateOf({ path: 'pkg/skip/README.md', bytes, },),
              ],
              exclude: ['pkg/skip/',],
            },),).toEqual([],);
          },
        },),
        it({
          name: 'skips a candidate whose bytes are not UTF-8',
          fn: async function binary() {
            await using repo = await makeLfsRepo();
            expect(await rewrite({
              repositoryRoot: repo.path,
              candidates: [candidateOf({ path: 'pkg/README.md', bytes: new Uint8Array([
                0xFF,
                0xFE,
                0xFD,
              ],), },),],
            },),).toEqual([],);
          },
        },),
        it({
          name: 'reports an unfixable violation of a selected rule without a patch',
          fn: async function violation() {
            await using repo = await makeLfsRepo();
            /**
             Findings with a report-only rule selected and a heading jump.
             */
            const findings = await rewrite({
              repositoryRoot: repo.path,
              candidates: [candidateOf({ path: 'pkg/README.md', bytes: ENCODER.encode('# A\n\n### B\n',), },),],
              rules: ['MD001',],
            },);
            expect(findings,).toHaveLength(1,);
            expect(findings[0]?.code,).toBe(VIOLATION_CODE,);
            expect(findings[0]?.patch,).toBeUndefined();
            expect(findings[0]?.message.includes('MD001',),).toBe(true,);
            expect(findings[0]?.message.includes('pkg/README.md:3:1',),).toBe(true,);
          },
        },),
        it({
          name: 'raises a plugin error for an unknown rule id',
          fn: async function usage() {
            await using repo = await makeLfsRepo();
            /**
             Failure surfaced for a usage error.
             */
            const caught = await captureRejection(async function reject(): Promise<unknown> {
              return await rewrite({
                repositoryRoot: repo.path,
                candidates: [candidateOf({ path: 'pkg/README.md', bytes: ENCODER.encode(RELATIVE_README,), },),],
                rules: ['no-such-rule',],
              },);
            },);
            expect(caught,).toBeInstanceOf(MarkdownLintPluginError,);
            expect((caught as Error).message.includes('rejected its arguments',),).toBe(true,);
          },
        },),
        it({
          name: 'raises a plugin error when the command cannot start',
          fn: async function unstartable() {
            await using repo = await makeLfsRepo();
            /**
             Failure surfaced for a missing executable.
             */
            const caught = await captureRejection(async function reject(): Promise<unknown> {
              return await rewrite({
                repositoryRoot: repo.path,
                candidates: [candidateOf({ path: 'pkg/README.md', bytes: ENCODER.encode(RELATIVE_README,), },),],
                command: ['/nonexistent/markdown-lint-binary',],
              },);
            },);
            expect(caught,).toBeInstanceOf(MarkdownLintPluginError,);
            expect((caught as Error).message.includes('could not be started',),).toBe(true,);
          },
        },),
        it({
          name: 'raises a plugin error for an empty command',
          fn: async function empty() {
            await using repo = await makeLfsRepo();
            /**
             Failure surfaced for an empty command list.
             */
            const caught = await captureRejection(async function reject(): Promise<unknown> {
              return await rewrite({
                repositoryRoot: repo.path,
                candidates: [candidateOf({ path: 'pkg/README.md', bytes: ENCODER.encode(RELATIVE_README,), },),],
                command: [],
              },);
            },);
            expect(caught,).toBeInstanceOf(MarkdownLintPluginError,);
          },
        },),
      ],
    },),
    describe({
      name: 'markdownLintPolicy.check',
      children: [
        it({
          name: 'reads candidates from the context and rewrites through the configured command',
          fn: async function check() {
            await using repo = await makeLfsRepo();
            /**
             Findings produced through the policy entry point.
             */
            const findings = await markdownLintPolicy.check({
              context: {
                candidateVersion: 0,
                canApplyPatches: true,
                trigger: 'pre-forward',
                command: {
                  rawArgs: ['commit',],
                  transformedArgs: ['commit',],
                  subcommand: 'commit',
                  effectiveCwd: repo.path,
                  repositoryRoot: repo.path,
                  escapedPolicyIds: new Set<string>(),
                },
                git: {
                  candidates: function candidates(): Promise<readonly FixtureCandidate[]> {
                    return Promise.resolve([candidateOf({ path: 'pkg/README.md', bytes: ENCODER.encode(RELATIVE_README,), },),],);
                  },
                  headOid: function headOid(): Promise<string> {
                    return Promise.resolve('head',);
                  },
                  landedCommitOid: function landedCommitOid(): Promise<string> {
                    return Promise.resolve('landed',);
                  },
                  pushUpdates: function pushUpdates(): Promise<readonly never[]> {
                    return Promise.resolve([],);
                  },
                },
                signal: new AbortController().signal,
              },
              options: {
                command: MARKDOWN_LINT_COMMAND,
                rules: RULES,
                exclude: [],
              },
            },);
            expect(findings,).toHaveLength(1,);
            expect(findings[0]?.code,).toBe(AUTOFIX_CODE,);
          },
        },),
      ],
    },),
  ],
},);
