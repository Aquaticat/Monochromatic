import { readFile } from 'node:fs/promises';

import { H3, defineHandler, serve } from 'h3';

const app = new H3();

app.all(
  '/**',
  defineHandler(async function serveTestHarness(event) {
    const pathname = new URL(event.request.url).pathname;

    if (pathname === '/' || pathname === '/test-harness.html') {
      return new Response(await readFile('playwright/test-harness.html'));
    }

    if (pathname.startsWith('/dist/')) {
      return new Response(await readFile(`packages/module/es${pathname}`));
    }

    return new Response('Not found', { status: 404 });
  }),
);

serve({ fetch: app.fetch, port: 3005 });
