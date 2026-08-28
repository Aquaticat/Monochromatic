import { splitFrontMatter, } from './front-matter.ts';
import { isJsonRecord, } from './json-guard.ts';
import type { SliceValidation, } from './translate-validate.ts';

//region Front matter translation
// YAML metadata is syntax-bearing localized content. Candidate shape is checked
// against archive metadata while model ensemble decides semantic translation.

/**
 * Decision addendum shared by final candidate comparisons.
 */
export const FRONT_MATTER_DECISION_RULE: string = 'The candidates are complete YAML front matter. A candidate is '
  + 'flawed if it breaks YAML fences, field names, nesting, container lengths, or scalar kinds. ORIGINAL metadata '
  + 'values are source facts. The visible name field must identify the source person and must not be replaced by an '
  + 'entry directory id.';

/**
 * Structural signature for parsed YAML value.
 *
 * @param value - parsed YAML value
 *
 * @returns Stable signature of keys, containers and scalar kinds
 *
 * @example
 * ```ts
 * const shape = yamlShape({ value: { name: 'Mittens', }, });
 * ```
 */
function yamlShape({ value, }: { readonly value: unknown; }): string {
  if (value === null)
    return 'null';
  if (Array.isArray(value,)) {
    /**
     * Child signatures in container order.
     */
    const children = value.map(function child(item,): string {
      return yamlShape({ value: item, });
    },);
    return `[${children.join(',',)}]`;
  }
  if (isJsonRecord(value,)) {
    return `{${Object.keys(value,)
      .toSorted()
      .map(function field(key,): string {
        return `${JSON.stringify(key,)}:${yamlShape({ value: value[key], })}`;
      },)
      .join(',',)}}`;
  }
  return typeof value;
}

/**
 * Validates syntax and archive-compatible key shape of front matter candidate.
 *
 * @param pageText - archive front matter candidate replaces
 *
 * @param candidateText - proposed localized front matter
 *
 * @returns Translation validation result
 *
 * @example
 * ```ts
 * const validation = validateFrontMatterTranslation({ pageText, candidateText, });
 * ```
 */
export function validateFrontMatterTranslation(
  {
    pageText,
    candidateText,
  }: {
    readonly pageText: string;
    readonly candidateText: string;
  },
): SliceValidation {
  try {
    /**
     * Parsed archive metadata defining structural shape.
     */
    const page = splitFrontMatter({ text: pageText, },);
    /**
     * Parsed candidate metadata under review.
     */
    const candidate = splitFrontMatter({ text: candidateText, },);
    if (candidate.frontMatter === undefined) {
      return {
        kind: 'invalid',
        findings: ['Your translation must remain one YAML front matter block fenced by --- lines.',],
      };
    }
    /**
     * Candidate body outside metadata fences.
     */
    const { body, } = candidate;
    /**
     * Candidate body after insignificant whitespace is removed.
     */
    const candidateBody = body.trim();
    if (candidateBody.length > 0) {
      return {
        kind: 'invalid',
        findings: ['Your translation added text outside YAML front matter block.',],
      };
    }
    if (page.frontMatter === undefined) {
      return {
        kind: 'unknown',
        detail: 'page front matter could not be read',
      };
    }
    /**
     * Parsed candidate metadata.
     */
    const { data: candidateData, } = candidate.frontMatter;
    /**
     * Parsed archive metadata.
     */
    const { data: pageData, } = page.frontMatter;
    if (yamlShape({ value: candidateData, }) !== yamlShape({ value: pageData, })) {
      return {
        kind: 'invalid',
        findings: ['Your translation changed YAML field names, nesting, container lengths, or scalar kinds.',],
      };
    }
    return {
      kind: 'valid',
      pageGrammar: 'strict',
    };
  }
  catch (error) {
    return {
      kind: 'invalid',
      findings: [`Your translation could not be parsed as YAML front matter: ${String(error,)}`,],
    };
  }
}

//endregion Front matter translation
