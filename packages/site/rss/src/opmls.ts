import {
  createObservableAsync,
} from '@monochromatic-dev/module-es';
import { findUp, } from 'find-up';
import Watcher from 'watcher';
import { z, } from 'zod/v4-mini';
import { lOpmls as l, } from './log.ts';
import { onOpmlsChange, } from './outline.ts';

/**
 * Path to the .env file if found in the project directory hierarchy.
 * Used to determine support for relative URLs in OPML file paths.
 * @see {@link opmls} for how this affects URL validation
 */
export const DOT_ENV_PATH: string | undefined = await findUp('.env',);

/**
 * Zod schema for validating OPML URLs.
 * Supports both file:// URLs (absolute or relative if .env is present) and http(s):// URLs.
 * @see {@link z} for the schema validation library
 * @see {@link DOT_ENV_PATH} for relative URL support
 */
export const OPMLS_SCHEMA: z.ZodMiniArray<
  z.ZodMiniUnion<readonly [z.ZodMiniURL, z.ZodMiniURL,]>
> = z
  .array(z.union([
    z.url({ protocol: /^https?$/, hostname: z.regexes.domain, },),
    z
      .url({ protocol: /file/, pattern: DOT_ENV_PATH ? /./ : /^file:\/{3}/, },),
  ],),);

if (DOT_ENV_PATH) {
  const watcher = new Watcher(DOT_ENV_PATH, {
    ignoreInitial: false,
    debounce: 100,
  },);
  watcher.on('all', updateOpmls,);
}

/**
 * Array of validated URLs pointing to OPML files.
 * Supports both file:// URLs (absolute or relative if .env is present) and http(s):// URLs.
 * Used to fetch and parse RSS feed sources.
 * @see {@link DOT_ENV_PATH} for relative URL support
 * @see {@link OPMLS_SCHEMA} for validation schema
 */
const opmls: z.infer<typeof OPMLS_SCHEMA> = [];

export const opmlsObservable: {
  value: string[];
} = await createObservableAsync(opmls, onOpmlsChange,);

function updateOpmls(): void {
  l.debug`updateOpmls`;
  opmlsObservable.value = OPMLS_SCHEMA
    .parse(process.env.OPMLS?.split(',',) ?? [],);
  l.debug`updateOpmls ${opmlsObservable.value}`;
}
