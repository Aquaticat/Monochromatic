//region Detached entry

/**
 Startup code travels in argv rather than in a file that cancellation can delete.
 Paths stay in separate arguments, never interpolated into JavaScript syntax.
 Only missing request-owned inputs mean cancellation; other load failures remain errors.
 The helper still authenticates before opening an editor.
 */
export const ANSWER_BOOTSTRAP = `
import { pathToFileURL } from 'node:url';
const helper = pathToFileURL(process.argv[1]);
try {
  await import(helper.href);
} catch (error) {
  if ((error.code === 'ERR_MODULE_NOT_FOUND' && error.url === helper.href)
    || (error.code === 'ENOENT' && error.path === process.argv.at(-1))) {
    console.log('This question is no longer active. Return to Pi for the current question.');
  } else {
    throw error;
  }
}
`;

//endregion Detached entry
