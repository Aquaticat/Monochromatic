import { join, } from 'node:path';

//region Constants

/**
 * User-level Pi extension configuration directory below home.
 */
const PI_EXTENSION_CONFIG_DIRECTORY = join(
  '.pi',
  'agent',
  'extensions',
);

/**
 * Ask-user extension config filename.
 */
const ASK_USER_QUESTION_CONFIG_FILENAME = 'pi-ask-user-question.json';

//endregion Constants

//region Path

/**
 * Resolves user-level ask-user extension config path.
 *
 * @param home - user home directory
 *
 * @returns absolute JSON config path
 *
 * @example
 * ```ts
 * askUserQuestionConfigPath({ home: '/home/user' });
 * ```
 */
export function askUserQuestionConfigPath(
  { home, }: { readonly home: string; },
): string {
  return join(
    home,
    PI_EXTENSION_CONFIG_DIRECTORY,
    ASK_USER_QUESTION_CONFIG_FILENAME,
  );
}

//endregion Path
