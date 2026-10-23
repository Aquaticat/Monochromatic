/**
 Holds every answer schema's closed-vocabulary fields to the vocabulary the stage's own guard reads (P1 of the second
 review of the Claude route). The lead ruled on 2026-10-15 that a reply format lists the labels a reply may use as an
 `enum` (`doc/audit-ledger-consistency-pass-voices-lost-and-places-left-unlocated.md`), and a live Claude call under
 the lane contest's schema returned `"verdict": "Consistent"`, valid under a plain string, refused by the guard.

 EACH CASE READS ONE FIELD OF ONE FORMAT and compares the schema's `enum` with the constant the stage's guard or
 reader reads, so the two cannot drift: the expected list is imported from the module that owns the guard, never
 retyped here. A field whose reader accepts free text, or an empty string for a negative verdict, stays a plain string
 and is pinned as one, with the reason.

 Nothing here reaches a provider: the schemas are read, never sent.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  ADJUDICATION_RESPONSE_FORMAT,
  CRITIC_RESPONSE_FORMAT,
  INTRODUCED_DEFECT_RESPONSE_FORMAT,
  INTRODUCED_DEFECT_VERDICTS,
  RESOLUTION_RESPONSE_FORMAT,
  RESOLUTION_VERDICTS,
} from '@monochromatic-dev/translation-repair-adjudication';
import { isJsonRecord, } from '@monochromatic-dev/translation-repair-document-structure';
import type { JsonSchemaResponseFormat, } from '@monochromatic-dev/translation-repair-provider';
import {
  RENDERING_AUDIT_CATEGORIES,
  RENDERING_AUDIT_RESPONSE_FORMAT,
  RENDERING_AUDIT_VERDICTS,
} from '@monochromatic-dev/translation-repair-rendering-audit';
import {
  DERIVABILITY_RESPONSE_FORMAT,
  DERIVABILITY_VERDICTS,
  RESTORATION_JUDGE_RESPONSE_FORMAT,
  RESTORATION_JUDGE_VERDICTS,
} from '@monochromatic-dev/translation-repair-repair';
import {
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  PANEL_VOTE_STATES,
} from '@monochromatic-dev/translation-repair-shared-contract';

/**
 Path element that steps into an array's items.
 */
const ITEMS = '[]';

/**
 Reads the schema node one path leads to, a member name stepping into `properties` and `[]` into `items`.

 @param format - response format read

 @param path - member names from the root, `[]` for an array's items

 @returns Node

 @throws {@link TypeError} where the path leaves the schema

 @example
 ```ts
 const node = fieldAt({ format: CRITIC_RESPONSE_FORMAT, path: ['issues', '[]', 'severity',], },);
 ```
 */
function fieldAt(
  {
    format,
    path,
  }: {
    readonly format: JsonSchemaResponseFormat;
    readonly path: readonly string[];
  },
): Readonly<Record<string, unknown>> {
  /**
   Node the walk ends at.
   */
  const node = path.reduce(
    function step(
      current: unknown,
      name: string,
    ): unknown {
      if (!isJsonRecord(current,))
        throw new TypeError(`The schema holds no object at the step ${name}`,);
      if (name === ITEMS)
        return current.items;
      return isJsonRecord(current.properties,) ? current.properties[name] : undefined;
    },
    format.json_schema.schema,
  );
  if (!isJsonRecord(node,))
    throw new TypeError(`The path ${path.join('.',)} leaves the schema`,);
  return node;
}

/**
 One closed-vocabulary field and the constant its guard reads.
 */
type VocabularyField = {
  /**
   What the case is called after: the format and the field.
   */
  readonly label: string;

  /**
   Format the field belongs to.
   */
  readonly format: JsonSchemaResponseFormat;

  /**
   Member names from the root to the field.
   */
  readonly path: readonly string[];

  /**
   The vocabulary the stage's guard or reader accepts, as its owner exports it.
   */
  readonly vocabulary: readonly string[];
};

/**
 Every closed-vocabulary field of the formats this file covers.
 */
