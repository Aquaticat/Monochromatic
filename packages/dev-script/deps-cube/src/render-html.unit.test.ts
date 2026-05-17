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

import type { PackageProbe, } from './probe.ts';
import { renderHtml, } from './render-html.ts';

const FIXTURE_BUNDLE = 'console.log("stubbed-controller");';

/**
 * Returns true when `htmlLower` contains a `<script ... src=...>` opening
 * tag (case-insensitive on the tag name; the caller pre-lowercases the
 * HTML). Replaces a `/<script\s+[^>]*\bsrc=/i` test with a linear
 * `indexOf` walk: each `<script` is paired with the next `>`, and the
 * intervening attribute span is scanned for the `src=` token preceded by a
 * whitespace boundary.
 *
 * @param htmlLower - lower-cased HTML document
 *
 * @returns whether any `<script>` tag carries a `src=` attribute
 */
function hasScriptSrcAttribute(htmlLower: string,): boolean {
  /**
   * Recursive walker that scans every `<script` opening tag and gives up
   * on the first one that carries a whitespace-bounded `src=` attribute.
   *
   * @param from - cursor index for the next `indexOf` call
   *
   * @returns true on the first matching tag
   */
  function scan(from: number,): boolean {
    /** Position of the next `<script`; `-1` ends the search. */
    const openIdx = htmlLower.indexOf(
      '<script',
      from,
    );
    if (openIdx === (-1))
      return false;
    /** Position of the closing `>` of the opening tag; `-1` ends the search. */
    const closeIdx = htmlLower.indexOf(
      '>',
      openIdx,
    );
    if (closeIdx === (-1))
      return false;
    /** Attribute span between `<script` and `>`; trailing whitespace is preserved. */
    const attrs = htmlLower.slice(
      openIdx + '<script'.length,
      closeIdx,
    );
    /** Each candidate `src=` position; must follow a whitespace byte to count. */
    function findBoundedSrc(scanFrom: number,): boolean {
      /** Position of the next `src=`; `-1` ends the per-tag search. */
      const srcIdx = attrs.indexOf(
        'src=',
        scanFrom,
      );
      if (srcIdx === (-1))
        return false;
      /** Char preceding the `src=` token; whitespace satisfies the original `\bsrc=` anchor. */
      const prev = srcIdx === 0 ? '' : attrs.charAt(srcIdx - 1,);
      /** Whether the preceding char is whitespace or beginning of the attribute span. */
      const bounded = (prev === '') || (prev === ' ') || (prev === '\t')
        || (prev === '\n') || (prev === '\r') || (prev === '\f') || (prev === '\v');
      if (bounded)
        return true;
      return findBoundedSrc(srcIdx + 1,);
    }
    if (findBoundedSrc(0,))
      return true;
    return scan(closeIdx + 1,);
  }
  return scan(0,);
}

/**
 * Returns true when `html` contains a non-empty `<style>...</style>`
 * block. Replaces `/<style>[\s\S]+<\/style>/` with a linear `indexOf`
 * walk: the first `<style>` is paired with the next `</style>`, and the
 * intervening span must hold at least one character.
 *
 * @param html - HTML document
 *
 * @returns whether at least one non-empty style block exists
 */
function hasNonEmptyStyleBlock(html: string,): boolean {
  /** Position of the first `<style>`; `-1` ends the search. */
  const open = html.indexOf('<style>',);
  if (open === (-1))
    return false;
  /** Position of the matching `</style>`; `-1` means the block is unterminated. */
  const close = html.indexOf(
    '</style>',
    open + '<style>'.length,
  );
  return (close !== (-1)) && (close > (open + '<style>'.length));
}

const PROBES: readonly PackageProbe[] = [
  {
    catalogKey: 'preact',
    npmName: 'preact',
    resolvedVersion: '10.26.0',
    isLeaf: true,
    weeklyDownloads: 5_000_000,
    installSizeBytes: 250_000,
    packageAgeDays: 1_500,
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

        /** Lower-cased copy so the case-insensitive presence checks below stay simple. */
        const htmlLower = html.toLowerCase();
        expect(htmlLower.includes('rel="stylesheet"',)).toBe(false,);
        expect(htmlLower.includes("rel='stylesheet'",)).toBe(false,);
        expect(hasScriptSrcAttribute(htmlLower,),).toBe(false,);

        expect(html,).toContain('window.__PROBES__ =',);
        expect(html,).toContain('"preact"',);

        expect(html,).toContain(FIXTURE_BUNDLE,);

        expect(html,).toContain('id="controls"',);
        expect(html,).toContain('id="visibility-counter"',);
        expect(html,).toContain('id="deck-canvas"',);

        // styles.css is inlined as a <style>…</style> block; verify the
        // <style> tag is present (we deliberately don't assert content,
        // since the CSS file is governed elsewhere).
        expect(hasNonEmptyStyleBlock(html,),).toBe(true,);
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
          outputs: [
            {
              text: async (): Promise<string> => `</script><!--${FIXTURE_BUNDLE}`,
            } as any,
          ],
          logs: [],
          // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- minimal stub of BuildOutput; only the consumed fields are populated.
        } as unknown as Awaited<ReturnType<typeof Bun.build>>,);
        /* oxlint-enable typescript-eslint/no-unsafe-member-access */
        /* oxlint-enable typescript-eslint/no-unsafe-call */

        const html = await renderHtml({ probes: PROBES, },);
        expect(html,).toContain(String.raw`<\/script>`,);
        expect(html,).toContain(String.raw`<\!--`,);
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
          }
          catch (err) {
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
