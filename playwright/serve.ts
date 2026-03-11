import { readFile } from 'node:fs/promises';

Bun.serve({
  port: 3005,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/' || url.pathname === '/test-harness.html') {
      return new Response(await readFile('playwright/test-harness.html'));
    }

    if (url.pathname.startsWith('/dist/')) {
      return new Response(await readFile(`packages/module/es${url.pathname}`));
    }

    return new Response('Not found', { status: 404 });
  },
});
