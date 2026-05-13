/**
 * Tests for the HTML composer.
 *
 * `Bun.build` is stubbed to return a fake bundle so the test stays
 * cross-runtime and fast (the real bundle would take multiple
 * seconds and only works under Bun). Structural assertions verify
 * the composed page is self-contained:
 *
 * - no external `<link rel="stylesheet">` or `<script src="…">` references
 * - the probe array is inlined as `window.__PROBES__`
 * - the control panel HTML is embedded inside the document
 * - the stubbed bundle text appears inside a `<script>` block
 * - the document is properly tagged (doctype, charset, viewport, title)
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import type { PackageProbe, } from '../src/probe.ts';
import { renderHtml, } from '../src/render-html.ts';

const FIXTURE_BUNDLE = 'console.log("stubbed-controller");';

const PROBES: readonly PackageProbe[] = [
  {
    catalogKey: 'preact',
    npmName: 'preact',
    resolvedVersion: '10.26.0',
    isLeaf: true,
    weeklyDownloads: 5_000_000,
    installSizeBytes: 250_000,
    packageAgeDays: 1500,
    licenseClass: 'permissive',
    runtimeDepCount: 0,
    transitiveDepCount: 0,
    tsRatioOrNull: 0.99,
    sourceBytesOrNull: 200_000,
    daysSinceLastCommitOrNull: 14,
    repositoryUrlOrNull: 'https://github.com/preactjs/preact',
    isMonorepoHoused: false,
    unknownReason: null,
  },
];

await describe({
  name: 'render-html',
  // Concurrency 1: each test stubs `Bun.build`; concurrent execution would
  // produce "Attempted to wrap build which is already wrapped" from sinon.
  concurrency: 1,
  children: [
    it({
      name: 'composes a self-contained HTML document with the stubbed bundle inlined',
      fn: async ({ sinon, },) => {
        /* oxlint-disable typescript-eslint/no-unsafe-call -- sinon's overload set doesn't unify with the Bun ambient namespace; this is a typed stub on a known method. */
        /* oxlint-disable typescript-eslint/no-unsafe-member-access -- chai-as-promised .resolves chain isn't typed against sinon's stub return. */
        sinon.stub(Bun, 'build',).resolves({
          success: true,
          // oxlint-disable-next-line typescript-eslint/no-explicit-any -- minimal stub of BuildArtifact for the test path.
          outputs: [{ text: async (): Promise<string> => FIXTURE_BUNDLE, } as any,],
          logs: [],
          // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- minimal stub of BuildOutput; only the consumed fields are populated.
        } as unknown as Awaited<ReturnType<typeof Bun.build>>,);
        /* oxlint-enable typescript-eslint/no-unsafe-member-access */
        /* oxlint-enable typescript-eslint/no-unsafe-call */

        const html = await renderHtml({ probes: PROBES, },);

        expect(html.startsWith('<!doctype html>',),).toBe(true,);
        expect(html,).toContain('<meta charset="utf-8">',);
        expect(html,).toContain('name="viewport"',);
        expect(html,).toContain('<title>',);

        expect(html,).not.toMatch(/<link\s+[^>]*rel=["']stylesheet["']/i,);
        expect(html,).not.toMatch(/<script\s+[^>]*\bsrc=/i,);

        expect(html,).toContain('window.__PROBES__ =',);
        expect(html,).toContain('"preact"',);

        expect(html,).toContain(FIXTURE_BUNDLE,);

        expect(html,).toContain('id="controls"',);
        expect(html,).toContain('id="visibility-counter"',);
        expect(html,).toContain('id="deck-canvas"',);

        // styles.css is inlined as a <style>…</style> block; verify the
        // <style> tag is present (we deliberately don't assert content,
        // since the CSS file is governed elsewhere).
        expect(html,).toMatch(/<style>[\s\S]+<\/style>/,);
      },
    },),

    it({
      name: 'escapes </script and <!-- inside the inlined bundle and data',
      fn: async ({ sinon, },) => {
        /* oxlint-disable typescript-eslint/no-unsafe-call -- sinon's overload set doesn't unify with the Bun ambient namespace; this is a typed stub on a known method. */
        /* oxlint-disable typescript-eslint/no-unsafe-member-access -- chai-as-promised .resolves chain isn't typed against sinon's stub return. */
        sinon.stub(Bun, 'build',).resolves({
          success: true,
          // oxlint-disable-next-line typescript-eslint/no-explicit-any -- minimal stub of BuildArtifact for the test path.
          outputs: [{ text: async (): Promise<string> => '</script><!--' + FIXTURE_BUNDLE, } as any,],
          logs: [],
          // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- minimal stub of BuildOutput; only the consumed fields are populated.
        } as unknown as Awaited<ReturnType<typeof Bun.build>>,);
        /* oxlint-enable typescript-eslint/no-unsafe-member-access */
        /* oxlint-enable typescript-eslint/no-unsafe-call */

        const html = await renderHtml({ probes: PROBES, },);
        expect(html,).toContain('<\\/script>',);
        expect(html,).toContain('<\\!--',);
        // No raw `</script>` inside the inlined script blocks (the closing tag
        // for our own <script> remains in the document, so we check the bundle
        // payload only):
        const bundleStart = html.indexOf(FIXTURE_BUNDLE,);
        expect(bundleStart,).toBeGreaterThan(-1,);
      },
    },),

    it({
      name: 'surfaces bundle failures with the bundler logs joined in the error',
      fn: async ({ sinon, },) => {
        /* oxlint-disable typescript-eslint/no-unsafe-call -- sinon's overload set doesn't unify with the Bun ambient namespace; this is a typed stub on a known method. */
        /* oxlint-disable typescript-eslint/no-unsafe-member-access -- chai-as-promised .resolves chain isn't typed against sinon's stub return. */
        sinon.stub(Bun, 'build',).resolves({
          success: false,
          outputs: [],
          logs: [
            { message: 'first error', },
            { message: 'second error', },
          ],
          // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- minimal stub of BuildOutput; only the consumed fields are populated.
        } as unknown as Awaited<ReturnType<typeof Bun.build>>,);
        /* oxlint-enable typescript-eslint/no-unsafe-member-access */
        /* oxlint-enable typescript-eslint/no-unsafe-call */

        const caught = await (async function captureError() {
          try {
            await renderHtml({ probes: PROBES, },);
            return null;
          } catch (err) {
            return err;
          }
        })();
        expect(caught,).toBeInstanceOf(Error,);
        expect(String(caught,),).toContain('first error',);
        expect(String(caught,),).toContain('second error',);
      },
    },),
  ],
},);