const VOCABULARY_FIELDS: readonly VocabularyField[] = [
  {
    label: 'adjudicate vote (PANEL_VOTE_STATES, read by isPanelVoteState)',
    format: ADJUDICATION_RESPONSE_FORMAT,
    path: ['verdicts', ITEMS, 'vote',],
    vocabulary: PANEL_VOTE_STATES,
  },
  {
    label: 'adjudicate severity re-grade (ISSUE_SEVERITIES, read by isIssueSeverity)',
    format: ADJUDICATION_RESPONSE_FORMAT,
    path: ['verdicts', ITEMS, 'severity',],
    vocabulary: ISSUE_SEVERITIES,
  },
  {
    label: 'critic category (ISSUE_CATEGORIES, read by isIssueCategory)',
    format: CRITIC_RESPONSE_FORMAT,
    path: ['issues', ITEMS, 'category',],
    vocabulary: ISSUE_CATEGORIES,
  },
  {
    label: 'critic severity (ISSUE_SEVERITIES, read by isIssueSeverity)',
    format: CRITIC_RESPONSE_FORMAT,
    path: ['issues', ITEMS, 'severity',],
    vocabulary: ISSUE_SEVERITIES,
  },
  {
    label: 'introduced-defect verdict (INTRODUCED_DEFECT_VERDICTS, read by isIntroducedDefectVerdict)',
    format: INTRODUCED_DEFECT_RESPONSE_FORMAT,
    path: ['checks', ITEMS, 'verdict',],
    vocabulary: INTRODUCED_DEFECT_VERDICTS,
  },
  {
    label: 'resolution verdict (RESOLUTION_VERDICTS, read by isResolutionVerdict)',
    format: RESOLUTION_RESPONSE_FORMAT,
    path: ['checks', ITEMS, 'verdict',],
    vocabulary: RESOLUTION_VERDICTS,
  },
  {
    label: 'rendering-audit category (RENDERING_AUDIT_CATEGORIES, found by the screen)',
    format: RENDERING_AUDIT_RESPONSE_FORMAT,
    path: ['findings', ITEMS, 'category',],
    vocabulary: RENDERING_AUDIT_CATEGORIES,
  },
  {
    label: 'rendering-audit verdict (RENDERING_AUDIT_VERDICTS, found by the screen)',
    format: RENDERING_AUDIT_RESPONSE_FORMAT,
    path: ['verdict',],
    vocabulary: RENDERING_AUDIT_VERDICTS,
  },
  {
    label: 'derivability verdict (DERIVABILITY_VERDICTS, read by isDerivabilityVerdict)',
    format: DERIVABILITY_RESPONSE_FORMAT,
    path: ['judgments', ITEMS, 'verdict',],
    vocabulary: DERIVABILITY_VERDICTS,
  },
  {
    label: 'restoration verdict (RESTORATION_JUDGE_VERDICTS, read by isRestorationVerdict)',
    format: RESTORATION_JUDGE_RESPONSE_FORMAT,
    path: ['judgments', ITEMS, 'verdict',],
    vocabulary: RESTORATION_JUDGE_VERDICTS,
  },
];

await describe({
  name: 'the closed vocabularies of the answer schemas',
  concurrency: 1,
  children: [
    ...VOCABULARY_FIELDS.map(function caseOf({ label, format, path, vocabulary, },) {
      return it({
        name: `LISTS THE ${label.toUpperCase()} AS AN enum EQUAL TO THE VOCABULARY ITS GUARD READS (P1), so the model is `
          + 'held to the labels the stage accepts and the two cannot drift',
        fn: async () => {
          expect(fieldAt({ format, path, },).enum,).toEqual([...vocabulary,],);
          expect(fieldAt({ format, path, },).type,).toBe('string',);
        },
      },);
    },),

    it({
      name: 'LEAVES THE INTRODUCED-DEFECT CATEGORY AND SEVERITY AS PLAIN STRINGS (P1): the prober writes both as empty '
        + 'strings for a negative verdict, the category is "free text, telemetry only" and nothing reads either as a '
        + 'vocabulary, so an enum would forbid the empty string a negative verdict must send',
      fn: async () => {
        for (const field of ['category', 'severity',]) {
          expect(fieldAt({ format: INTRODUCED_DEFECT_RESPONSE_FORMAT, path: ['checks', ITEMS, field,], },),)
            .toEqual({ type: 'string', },);
        }
      },
    },),
  ],
},);
