import { frontMatterCommentAuthorityFindings, } from './front-matter-comment-authority.ts';
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
  + 'entry directory id. When ORIGINAL name and info.alias are the same identity, translated name and info.alias must '
  + 'also be the same identity; a candidate retaining a different archive name is invalid. In info.location comments, '
  + 'keep established target contributor spelling after `, by ` where source and archive spell that contributor differently.';

/**
 * Visible identity read from standard fields, or another metadata schema.
 *
 * @example
 * ```ts
 * const identity: VisibleIdentityReading = { kind: 'present', name: 'Mittens', alias: 'Mittens', };
 * ```
 */
type VisibleIdentityReading =
  | {
    /**
     * Standard visible identity fields are present.
     */
    readonly kind: 'present';

    /**
     * Primary visible name.
     */
    readonly name: string;

    /**
     * Alias nested under metadata info.
     */
    readonly alias: string;
  }
  | {
    /**
     * Metadata uses another schema and carries no enforceable relation here.
     */
    readonly kind: 'other-schema';
  };

/**
 * Reads standard visible identity fields from parsed metadata.
 *
 * @param value - parsed YAML document
 *
 * @returns Identity pair, or nothing when document uses another schema
 *
 * @example
 * ```ts
 * const identity = visibleIdentityOf({ value: { name: 'Mittens', info: { alias: 'Mittens', }, }, });
 * ```
 */
function visibleIdentityOf({ value, }: { readonly value: unknown; },): VisibleIdentityReading {
  if (!isJsonRecord(value,))
    return { kind: 'other-schema', };
  /**
   * Nested metadata containing declared alias.
   */
  const { info, } = value;
  if (!isJsonRecord(info,))
    return { kind: 'other-schema', };
  /**
   * Primary value whose relationship carries source identity.
   */
  const { name, } = value;
  /**
   * Alias value whose relationship carries source identity.
   */
  const { alias, } = info;
  if ((typeof name) !== 'string')
    return { kind: 'other-schema', };
  if ((typeof alias) !== 'string')
    return { kind: 'other-schema', };
  return {
    kind: 'present',
    name,
    alias,
  };
}

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
 * @param sourceText - source front matter whose identity relationships govern
 *
 * @param pageText - archive front matter candidate replaces
 *
 * @param candidateText - proposed localized front matter
 *
 * @returns Translation validation result
 *
 * @example
 * ```ts
 * const validation = validateFrontMatterTranslation({ sourceText, pageText, candidateText, });
 * ```
 */
export function validateFrontMatterTranslation(
  {
    sourceText,
    pageText,
    candidateText,
  }: {
    readonly sourceText: string;
    readonly pageText: string;
    readonly candidateText: string;
  },
): SliceValidation {
  try {
    /**
     * Parsed source metadata defining identity relationships.
     */
    const source = splitFrontMatter({ text: sourceText, },);
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
    if (source.frontMatter === undefined) {
      return {
        kind: 'unknown',
        detail: 'source front matter could not be read',
      };
    }
    if (page.frontMatter === undefined) {
      return {
        kind: 'unknown',
        detail: 'page front matter could not be read',
      };
    }
    /**
     * Parsed source metadata.
     */
    const { data: sourceData, } = source.frontMatter;
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
    /**
     * Comment attribution findings grounded at same YAML path.
     */
    const commentFindings = frontMatterCommentAuthorityFindings({
      sourceText,
      pageText,
      candidateText,
    },);
    if (commentFindings.length > 0) {
      return {
        kind: 'invalid',
        findings: commentFindings,
      };
    }
    /**
     * Source identity pair, when standard fields expose one.
     */
    const sourceIdentity = visibleIdentityOf({ value: sourceData, },);
    /**
     * Candidate identity pair under same standard fields.
     */
    const candidateIdentity = visibleIdentityOf({ value: candidateData, },);
    if ((sourceIdentity.kind === 'present')
      && (sourceIdentity.name === sourceIdentity.alias)
      && ((candidateIdentity.kind !== 'present') || (candidateIdentity.name !== candidateIdentity.alias))) {
      return {
        kind: 'invalid',
        findings: [
          'Your translation must keep name and info.alias as same visible identity because ORIGINAL declares them as same identity.',
        ],
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
