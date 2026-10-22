/**
 Reads every answer schema a stage can send and holds it to what Anthropic's structured outputs accept (C1 of the
 review of the Claude route). The bundled API skill (`shared/tool-use-concepts.md`, "JSON Schema Limitations") says
 `additionalProperties: false` is required on every object and that the numeric, string and array bounds are not
 supported. A schema Anthropic refuses answers HTTP 400 on every call, which the ladder returns unretried and the
 router counts as a lost voice, so a seat would be silently absent from a stage.

 THREE QUESTIONS, ASKED OF EACH SCHEMA PRODUCER: is every object of the schema as the stage writes it closed, does the
 body the Claude client builds send a schema that meets every rule, and which bounds does the body drop (only the one
 the reader of its stage enforces). A FOURTH CASE KEEPS THE LIST HONEST: it reads the source of the family for files
 that declare a `json_schema` and fails when one is missing here, so a new stage schema cannot skip the check.

 NOTHING HERE REACHES A PROVIDER: the body is built and read, never sent.

 @module
 */

import { glob, readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  ADJUDICATION_RESPONSE_FORMAT,
  CANDIDATE_SELECT_RESPONSE_FORMAT,
  CRITIC_RESPONSE_FORMAT,
  INTRODUCED_DEFECT_RESPONSE_FORMAT,
  RESOLUTION_RESPONSE_FORMAT,
} from '@monochromatic-dev/translation-repair-adjudication';
import {
  ABSOLUTE_NATURALNESS_REVIEW_RESPONSE_FORMAT,
  ARCHIVE_BLOCK_REVIEW_RESPONSE_FORMAT,
  COVERAGE_RESPONSE_FORMAT,
} from '@monochromatic-dev/translation-repair-archive';
import { PAGE_TITLE_LEXICON_RESPONSE_FORMAT, } from '@monochromatic-dev/translation-repair-artifact';
import { isJsonRecord, } from '@monochromatic-dev/translation-repair-document-structure';
import {
  CONSOLIDATE_GATE_RESPONSE_FORMAT,
  CONSOLIDATION_POLISH_GATE_RESPONSE_FORMAT,
} from '@monochromatic-dev/translation-repair-consolidate';
import {
  consistencyChoiceResponseFormat,
  consistencyResponseFormat,
} from '@monochromatic-dev/translation-repair-consistency';
import { LANE_CONTEST_RESPONSE_FORMAT, } from '@monochromatic-dev/translation-repair-lane-contest';
import {
  buildClaudeBody,
  CLAUDE_MODELS,
  type JsonSchemaResponseFormat,
} from '@monochromatic-dev/translation-repair-provider';
import {
  REFERENCE_ATTEST_CONFIRM_RESPONSE_FORMAT,
  REFERENCE_ATTEST_RESPONSE_FORMAT,
} from '@monochromatic-dev/translation-repair-reference';
import { RENDERING_AUDIT_RESPONSE_FORMAT, } from '@monochromatic-dev/translation-repair-rendering-audit';
import {
  DERIVABILITY_RESPONSE_FORMAT,
  EDITOR_RESPONSE_FORMAT,
  REFINE_RESPONSE_FORMAT,
  RESTORATION_JUDGE_RESPONSE_FORMAT,
} from '@monochromatic-dev/translation-repair-repair';
import { blockPairingProtocol, } from '@monochromatic-dev/translation-repair-slice-reading';
import { SECTION_PAIRING_RESPONSE_FORMAT, } from '@monochromatic-dev/translation-repair-stage';
import {
  TRANSLATE_REPAIR_RESPONSE_FORMAT,
  TRANSLATE_RESPONSE_FORMAT,
} from '@monochromatic-dev/translation-repair-translate-floor';

//region Schema producers
// Every place a stage builds an answer schema, by the file that declares it. A producer that builds more than one
// schema (the contest ballot asks about the archive or not; the consistency sheets name their labels) lists each.

/**
 One file that declares an answer schema, and every schema it can build.
 */
type SchemaProducer = {
  /**
   Path of the file under `package/translation-repair`, as the family's source scan names it.
   */
  readonly file: string;

  /**
   Each schema the file builds, in the shapes a stage asks for.
   */
  readonly formats: readonly JsonSchemaResponseFormat[];
};

/**
 The labels a consistency sheet shows, for the schemas built per ask.
 */
const SHEET_LABELS = ['CANDIDATE 1', 'CANDIDATE 2',];

