import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  readFile,
  rm,
} from 'node:fs/promises';
import { join, } from 'node:path';
import {
  parse as postcssParse,
  type Root,
} from 'postcss';
import {
  build,
  collectMixins,
  expandApplyRules,
  expandMixinBodies,
  mixins,
} from '@monochromatic-dev/build-tool-css';

//region Test Helpers

// import.meta.dirname is a Bun-specific API (equivalent to __dirname in CJS)
/** Root fixture directory for all CSS integration tests */
const fixtureRoot = join(import.meta.dirname, '..', '..', '..', 'test-fixture',);

/**
 * Each entry exercises a different CSS import resolution strategy.
 * - exports field: resolved via package.json `exports` mappings
 * - direct file path: resolved by reaching into the package's file tree (no `exports` field)
 */
const integrationFixtures = [
  { label: 'exports field', dir: join(fixtureRoot, 'css-importing',), },
  { label: 'direct file path', dir: join(fixtureRoot, 'css-importing-filepath',), },
] as const;

/**
 * Parses a CSS string into a PostCSS Root for unit testing mixin functions.
 * @param css - Raw CSS string
 * @returns PostCSS Root node
 */
function parse(css: string,): Root {
  return postcssParse(css,);
}

/**
 * Clears shared mixin state and, when given a per-fixture output path, removes it.
 *
 * @param output - Per-fixture output file to remove; omit for the mixin-only unit tests.
 *   Each integration fixture owns a distinct output path so concurrent fixture describes never race on one file.
 */
async function cleanup({ output, }: { output?: string; } = {},): Promise<void> {
  mixins.clear();
  if (output !== undefined)
    await rm(output, { force: true, },);
}

//endregion Test Helpers

//region collectMixins

const integrationChildren = integrationFixtures.map(({ label, dir, },) => {
  /** Path to the main CSS entry point for this fixture */
  const fixtureMainCss = join(dir, 'src', 'main.css',);

  /**
   * Builds a distinct output path per (fixture, test). module-test runs the it-blocks within a
   * describe concurrently, so a path shared across tests lets one test's cleanup rm the file
   * another test is mid-read on (the ENOENT this guards against).
   *
   * @param testSlug - Short discriminator unique to the calling test
   * @returns Absolute output path under dist/ owned solely by that test
   */
  function outputFor(testSlug: string,): string {
    return join(
      import.meta.dirname,
      '..',
      'dist',
      `test-output-${label.replaceAll(' ', '-',)}-${testSlug}.css`,
    );
  }

  return describe({
    name: `build (${label})`,
    children: [
      it({
        name: 'builds fixture CSS with import resolution and mixin expansion',
        fn: async () => {
          const output = outputFor('builds',);
          const result = await build({
            input: fixtureMainCss,
            output,
          },);

          // Imports should be resolved and inlined
          expect(result,).toContain('--primary: rebeccapurple',);

          // @mixin definitions should be removed
          expect(result,).not.toContain('@mixin',);

          // @apply should be expanded
          expect(result,).not.toContain('@apply',);

          // Mixin content should be inlined
          expect(result,).toContain('display: flex',);
          expect(result,).toContain('font-weight: bold',);
          await cleanup({ output, },);
        },
      },),

      it({
        name: 'writes output file to disk',
        fn: async () => {
          const output = outputFor('writes',);
          await build({
            input: fixtureMainCss,
            output,
          },);

          const written = await readFile(output, 'utf8',);
          expect(written,).toContain('--primary: rebeccapurple',);
          await cleanup({ output, },);
        },
      },),

      it({
        name: 'expands nested mixin references in build output',
        fn: async () => {
          const output = outputFor('nested',);
          const result = await build({
            input: fixtureMainCss,
            output,
          },);

          // --card uses @apply --flex-center, so .nested-card should have flex styles
          expect(result,).toContain('.nested-card',);
          // The flex-center content should appear inside .nested-card
          const nestedCardMatch = result.slice(result.indexOf('.nested-card',),);
          expect(nestedCardMatch,).toContain('display: flex',);
          await cleanup({ output, },);
        },
      },),
    ],
  },);
},);

