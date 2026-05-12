import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import { HashCache, } from '../hash-cache.ts';
import { l as defaultLogger, } from '../log.ts';
import type {
  WatchCtx,
  WatchEvent,
} from '../types.ts';
import { hiddenFilter, } from './hidden.ts';

/**
 * Builds a minimal {@link WatchCtx}; hiddenFilter ignores everything but
 * `event.relativePath`.
 *
 * @returns context object suitable for handing to hiddenFilter
 *
 * @example
 * ```ts
 * const ctx = makeCtx();
 * ```
 */
function makeCtx(): WatchCtx {
  return {
    logger: defaultLogger,
    hashCache: new HashCache(),
    signal: new AbortController().signal,
  };
}

/**
 * Builds a {@link WatchEvent} from overrides; defaults give a `change`
 * to `file.ts`.
 *
 * @param overrides - partial event fields to merge over the default
 *
 * @returns fully-populated event
 *
 * @example
 * ```ts
 * const event = makeEvent({ relativePath: '.cache/data', },);
 * ```
 */
function makeEvent(
  overrides: Partial<WatchEvent> = {},
): WatchEvent {
  return {
    kind: overrides.kind ?? 'change',
    entity: overrides.entity ?? 'file',
    path: overrides.path ?? '/abs/file.ts',
    relativePath: overrides.relativePath ?? 'file.ts',
    ext: overrides.ext ?? '.ts',
  };
}

await describe({
  name: 'hiddenFilter',
  children: [
    it({
      name: 'default (allowHidden off) rejects leading-dot segment at root',
      fn: async function rejectsRootDotfile() {
        const filter = hiddenFilter({},);
        const passed = await filter({
          event: makeEvent({ relativePath: '.config.ts', },),
          ctx: makeCtx(),
        },);
        expect(passed,).toBe(false,);
      },
    },),
    it({
      name: 'default rejects leading-dot segment nested in path',
      fn: async function rejectsNestedDotfile() {
        const filter = hiddenFilter({},);
        const swapFile = await filter({
          event: makeEvent({ relativePath: 'src/.foo.swp', },),
          ctx: makeCtx(),
        },);
        const gitIndex = await filter({
          event: makeEvent({ relativePath: 'src/.git/index', },),
          ctx: makeCtx(),
        },);
        const cacheDir = await filter({
          event: makeEvent({
            relativePath: 'src/.cache/data',
            entity: 'dir',
            kind: 'addDir',
          },),
          ctx: makeCtx(),
        },);

        expect(swapFile,).toBe(false,);
        expect(gitIndex,).toBe(false,);
        expect(cacheDir,).toBe(false,);
      },
    },),
    it({
      name: 'default admits paths without any hidden segment',
      fn: async function admitsNonHidden() {
        const filter = hiddenFilter({},);
        const plain = await filter({
          event: makeEvent({ relativePath: 'src/index.ts', },),
          ctx: makeCtx(),
        },);
        const deep = await filter({
          event: makeEvent({ relativePath: 'src/a/b/c.ts', },),
          ctx: makeCtx(),
        },);
        expect(plain,).toBe(true,);
        expect(deep,).toBe(true,);
      },
    },),
    it({
      name: 'allowHidden=true passes hidden paths through',
      fn: async function allowsHidden() {
        const filter = hiddenFilter({ allowHidden: true, },);
        const dotfile = await filter({
          event: makeEvent({ relativePath: '.config.ts', },),
          ctx: makeCtx(),
        },);
        const swap = await filter({
          event: makeEvent({ relativePath: 'src/.foo.swp', },),
          ctx: makeCtx(),
        },);
        const plain = await filter({
          event: makeEvent({ relativePath: 'src/index.ts', },),
          ctx: makeCtx(),
        },);
        expect(dotfile,).toBe(true,);
        expect(swap,).toBe(true,);
        expect(plain,).toBe(true,);
      },
    },),
    it({
      name: 'default does not treat extension-only dot as hidden',
      fn: async function dotInExtension() {
        const filter = hiddenFilter({},);
        const passed = await filter({
          event: makeEvent({ relativePath: 'src/file.config.ts', },),
          ctx: makeCtx(),
        },);
        expect(passed,).toBe(true,);
      },
    },),
    it({
      name: 'default matches Windows-style backslash separators',
      fn: async function windowsSeparators() {
        const filter = hiddenFilter({},);
        const passed = await filter({
          event: makeEvent({ relativePath: String.raw`src\.swp`, },),
          ctx: makeCtx(),
        },);
        expect(passed,).toBe(false,);
      },
    },),
    it({
      name: 'no-args call uses the default (allowHidden off)',
      fn: async function noArgsDefault() {
        const filter = hiddenFilter();
        const dotfile = await filter({
          event: makeEvent({ relativePath: '.config.ts', },),
          ctx: makeCtx(),
        },);
        expect(dotfile,).toBe(false,);
      },
    },),
  ],
},);