/**
 Every producer of an answer schema in the family.
 */
const SCHEMA_PRODUCERS: readonly SchemaProducer[] = [
  { file: 'adjudication/src/adjudicate-wire.ts', formats: [ADJUDICATION_RESPONSE_FORMAT,], },
  { file: 'adjudication/src/candidate-select-wire.ts', formats: [CANDIDATE_SELECT_RESPONSE_FORMAT,], },
  { file: 'adjudication/src/critic-wire.ts', formats: [CRITIC_RESPONSE_FORMAT,], },
  { file: 'adjudication/src/introduced-defect-format.ts', formats: [INTRODUCED_DEFECT_RESPONSE_FORMAT,], },
  { file: 'adjudication/src/resolution-wire.ts', formats: [RESOLUTION_RESPONSE_FORMAT,], },
  { file: 'archive/src/absolute-naturalness-review-wire.ts', formats: [ABSOLUTE_NATURALNESS_REVIEW_RESPONSE_FORMAT,], },
  { file: 'archive/src/archive-block-review-wire.ts', formats: [ARCHIVE_BLOCK_REVIEW_RESPONSE_FORMAT,], },
  { file: 'archive/src/coverage-wire.ts', formats: [COVERAGE_RESPONSE_FORMAT,], },
  { file: 'artifact/src/page-title-lexicon-wire.ts', formats: [PAGE_TITLE_LEXICON_RESPONSE_FORMAT,], },
  { file: 'consistency/src/consistency-choice.ts', formats: [consistencyChoiceResponseFormat({ labels: SHEET_LABELS, },),], },
  { file: 'consistency/src/consistency-wire.ts', formats: [consistencyResponseFormat({ labels: SHEET_LABELS, },),], },
  {
    file: 'lane-contest/src/contest-ballot-wire.ts',
    // The builder is shared by three stages, so the schemas it makes are read as the stages send them.
    formats: [
      LANE_CONTEST_RESPONSE_FORMAT,
      CONSOLIDATE_GATE_RESPONSE_FORMAT,
      CONSOLIDATION_POLISH_GATE_RESPONSE_FORMAT,
    ],
  },
  { file: 'reference/src/reference-attest-confirm-wire.ts', formats: [REFERENCE_ATTEST_CONFIRM_RESPONSE_FORMAT,], },
  { file: 'reference/src/reference-attest-wire.ts', formats: [REFERENCE_ATTEST_RESPONSE_FORMAT,], },
  { file: 'rendering-audit/src/rendering-audit-wire.ts', formats: [RENDERING_AUDIT_RESPONSE_FORMAT,], },
  { file: 'repair/src/derivability-wire.ts', formats: [DERIVABILITY_RESPONSE_FORMAT,], },
  { file: 'repair/src/edit-wire.ts', formats: [EDITOR_RESPONSE_FORMAT,], },
  { file: 'repair/src/refine-wire.ts', formats: [REFINE_RESPONSE_FORMAT,], },
  { file: 'repair/src/restoration-judge-wire.ts', formats: [RESTORATION_JUDGE_RESPONSE_FORMAT,], },
  {
    file: 'slice-reading/src/block-pairing-protocol.ts',
    formats: [
      blockPairingProtocol({
        sourceBlocks: [{ index: 0, text: 'one', },],
        targetBlocks: [{ index: 0, text: 'uno', },],
      },).responseFormat,
    ],
  },
  { file: 'stage/src/pair-sections-stage.ts', formats: [SECTION_PAIRING_RESPONSE_FORMAT,], },
  { file: 'translate-floor/src/translate-repair-wire.ts', formats: [TRANSLATE_REPAIR_RESPONSE_FORMAT,], },
  { file: 'translate-floor/src/translate-wire.ts', formats: [TRANSLATE_RESPONSE_FORMAT,], },
];

/**
 Files that mention a `json_schema` response format without declaring a stage's answer schema: the provider's own
 plumbing (the format's type, the tool projection, the Claude body) and the health probe, whose schema closes its one
 object and drops no bound.
 */
const NOT_STAGE_SCHEMAS: ReadonlySet<string> = new Set([
  'bench/src/corpus-run/model-health-probe.ts',
  'provider/src/anthropic-tool.ts',
  'provider/src/chat-contract.ts',
  'provider/src/claude-body.ts',
]);

//endregion Schema producers

//region Rules
// What the feature accepts, written out here on its own so the case does not lean on the sanitiser it checks.

/**
 Bounds the feature does not support, the ones the SDKs strip.
 */
