/**
 Native parser qualification is exercised through the real built artifact and disposable package graphs.

 @module
 */
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';
import { createNativeParserFixture, loadNativeParserArtifact, type NativeParserModule } from './native-parser-fixture.ts';

//region Qualification failure tests retain the adapter's exact error boundary

/**
 Require a qualification failure from the selected original adapter instance.

 @param parserModule - original or copied built namespace under test

 @param expectedVersion - version offered to the qualification boundary

 @param message - diagnostic explaining the rejected input

 @throws Error when qualification unexpectedly succeeds
 */
async function expectQualificationFailure({ parserModule, expectedVersion = '0.10.5', message }: {
  readonly parserModule: NativeParserModule;
  readonly expectedVersion?: string;
  readonly message: string;
}): Promise<void> {
  try {
    await parserModule.createNativeMarkdownParser({ expectedVersion });
  } catch (error) {
    expect(error).toBeInstanceOf(parserModule.NativePolicyParserError);
    if (!(Error.isError(error,))) throw error;
    expect(error.message).toContain(message);
    return;
  }
  throw new Error('Expected native parser qualification to fail');
}

//endregion Qualification failure tests retain the adapter's exact error boundary

await describe({
  name: '',
  children: [
    //region The actual installed parser preserves the native consumer behavior

    it({
      name: 'qualifies the installed parser and preserves original Markdown content',
      fn: async function checkInstalledParser() {
        /**
         Runtime loads the built adapter and actual installed parser package.
         */
        const parserModule = await loadNativeParserArtifact();
        /**
         Qualification includes the non-BMP coordinate self-check before returning.
         */
        const parser = await parserModule.createNativeMarkdownParser({ expectedVersion: '0.10.5' });
        /**
         Inspect nested fields directly so retained source positions remain part of the actual tree.
         */
        const tree = parser.parse({ source: '# Policy\n', mdx: false });
        expect(tree).toHaveProperty('type', 'root');
        expect(tree).toHaveProperty('children.length', 1);
        expect(tree).toHaveProperty('children[0].type', 'heading');
        expect(tree).toHaveProperty('children[0].depth', 1);
        expect(tree).toHaveProperty('children[0].children[0].value', 'Policy');
        expect(tree).toHaveProperty('children[0].position.start.offset', 0);
        expect(tree).toHaveProperty('children[0].position.end.offset', 8);
        expect(parser.metadata).toMatchObject({
          package: 'satteri@0.10.5',
          features: { gfm: true, frontmatter: true },
          observedCoordinateUnit: 'UTF16-code-units',
          extraCorrectionApplied: false,
        });
        expect(function unsupportedMdx() {
          parser.parse({ source: '# Policy\n', mdx: true });
        }).toThrow(parserModule.NativePolicyParserError);
      },
    }),
    it({
      name: 'rejects a requested version different from the real installed dependency',
      fn: async function checkInstalledVersion() {
        await expectQualificationFailure({ parserModule: await loadNativeParserArtifact(), expectedVersion: '0.10.4', message: 'Installed parser manifest must identify satteri 0.10.4' });
      },
    }),

    //endregion The actual installed parser preserves the native consumer behavior

    //region Disposable dependency variants exercise explicit qualification failures

    it({
      name: 'accepts a disposable dependency matching the identity and coordinate controls',
      fn: async function checkFixturePositiveControl() {
        /**
         This synthetic tree proves the disposable package graph can reach successful qualification.
         */
        const tree = {
          type: 'root',
          children: [{ type: 'paragraph', children: [{ type: 'text', value: 'x' }], position: { start: { offset: 4 }, end: { offset: 5 } } }],
        };
        /**
         The copied adapter retains the real entry and manifest qualification logic.
         */
        const parserModule = await createNativeParserFixture({ tree });
        /**
         Success distinguishes input-specific rejection from a broken fixture loader.
         */
        const parser = await parserModule.createNativeMarkdownParser({ expectedVersion: '0.10.5' });
        expect(parser.parse({ source: '🚀\n\nx\n', mdx: false })).toEqual(tree);
      },
    }),

    ...[
      { name: 'missing package name', manifest: { name: undefined } },
      { name: 'different package name', manifest: { name: 'different-parser' } },
      { name: 'missing package version', manifest: { version: undefined } },
      { name: 'different package version', manifest: { version: '0.10.4' } },
    ].map(function invalidManifest({ name, manifest }) {
      return it({
        name: `rejects ${name} in a disposable parser package`,
        fn: async function checkManifest() {
          await expectQualificationFailure({ parserModule: await createNativeParserFixture({ manifest }), message: 'Installed parser manifest must identify satteri 0.10.5' });
        },
      });
    }),
    it({
      name: 'rejects an installed and requested version outside the measured source epoch',
      fn: async function checkSourceEpoch() {
        await expectQualificationFailure({ parserModule: await createNativeParserFixture({ manifest: { version: '0.10.4' } }), expectedVersion: '0.10.4', message: 'qualified only for satteri 0.10.5' });
      },
    }),
    it({
      name: 'rejects a different ESM entry before parser use',
      fn: async function checkResolutionIdentity() {
        await expectQualificationFailure({ parserModule: await createNativeParserFixture({ differentEsmEntry: true }), message: 'ESM parser resolution differs from the measured entry' });
      },
    }),
    it({
      name: 'rejects a non-root parser result',
      fn: async function checkRootShape() {
        await expectQualificationFailure({ parserModule: await createNativeParserFixture({ tree: { type: 'paragraph' } }), message: 'Native parser did not return a root' });
      },
    }),
    ...[
      { type: 'root', children: [] },
      { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'x' }] }] },
      { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'x' }], position: { start: { offset: 3 }, end: { offset: 4 } } }] },
      { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'x' }], position: { start: { offset: 4 }, end: {} } }] },
      { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'x' }], position: { start: { offset: 4 }, end: { offset: 6 } } }] },
    ].map(function invalidCoordinates(tree, index) {
      return it({
        name: `rejects absent or changed source coordinates ${index}`,
        fn: async function checkCoordinates() {
          await expectQualificationFailure({ parserModule: await createNativeParserFixture({ tree }), message: 'failed its UTF-16 coordinate control' });
        },
      });
    }),

    //endregion Disposable dependency variants exercise explicit qualification failures
  ],
});
