export {}

Bun.serve({
  port: 3_005,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/' || url.pathname === '/test-harness.html') {
      return new Response(Bun.file('playwright/test-harness.html'));
    }

    if (url.pathname.startsWith('/dist/')) {
      return new Response(Bun.file(`packages/module/es${url.pathname}`));
    }

    return new Response('Not found', { status: 404 });
  },
});
