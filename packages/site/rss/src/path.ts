import { notNullishOrThrow, } from '@monochromatic-dev/module-es';
import { findUp, } from 'find-up';
import { dirname, join} from 'node:path';

/**
 * Absolute path to the index.html file used for the RSS reader interface.
 * Found by searching up the directory hierarchy from the current module.
 * @throws {@link Error} If the index.html file cannot be found in the project directory hierarchy
 * @see {@link findUp} for the file search implementation
 * @see {@link STATIC_PATH} for the directory containing static assets
 */
export const INDEX_HTML_PATH: string = notNullishOrThrow(
  await findUp('index.html', { cwd: import.meta.dirname, },),
);

/**
 * Directory path containing static assets (CSS, JS) for the RSS reader interface.
 * Derived from the directory containing the index.html file.
 * @see {@link INDEX_HTML_PATH} for the source of the directory path
 * @see {@link dirname} for the path manipulation function
 */
export const STATIC_PATH: string = dirname(INDEX_HTML_PATH,);

export const IGNORE_PATH: string = join(STATIC_PATH, '..', 'ignore');