await describe({
  name: '',
  children: [
    describe({
      name: collectMixins.name,
      children: [
        it({
          name: 'collects a mixin definition with body',
          fn: async () => {
            const root = parse(`
      @mixin --center {
        display: flex;
        align-items: center;
      }
    `,);

            collectMixins(root,);

            expect(mixins.has('--center',),).toBe(true,);
            // Definition should be removed from the tree
            expect(root.toString().trim(),).toBe('',);
            await cleanup();
          },
        },),

        it({
          name: 'throws on bodyless @mixin (definitions require content)',
          fn: async () => {
            const root = parse(`
      .btn { @mixin --touch-target; }
    `,);

            expect(() => {
              collectMixins(root,);
            },)
              .toThrow('mixin definition must include body',);
            await cleanup();
          },
        },),

        it({
          name: 'throws on mixed definition followed by bodyless invocation',
          fn: async () => {
            const root = parse(`
      @mixin --bold { font-weight: bold; }
      .title { @mixin --bold; }
    `,);

            // The bodyless @mixin --bold; inside .title triggers the error
            expect(() => {
              collectMixins(root,);
            },)
              .toThrow('mixin definition must include body',);
            await cleanup();
          },
        },),

        it({
          name: 'throws on @mixin with empty name',
          fn: async () => {
            const root = parse('@mixin {}',);

            expect(() => {
              collectMixins(root,);
            },)
              .toThrow('@mixin requires a name',);
            await cleanup();
          },
        },),
      ],
    },),

    //endregion collectMixins

    //region expandApplyRules

    describe({
      name: expandApplyRules.name,
      children: [
        it({
          name: 'expands a simple @apply',
          fn: async () => {
            mixins.set('--center', parse('display: flex; align-items: center;',).nodes,);

            const root = parse('.box { @apply --center; }',);
            expandApplyRules(root,);

            const output = root.toString();
            expect(output,).toContain('display: flex',);
            expect(output,).toContain('align-items: center',);
            await cleanup();
          },
        },),

        it({
          name: 'throws on unknown mixin reference',
          fn: async () => {
            const root = parse('.box { @apply --nonexistent; }',);

            expect(() => {
              expandApplyRules(root,);
            },)
              .toThrow('Unknown mixin: --nonexistent',);
            await cleanup();
          },
        },),

        it({
          name: 'throws on @apply without a name',
          fn: async () => {
            const root = parse('.box { @apply ; }',);

            expect(() => {
              expandApplyRules(root,);
            },)
              .toThrow('Mixin name is required',);
            await cleanup();
          },
        },),

        it({
          name: 'removes @apply for empty mixin',
          fn: async () => {
            mixins.set('--empty', [],);

            const root = parse('.box { @apply --empty; color: red; }',);
            expandApplyRules(root,);

            const output = root.toString();
            expect(output,).not.toContain('@apply',);
            expect(output,).toContain('color: red',);
            await cleanup();
          },
        },),
      ],
    },),

    //endregion expandApplyRules

    //region expandMixinBodies

    describe({
      name: expandMixinBodies.name,
      children: [
        it({
          name: 'expands nested @apply in mixin bodies',
          fn: async () => {
            // --inner defines styles, --outer references --inner via @apply
            mixins.set('--inner', parse('display: flex;',).nodes,);
            mixins.set('--outer', parse('@apply --inner; padding: 1rem;',).nodes,);

            expandMixinBodies();

            const outerNodes = mixins.get('--outer',);
            const outerStr = (outerNodes ?? []).map(node => node.toString()).join('',);
            expect(outerStr,).toContain('display: flex',);
            await cleanup();
          },
        },),

        it({
          name: 'handles deeply nested references',
          fn: async () => {
            mixins.set('--a', parse('color: red;',).nodes,);
            mixins.set('--b', parse('@apply --a; margin: 0;',).nodes,);
            mixins.set('--c', parse('@apply --b; padding: 0;',).nodes,);

            expandMixinBodies();

            const cNodes = mixins.get('--c',);
            const cStr = (cNodes ?? []).map(node => node.toString()).join('',);
            expect(cStr,).toContain('color: red',);
            await cleanup();
          },
        },),
      ],
    },),

    //endregion expandMixinBodies

    //region build (integration)

    ...integrationChildren,
    //endregion build (integration)
  ],
},);
