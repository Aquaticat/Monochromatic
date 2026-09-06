import { createConsoleSink, } from './sink/console.ts';
import { createFileSink, } from './sink/file.ts';
import { createLocalStorageSink, } from './sink/local-storage.ts';
import { createSessionStorageSink, } from './sink/session-storage.ts';

import type { Sink, } from './types.ts';

/**
 Default sink backends the Node artifact attempts, in priority order.
 Chosen at bundle time: `package.json` maps `#default-sinks` to this module
 under the `node` condition, so `logger.ts` inlines this list without a
 runtime platform probe. Each runtime keeps only the sinks whose `verify`
 confirms its backend: {@link createConsoleSink} everywhere,
 {@link createSessionStorageSink} wherever web storage round-trips (Node
 22+, Deno), {@link createLocalStorageSink} wherever `localStorage`
 round-trips (Deno, Node launched with `--localstorage-file`), and
 {@link createFileSink} wherever an ancestor `node_modules` exists. The
 noop sink is intentionally absent: the console sink verifies wherever
 `console` and `queueMicrotask` exist, so the default logger has a backend
 in every supported runtime, and a custom `createLogger` whose sinks all
 fail verification surfaces the "No logging backends available" error
 instead of silently discarding. The IndexedDB and OPFS sinks are absent
 because Node exposes neither `indexedDB` nor `navigator.storage`; they
 ship through the `./browser` subpath instead, keeping their probes and
 code out of this artifact.
 */
export const defaultSinks: readonly Sink[] = [
  createConsoleSink(),
  createSessionStorageSink(),
  createLocalStorageSink(),
  createFileSink(),
];
