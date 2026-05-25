/**
 * Static asset serving for the bundled JS and CSS under `dist/`.
 *
 * URLs are content-hashed at build time (tsdown handles JS; CSS is the
 * single `dist/css/styles.css` produced by build-tool-css). Long
 * `max-age=31536000, immutable` is safe because filenames change when
 * content changes.
 */

import {
  defineHandler,
  type EventHandlerWithFetch,
  serveStatic,
} from 'h3';
import {
  readFile,
  stat,
} from 'node:fs/promises';
import { join, } from 'node:path';

/**
 * Returns `stat` for `./<id>`, or `undefined` when the file does not exist
 * or is otherwise inaccessible. Swallows `stat`'s rejections so the caller
 * can branch on the return value rather than try/catch around the await.
 *
 * @param id - URL-relative asset path; joined onto `'.'` before stat
 *
 * @returns stat result, or `undefined` on any failure
 *
 * @example
 * ```ts
 * const stats = await tryStat('dist/css/styles.css');
 * if (stats !== undefined) console.log(stats.size);
 * ```
 */
async function tryStat(
  id: string,
): Promise<Awaited<ReturnType<typeof stat>> | undefined> {
  try {
    return await stat(
      join(
        '.',
        id,
      ),
    );
  }
  catch {
    return undefined;
  }
}

/**
 * h3 handler that serves files from `./dist/` by URL-relative path.
 *
 * @example
 * ```ts
 * app.get('/dist/**', staticHandler);
 * ```
 */
export const staticHandler: EventHandlerWithFetch = defineHandler(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- `event` is h3's H3Event, an external SDK object with mutating methods (response writes, header sets, body reads); marking it readonly would misdescribe the API contract
  function handleStaticAsset(event,) {
    return serveStatic(
      event,
      {
        // The inline form relies on contextual typing to bridge Node's
        // `Buffer<ArrayBufferLike>` from `readFile` to h3's
        // `Promise<BodyInit | ...>`; extracting to a module-scope
        // function loses that bridge and forces a structural mismatch
        // between Node and DOM typings.
        // oxlint-disable-next-line eslint-plugin-unicorn/consistent-function-scoping -- contextual typing only works inline
        getContents: function readContents(id,) {
          return readFile(
            join(
              '.',
              id,
            ),
          );
        },
        // oxlint-disable-next-line eslint-plugin-unicorn/consistent-function-scoping -- contextual typing fits the return shape to h3's `StaticAssetMeta | undefined`
        getMeta: async function getMetadata(id,) {
          /** Resolved stat result or `undefined` when the file does not exist or is inaccessible. */
          const stats = await tryStat(id,);
          return ((stats !== undefined) && stats
            .isFile())
            ? {
              size: Number(stats.size,),
              mtime: stats.mtime,
            }
            : undefined;
        },
      },
    );
  },
);