const UNSUPPORTED_KEYWORDS: readonly string[] = [
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'uniqueItems',
];

/**
 Keywords whose value maps a name to a schema.
 */
const NAME_MAPS: ReadonlySet<string> = new Set(['properties', '$defs', 'definitions',],);

/**
 Keywords whose value is one schema.
 */
const SCHEMA_VALUED: ReadonlySet<string> = new Set(['items', 'not', 'if', 'then', 'else',],);

/**
 Keywords whose value is a list of schemas.
 */
const SCHEMA_LISTS: ReadonlySet<string> = new Set(['anyOf', 'allOf', 'oneOf', 'prefixItems',],);

/**
 One schema node and where it sits.
 */
type SchemaNode = {
  /**
   Dotted path from the root, names under `properties` included.
   */
  readonly path: string;

  /**
   The node.
   */
  readonly node: Readonly<Record<string, unknown>>;
};

/**
 Every schema node under a schema and the schema itself, a name under `properties` read as a name and not as a keyword.

 @param schema - schema read
 @param path - where it sits

 @returns The nodes, the root first

 @example
 ```ts
 const nodes = schemaNodesOf({ schema: { type: 'object', }, path: 'root', },);
 ```
 */
function schemaNodesOf(
  {
    schema,
    path,
  }: {
    readonly schema: Readonly<Record<string, unknown>>;
    readonly path: string;
  },
): readonly SchemaNode[] {
  return [
    { path, node: schema, },
    ...Object.entries(schema,)
      .flatMap(function nodesBelow([keyword, value,],): readonly SchemaNode[] {
        if (NAME_MAPS.has(keyword,) && isJsonRecord(value,)) {
          return Object.entries(value,)
            .flatMap(function nodesOfMember([name, member,],): readonly SchemaNode[] {
              return isJsonRecord(member,)
                ? schemaNodesOf({ schema: member, path: `${path}.${name}`, },)
                : [];
            },);
        }
        if (SCHEMA_VALUED.has(keyword,) && isJsonRecord(value,))
          return schemaNodesOf({ schema: value, path: `${path}.${keyword}`, },);
        if (SCHEMA_LISTS.has(keyword,) && Array.isArray(value,)) {
          return value.flatMap(function nodesOfItem(item: unknown, index,): readonly SchemaNode[] {
            return isJsonRecord(item,)
              ? schemaNodesOf({ schema: item, path: `${path}.${keyword}[${String(index,)}]`, },)
              : [];
          },);
        }
        return [];
      },),
  ];
}

/**
 The objects of a schema that are not closed with `additionalProperties: false`.

 @param schema - schema read

 @returns The paths of the open objects

 @example
 ```ts
 const open = openObjectsOf({ schema, },);
 ```
 */
function openObjectsOf({ schema, }: { readonly schema: Readonly<Record<string, unknown>>; },): readonly string[] {
  return schemaNodesOf({ schema, path: 'root', },)
    .filter(function isObject({ node, },): boolean {
      return (node.type === 'object') || isJsonRecord(node.properties,);
    },)
    .filter(function isOpen({ node, },): boolean {
      return node.additionalProperties !== false;
    },)
    .map(function pathOf({ path, },): string {
      return path;
    },);
}

/**
 The unsupported bounds a schema carries, each as the path it sits at and its keyword.

 @param schema - schema read

 @returns One entry per bound, `path: keyword`

 @example
 ```ts
 const bounds = unsupportedBoundsOf({ schema, },);
 ```
 */
function unsupportedBoundsOf({ schema, }: { readonly schema: Readonly<Record<string, unknown>>; },): readonly string[] {
  return schemaNodesOf({ schema, path: 'root', },)
    .flatMap(function boundsOf({ path, node, },): readonly string[] {
      return UNSUPPORTED_KEYWORDS
        .filter(function isCarried(keyword,): boolean {
          return Object.hasOwn(node, keyword,);
        },)
        .map(function named(keyword,): string {
          return `${path}: ${keyword}`;
        },);
    },);
}

//endregion Rules

/**
 Every schema of every producer, named by the file and the schema's own name.

 @returns One entry per schema

 @example
 ```ts
 const named = schemasOf();
 ```
 */
function schemasOf(): readonly {
  readonly label: string;
  readonly format: JsonSchemaResponseFormat;
}[] {
  return SCHEMA_PRODUCERS.flatMap(function schemasOfProducer({ file, formats, },) {
    return formats.map(function labelled(format,) {
      return { label: `${file} (${format.json_schema.name})`, format, };
    },);
  },);
}

