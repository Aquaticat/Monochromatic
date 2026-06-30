/**
 * Legacy frontmatter date parsing.
 *
 * These fields are migration diagnostics only. Rendering continues to use
 * git-derived dates from `git-dates.ts`.
 */

/**
 * Sentinel returned when a frontmatter date field is absent.
 */
const NO_AUTHORED_DATE: unique symbol = Symbol('frontmatter authored date missing',);

/**
 * Frontmatter date fields accepted only for migration diagnostics.
 */
export type AuthoredDateFieldName = 'date' | 'published' | 'updated';

/**
 * Optional date fields a human may have left in MDX frontmatter.
 *
 * The SSG never uses these as rendered dates. They are preserved so the build
 * can warn when authored dates diverge from git-derived dates.
 */
export type AuthoredDateFields = {
  /**
   * Legacy singular date field, compared with git-derived `updated`.
   */
  readonly date?: Date;
  /**
   * Legacy authored publication date, compared with git-derived `published`.
   */
  readonly published?: Date;
  /**
   * Legacy authored modification date, compared with git-derived `updated`.
   */
  readonly updated?: Date;
};

/**
 * Supported raw date representations accepted from YAML parsing.
 */
type RawAuthoredDate = string | number | Date;

/**
 * Parses a supported frontmatter value into a valid Date.
 *
 * @param rawValue - supported raw frontmatter value
 *
 * @param fieldName - date-like key being parsed
 *
 * @param filePath - MDX file path included in validation errors
 *
 * @returns parsed JavaScript Date
 *
 * @throws when the raw value does not represent a valid date
 *
 * @example
 * ```ts
 * const date = parseAuthoredDateValue({
 *   rawValue: '2026-05-14',
 *   fieldName: 'updated',
 *   filePath: 'src/content/en/post.mdx',
 * });
 * ```
 */
function parseAuthoredDateValue(
  {
    rawValue,
    fieldName,
    filePath,
  }: {
    readonly rawValue: RawAuthoredDate;
    readonly fieldName: AuthoredDateFieldName;
    readonly filePath: string;
  },
): Date {
  /**
   * Date object parsed from a supported frontmatter date representation.
   */
  const date = new Date(rawValue,);
  if (Number.isNaN(date.getTime(),)) {
    throw new Error(
      `Frontmatter ${fieldName} in ${filePath} is not a valid date. Git history remains the source of truth for rendered dates.`,
    );
  }

  return date;
}

/**
 * Converts an optional raw frontmatter field into a Date for divergence checks.
 *
 * @param rawData - parsed YAML frontmatter record
 *
 * @param fieldName - date-like key to inspect
 *
 * @param filePath - MDX file path included in validation errors
 *
 * @returns parsed date, or {@link NO_AUTHORED_DATE} when the key is absent
 *
 * @throws when a present date field is not parseable as a JavaScript Date
 *
 * @example
 * ```ts
 * const date = readAuthoredDateField({
 *   rawData: { updated: '2026-05-14' },
 *   fieldName: 'updated',
 *   filePath: 'src/content/en/post.mdx',
 * });
 * ```
 */
function readAuthoredDateField(
  {
    rawData,
    fieldName,
    filePath,
  }: {
    readonly rawData: Readonly<Record<string, unknown>>;
    readonly fieldName: AuthoredDateFieldName;
    readonly filePath: string;
  },
): Date | typeof NO_AUTHORED_DATE {
  /**
   * Raw field value from parsed YAML, intentionally read before the validated
   * frontmatter schema strips unknown keys.
   */
  const rawValue = rawData[fieldName];
  if (rawValue === undefined)
    return NO_AUTHORED_DATE;

  if ((typeof rawValue) === 'string') {
    return parseAuthoredDateValue({
      rawValue,
      fieldName,
      filePath,
    },);
  }

  if ((typeof rawValue) === 'number') {
    return parseAuthoredDateValue({
      rawValue,
      fieldName,
      filePath,
    },);
  }

  if (rawValue instanceof Date) {
    return parseAuthoredDateValue({
      rawValue,
      fieldName,
      filePath,
    },);
  }

  throw new Error(
    `Frontmatter ${fieldName} in ${filePath} must be a string, number, or Date when present. Git history remains the source of truth for rendered dates.`,
  );
}

/**
 * Reads optional authored frontmatter dates for later git divergence warnings.
 *
 * @param rawData - parsed YAML frontmatter record
 *
 * @param filePath - MDX file path included in validation errors
 *
 * @returns authored date fields, excluding absent keys
 *
 * @example
 * ```ts
 * const dates = readAuthoredDates({
 *   rawData: { date: '2026-05-14' },
 *   filePath: 'src/content/en/post.mdx',
 * });
 * ```
 */
export function readAuthoredDates(
  {
    rawData,
    filePath,
  }: {
    readonly rawData: Readonly<Record<string, unknown>>;
    readonly filePath: string;
  },
): AuthoredDateFields {
  /**
   * Legacy singular date field, compared with git-derived `updated`.
   */
  const date = readAuthoredDateField({
    rawData,
    fieldName: 'date',
    filePath,
  },);
  /**
   * Legacy authored publication date, compared with git-derived `published`.
   */
  const published = readAuthoredDateField({
    rawData,
    fieldName: 'published',
    filePath,
  },);
  /**
   * Legacy authored modification date, compared with git-derived `updated`.
   */
  const updated = readAuthoredDateField({
    rawData,
    fieldName: 'updated',
    filePath,
  },);

  return {
    ...(date === NO_AUTHORED_DATE ? {} : { date, }),
    ...(published === NO_AUTHORED_DATE ? {} : { published, }),
    ...(updated === NO_AUTHORED_DATE ? {} : { updated, }),
  };
}
