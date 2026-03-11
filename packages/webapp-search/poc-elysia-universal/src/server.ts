/**
 * Universal Elysia server -- identical code runs on Bun, Node.js, and Deno.
 *
 * Runtime detection selects the correct adapter at startup:
 * - Bun: built-in BunAdapter (no extra import)
 * - Node.js / Deno: `@elysiajs/node` adapter (dynamic import, only loaded when needed)
 *
 * @example
 * ```sh
 * bun src/server.ts
 * node --experimental-strip-types src/server.ts
 * deno run --allow-net --allow-read --allow-env src/server.ts
 * ```
 */

/** Whether the current runtime is Bun. */
const isBun = typeof globalThis.Bun !== 'undefined';

/**
 * Resolves the appropriate Elysia adapter for the current runtime.
 * Bun uses the built-in adapter (returns undefined).
 * Node.js and Deno use `@elysiajs/node`.
 * @returns Adapter instance, or undefined for Bun
 */
async function resolveAdapter(): Promise<unknown> {
  if (isBun) {
    return undefined;
  }

  const { node } = await import('@elysiajs/node');
  return node();
}

const adapter = await resolveAdapter();

// Defer Elysia import to after adapter resolution to keep the dynamic import path clean.
const { Elysia } = await import('elysia');

/** In-memory task store for the PoC. */
const tasks: Array<{ id: string; title: string; done: boolean }> = [
  { id: '1', title: 'Try Bun', done: true },
  { id: '2', title: 'Try Node.js', done: false },
  { id: '3', title: 'Try Deno', done: false },
];

/** Counter for generating task IDs. */
let nextId = 4;

/**
 * Detects the runtime name for the greeting response.
 * @returns Human-readable runtime identifier
 */
function detectRuntime(): string {
  if (isBun) {
    return `Bun ${Bun.version}`;
  }

  if (typeof globalThis.Deno !== 'undefined') {
    // @ts-expect-error -- Deno global exists at runtime but not in Bun/Node types
    return `Deno ${Deno.version.deno as string}`;
  }

  return `Node.js ${process.version}`;
}

const app = new Elysia({ adapter: adapter as never })
  .get('/', () => ({
    message: 'Elysia universal PoC',
    runtime: detectRuntime(),
  }))
  .get('/tasks', () => tasks)
  .get('/tasks/:id', ({ params }) => {
    const task = tasks.find(function findById(t) { return t.id === params.id; });
    if (task === undefined) {
      return new Response('Not found', { status: 404 });
    }
    return task;
  })
  .post('/tasks', ({ body }) => {
    const { title } = body as { title: string };
    const task = { id: String(nextId), title, done: false };
    nextId += 1;
    tasks.push(task);
    return task;
  })
  .post('/tasks/:id/complete', ({ params }) => {
    const task = tasks.find(function findById(t) { return t.id === params.id; });
    if (task === undefined) {
      return new Response('Not found', { status: 404 });
    }
    task.done = true;
    return task;
  })
  .listen(3099);

console.log(`Listening on http://localhost:3099 (${detectRuntime()})`);

export { app };
