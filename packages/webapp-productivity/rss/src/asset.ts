import clientCss from './client.css' with { type: 'text' };
import { l, } from './log.ts';

l.debug(`asset module loading`);

/**
 * Builds the client-side JavaScript bundle using Bun.build.
 * Bundles `client.ts` and its dependencies for browser execution.
 * @returns Promise resolving to the bundled JavaScript source code
 * @throws {@link Error} If the build fails or produces no output
 * @example
 * ```typescript
 * const clientJs = await buildClientJs();
 * ```
 */
async function buildClientJs(): Promise<string> {
  l.debug(`buildClientJs`);

  const buildResult = await Bun.build({
    entrypoints: ['./src/client.ts',],
    target: 'browser',
    minify: process.env.NODE_ENV === 'production',
  },);

  if (!buildResult.success) {
    l.error(`buildClientJs failed: ${buildResult.logs.join('\n',)}`);
    throw new Error(`Client build failed: ${buildResult.logs.join('\n',)}`,);
  }

  const output = buildResult.outputs[0];
  if (!output) {
    throw new Error('Client build produced no output',);
  }

  const text = await output.text();
  l.debug(`buildClientJs done, ${text.length} chars`);
  return text;
}

/**
 * CSS source for the RSS reader interface.
 * Imported at build time via Bun's static asset import.
 * Also used by {@link itemToFeed} in html.ts for iframe content styling.
 * @see {@link indexHtmlStart} for where it is inlined into the page
 */
export const css: string = clientCss;

/**
 * Bundled client-side JavaScript for the RSS reader interface.
 * Built once at server startup via Bun.build with browser target.
 * @see {@link buildClientJs} for the bundling process
 * @see {@link indexHtmlStart} for where it is inlined into the page
 */
export const js: string = await buildClientJs();

/**
 * Opening HTML fragment (doctype through body start) with inlined CSS and JS.
 * Served as the beginning of every page response.
 * @see {@link css} for the inlined stylesheet
 * @see {@link js} for the inlined client bundle
 */
export const indexHtmlStart: string = `<!DOCTYPE html>
    <html lang=en>
    <head>
    <meta charset=UTF-8>
    <meta name=viewport content='width=device-width,initial-scale=1.0'>
    <style>${css}</style>
    <script type=module>${js.replaceAll('<\/script>', String.raw`<\/script>`,)}</script>
    </head>
    <body>`;

l.debug(`asset module loaded, css ${css.length} chars, js ${js.length} chars`);
