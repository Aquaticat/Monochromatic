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
// oxlint-disable-next-line typescript/no-unnecessary-condition -- Bun global only exists at runtime in Bun
const isBun = globalThis.Bun !== undefined;

/**
 * Resolves the appropriate Elysia adapter for the current runtime.
 * Bun uses the built-in adapter (returns undefined).
 * Node.js and Deno use `@elysiajs/node`.
 *
 * @returns Adapter instance, or undefined for Bun
 */
async function resolveAdapter(): Promise<unknown> {
  if (isBun)
    return undefined;

  const { node, } = await import('@elysiajs/node');
  return node();
}

/** Resolved Elysia adapter for the current runtime. */
const adapter = await resolveAdapter();

// Defer Elysia import to after adapter resolution to keep the dynamic import path clean.
/** Elysia constructor, dynamically imported after adapter resolution. */
const { Elysia, } = await import('elysia');

/** In-memory task store for the PoC. */
const tasks: {
  id: string;
  title: string;
  done: boolean;
}[] = [
  {
    id: '1',
    title: 'Try Bun',
    done: true,
  },
  {
    id: '2',
    title: 'Try Node.js',
    done: false,
  },
  {
    id: '3',
    title: 'Try Deno',
    done: false,
  },
];

/** Counter for generating task IDs. */
const INITIAL_NEXT_ID = 4;

/** Counter for generating task IDs. */
let nextId = INITIAL_NEXT_ID;

/**
 * Detects the runtime name for the greeting response.
 *
 * @returns Human-readable runtime identifier
 */
function detectRuntime(): string {
  if (isBun)
    return `Bun ${Bun.version}`;

  // oxlint-disable-next-line typescript/no-unnecessary-condition -- Deno global only exists at runtime in Deno
  if ((globalThis as Record<string, unknown>).Deno !== undefined) {
    // @ts-expect-error -- Deno global exists at runtime but not in Bun/Node types
    // oxlint-disable-next-line typescript/no-unsafe-member-access, typescript/no-unsafe-type-assertion -- Deno global is untyped in non-Deno environments
    return `Deno ${Deno.version.deno as string}`;
  }

  return `Node.js ${process.version}`;
}

// oxlint-disable typescript/no-unsafe-type-assertion -- adapter type is opaque
/** Elysia application instance with all routes configured. */
const app = new Elysia({ adapter: adapter as never, },)
  .get(
    '/',
    function handleRoot() {
      return {
        message: 'Elysia universal PoC',
        runtime: detectRuntime(),
      };
    },
  )
  .get(
    '/tasks',
    function listTasks() {
      return tasks;
    },
  )
  .get(
    '/tasks/:id',
    function getTask({ params, },) {
      const task = tasks.find(function findById(t,) {
        return t.id === params.id;
      },);
      if (task === undefined)
        return new Response('Not found', { status: 404, },);
      return task;
    },
  )
  .post(
    '/tasks',
    function createTask({ body, },) {
      const { title, } = body as { title: string; };
      const task = { id: String(nextId,), title, done: false, };
      nextId += 1;
      tasks.push(task,);
      return task;
    },
  )
  .post(
    '/tasks/:id/complete',
    function completeTask({ params, },) {
      const task = tasks.find(function findById(t,) {
        return t.id === params.id;
      },);
      if (task === undefined)
        return new Response('Not found', { status: 404, },);
      task.done = true;
      return task;
    },
  )
  // oxlint-disable-next-line no-magic-numbers -- PoC server port
  .listen(3_099,);
// oxlint-enable

console.log(`Listening on http://localhost:3099 (${detectRuntime()})`,);

export { app, };
