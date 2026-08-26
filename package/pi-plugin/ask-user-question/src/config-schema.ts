import {
  type AskUserQuestionConfigFile,
  AskUserQuestionConfigError,
} from './config-types.ts';

//region Constants

/**
 * Supported user config keys.
 */
const CONFIG_KEYS: ReadonlySet<string> = new Set([
  'editor',
],);

//endregion Constants

//region Guards

/**
 * Narrows decoded JSON to a non-array object record.
 *
 * @param value - decoded JSON candidate
 *
 * @returns whether string-keyed fields can be read
 */
function isUnknownRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  if (value === null)
    return false;
  if ((typeof value) !== 'object')
    return false;
  return !Array.isArray(value,);
}

//endregion Guards

//region Validation

/**
 * Validates decoded user config.
 *
 * @param value - decoded JSON candidate
 *
 * @param configPath - path included in diagnostics
 *
 * @returns supported config fields
 *
 * @throws {@link AskUserQuestionConfigError} for malformed fields or unknown keys
 *
 * @example
 * ```ts
 * validateAskUserQuestionConfig({ value: { editor: 'nano' }, configPath: '/home/user/config.json' });
 * ```
 */
export function validateAskUserQuestionConfig({
  value,
  configPath,
}: {
  readonly value: unknown;
  readonly configPath: string;
}): AskUserQuestionConfigFile {
  if (!isUnknownRecord(value,))
    throw new AskUserQuestionConfigError(`Ask-user-question config must be an object at ${configPath}.`,);
  /**
   * Unsupported keys sorted for deterministic diagnostics.
   */
  const unknownKeys = Object.keys(value,)
    .filter(function isUnknownConfigKey(key,): boolean {
      return !CONFIG_KEYS.has(key,);
    },)
    .toSorted();
  if (unknownKeys.length > 0)
    throw new AskUserQuestionConfigError(`Ask-user-question config has unknown keys at ${configPath}: ${unknownKeys.join(', ',)}`,);
  /**
   * Optional editor command candidate.
   */
  const { editor, } = value;
  if (editor === undefined)
    return {};
  if (((typeof editor) !== 'string') || (editor.trim()
    .length
    === 0))
    throw new AskUserQuestionConfigError(`Ask-user-question config editor must be a nonempty string at ${configPath}.`,);
  return { editor: editor.trim(), };
}

//endregion Validation