/**
 Repository-relative root of the family, where the producers' paths start.
 */
const FAMILY_ROOT = join(import.meta.dirname, '..', '..',);

await describe({
  name: 'the answer schemas the Claude route sends',
  concurrency: 1,
  children: [
    it({
      name: 'LISTS EVERY FILE OF THE FAMILY THAT DECLARES AN ANSWER SCHEMA, so a stage schema added later cannot skip '
        + 'the schema cases of this file: the family\'s source is searched for a json_schema format, and each file found is a '
        + 'producer here or a named exception',
      fn: async () => {
        /**
         Files of the family's source that write a `json_schema` response format.
         */
        const declaring: string[] = [];
        for await (const file of glob('*/src/**/*.ts', { cwd: FAMILY_ROOT, },)) {
          if (file.includes('node_modules',) || file.includes('.test',))
            continue;
          if ((await readFile(join(FAMILY_ROOT, file,), 'utf8',)).includes('type: \'json_schema\'',))
            declaring.push(file,);
        }
        expect(declaring.toSorted(),).toEqual([
          ...SCHEMA_PRODUCERS.map(function fileOf({ file, },): string {
            return file;
          },),
          ...NOT_STAGE_SCHEMAS,
        ].toSorted(),);
      },
    },),

    it({
      name: 'CLOSES EVERY OBJECT OF EVERY SCHEMA AS THE STAGE WRITES IT, so the schema is acceptable to Anthropic '
        + 'without the client narrowing it and the omission is never relied on (C1: the block pairing protocol and '
        + 'the contest ballot left objects open)',
      fn: async () => {
        expect(schemasOf()
          .flatMap(function openIn({ label, format, },): readonly string[] {
            return openObjectsOf({ schema: format.json_schema.schema, },)
              .map(function named(path,): string {
                return `${label} ${path}`;
              },);
          },),).toEqual([],);
      },
    },),

    it({
      name: 'SENDS A SCHEMA THAT MEETS EVERY RULE, for every schema, through the Claude body on both models: every '
        + 'object closed, none of the unsupported bounds, and the name and members of the schema intact',
      fn: async () => {
        for (const modelId of ['claude-sonnet-5-5', 'claude-haiku-5-5',] as const) {
          /**
           Faults found in the schemas the body carries for this model.
           */
          const faults = schemasOf()
            .flatMap(function faultsOf({ label, format, },): readonly string[] {
              const body = buildClaudeBody({
                card: CLAUDE_MODELS[modelId],
                messages: [{ role: 'user', content: 'Where does the cat sleep?', },],
                responseFormat: format,
                maxTokens: 100,
              },);
              /**
               The schema the body sends.
               */
              const sent = ((body.output_config as { readonly format: { readonly schema: unknown; }; }).format
                .schema) as Readonly<Record<string, unknown>>;
              return [
                ...openObjectsOf({ schema: sent, },)
                  .map(function openNamed(path,): string {
                    return `${label} sends an open object at ${path}`;
                  },),
                ...unsupportedBoundsOf({ schema: sent, },)
                  .map(function boundNamed(bound,): string {
                    return `${label} sends ${bound}`;
                  },),
                ...(JSON.stringify(Object.keys((sent.properties ?? {}) as object,),)
                  === JSON.stringify(Object.keys((format.json_schema.schema.properties ?? {}) as object,),)
                  ? []
                  : [`${label} changed its members`,]),
              ];
            },);
          expect(faults,).toEqual([],);
        }
      },
    },),

    it({
      name: 'DROPS ONE BOUND IN THE WHOLE FAMILY, minimum 1 on the paragraph of a naturalness finding, which '
        + '`isAbsoluteNaturalnessReviewWire` still enforces (its case "REFUSES A FINDING WITH paragraph BELOW ONE"); a '
        + 'bound added to any other schema lists here and needs its reader\'s check named',
      fn: async () => {
        expect(schemasOf()
          .flatMap(function boundsIn({ label, format, },): readonly string[] {
            return unsupportedBoundsOf({ schema: format.json_schema.schema, },)
              .map(function named(bound,): string {
                return `${label} ${bound}`;
              },);
          },),).toEqual([
            'archive/src/absolute-naturalness-review-wire.ts (absolute_naturalness_review) '
              + 'root.findings.items.paragraph: minimum',
          ],);
      },
    },),
  ],
},);
