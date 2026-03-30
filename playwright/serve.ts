import { readFile, } from 'node:fs/promises';
import { extname, } from 'node:path';

import {
  defineHandler,
  H3,
  serve,
} from 'h3';

/** Map file extensions to MIME types for browser test assets. */
const mimeTypes: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
};

const app = new H3();

app.all(
  '/**',
  defineHandler(async function serveTestHarness(event,) {
    const { pathname, } = event.url;

    if (pathname === '/' || pathname === '/test-harness.html') {
      return new Response(
        await readFile('playwright/test-harness.html',),
        {
          headers: { 'content-type': 'text/html', },
        },
      );
    }

    if (pathname.startsWith('/dist/',)) {
      const contentType = mimeTypes[extname(pathname,)] ?? 'application/octet-stream';
      return new Response(
        await readFile(`packages/module/es${pathname}`,),
        {
          headers: { 'content-type': contentType, },
        },
      );
    }

    return new Response(
      'Not found',
      { status: 404, },
    );
  },),
);

serve(
  app,
  { port: 3_005, },
);
