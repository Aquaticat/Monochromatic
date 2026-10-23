/**
 Tests for the schema the Claude body sends (`claude-schema.ts`). Anthropic's structured outputs take a narrower
 JSON Schema than the stages write: `additionalProperties: false` is required on every object, and the numeric,
 string and array bounds are not supported (the bundled API skill, `shared/tool-use-concepts.md`, "JSON Schema
 Limitations"; the official SDKs strip the bounds and check them client-side, and this client is raw HTTP). The
 sanitiser is the one place the narrowing happens, so every case here reads what it returns and what it leaves alone.
 A stripped bound is told to the model in the field's description, in the form the live Structured outputs page gives
 ("How SDK transformation works", step 2: `{minimum: 100}`), and a keyword the feature refuses that no SDK strips
 stops the build of the body with a named error instead of answering HTTP 400 at the first live call.
 Fixtures are cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { claudeSchemaOf, } from '../dist/final/node/index.mjs';

await describe({
  name: claudeSchemaOf.name,
  children: [
    it({
      name: 'CLOSES EVERY OBJECT, whether it sits under properties, items, anyOf or a definition, and whether it '
        + 'declares properties or only a type, and replaces an additionalProperties that allows more with false',
      fn: async () => {
        expect(claudeSchemaOf({
          schema: {
            type: 'object',
            properties: {
              lap: { properties: { warm: { type: 'boolean', }, }, },
              naps: { type: 'array', items: { type: 'object', additionalProperties: true, }, },
              either: { anyOf: [{ type: 'object', }, { type: 'string', },], },
            },
            $defs: { bowl: { type: 'object', properties: {}, }, },
          },
        },),).toEqual({
          type: 'object',
          properties: {
            lap: { properties: { warm: { type: 'boolean', }, }, additionalProperties: false, },
            naps: { type: 'array', items: { type: 'object', additionalProperties: false, }, },
            either: { anyOf: [{ type: 'object', additionalProperties: false, }, { type: 'string', },], },
          },
          $defs: { bowl: { type: 'object', properties: {}, additionalProperties: false, }, },
          additionalProperties: false,
        },);
      },
    },),

    it({
      name: 'DROPS EACH BOUND THE FEATURE DOES NOT SUPPORT, numeric, string and array, and keeps the keywords it does '
        + 'support: type, enum, const, required, description and format',
      fn: async () => {
        expect(claudeSchemaOf({
          schema: {
            type: 'object',
            properties: {
              age: { type: 'integer', minimum: 1, maximum: 30, exclusiveMinimum: 0, exclusiveMaximum: 31, multipleOf: 1, },
              name: { type: 'string', minLength: 1, maxLength: 20, description: 'what the cat answers to', },
              toys: { type: 'array', minItems: 1, maxItems: 5, uniqueItems: true, items: { type: 'string', enum: ['yarn', 'mouse',], }, },
              kind: { const: 'tabby', },
            },
            required: ['age', 'name',],
          },
        },),).toEqual({
          type: 'object',
          properties: {
            age: {
              type: 'integer',
              description: '{minimum: 1, maximum: 30, exclusiveMinimum: 0, exclusiveMaximum: 31, multipleOf: 1}',
            },
            name: { type: 'string', description: 'what the cat answers to\n\n{minLength: 1, maxLength: 20}', },
            toys: {
              type: 'array',
              items: { type: 'string', enum: ['yarn', 'mouse',], },
              description: '{minItems: 1, maxItems: 5, uniqueItems: true}',
            },
            kind: { const: 'tabby', },
          },
          required: ['age', 'name',],
          additionalProperties: false,
        },);
      },
    },),

    it({
      name: 'LEAVES A MEMBER NAMED LIKE A KEYWORD ALONE: a property called minimum or maxLength is a name under '
        + 'properties and not a bound, and an enum or const value that spells a keyword is data',
      fn: async () => {
        expect(claudeSchemaOf({
          schema: {
            type: 'object',
            properties: {
              minimum: { type: 'string', },
              maxLength: { type: 'integer', minimum: 0, },
              pick: { type: 'string', enum: ['minimum', 'uniqueItems',], },
            },
            required: ['minimum',],
          },
        },),).toEqual({
          type: 'object',
          properties: {
            minimum: { type: 'string', },
            maxLength: { type: 'integer', description: '{minimum: 0}', },
            pick: { type: 'string', enum: ['minimum', 'uniqueItems',], },
          },
          required: ['minimum',],
          additionalProperties: false,
        },);
      },
    },),

    it({
      name: 'TELLS THE MODEL A STRIPPED BOUND IN THE FIELD\'S DESCRIPTION (R6), as the SDKs do: minimum 1 on an integer '
        + 'becomes a plain integer described as {minimum: 1}, a bound beside a description is appended to it after a '
        + 'blank line, and a field with no bound gains no description',
      fn: async () => {
        expect(claudeSchemaOf({
          schema: {
            type: 'object',
            properties: {
              paragraph: { type: 'integer', minimum: 1, },
              spot: { type: 'string', description: 'where the cat sleeps', maxLength: 40, },
              mood: { type: 'string', },
            },
          },
        },),).toEqual({
          type: 'object',
          properties: {
            paragraph: { type: 'integer', description: '{minimum: 1}', },
            spot: { type: 'string', description: 'where the cat sleeps\n\n{maxLength: 40}', },
            mood: { type: 'string', },
          },
          additionalProperties: false,
        },);
      },
    },),

    it({
      name: 'REFUSES A KEYWORD THE FEATURE DOES NOT SUPPORT AND NO SDK STRIPS (R10), by a named error that names the '
        + 'keyword and where it sits, so a stage schema that writes oneOf, not, if, pattern, '
        + 'patternProperties, contains or prefixItems fails when its body is built and not with HTTP 400 '
        + 'at the first live call',
      fn: async () => {
        /**
         Each refused keyword with a schema that carries it somewhere below the root, and the path it must be named at.
         */
        const cases: readonly {
          readonly keyword: string;
          readonly schema: Readonly<Record<string, unknown>>;
          readonly path: string;
        }[] = [
          {
            keyword: 'oneOf',
            schema: { type: 'object', properties: { pick: { oneOf: [{ type: 'string', }, { type: 'integer', },], }, }, },
            path: 'root.pick',
          },
          {
            keyword: 'not',
            schema: { type: 'object', properties: { naps: { type: 'array', items: { not: { type: 'null', }, }, }, }, },
            path: 'root.naps.items',
          },
          {
            keyword: 'if',
            schema: { type: 'object', properties: { bowl: { if: { type: 'string', }, }, }, },
            path: 'root.bowl',
          },
          {
            keyword: 'pattern',
            schema: { type: 'object', properties: { name: { type: 'string', pattern: '^[a-z]+$', }, }, },
            path: 'root.name',
          },
          {
            keyword: 'prefixItems',
            schema: { type: 'object', properties: { pair: { type: 'array', prefixItems: [{ type: 'string', },], }, }, },
            path: 'root.pair',
          },
          {
            keyword: 'patternProperties',
            schema: { type: 'object', patternProperties: { '^x': { type: 'string', }, }, },
            path: 'root',
          },
          {
            keyword: 'contains',
            schema: { type: 'object', properties: { toys: { type: 'array', contains: { type: 'string', }, }, }, },
            path: 'root.toys',
          },
          {
            keyword: 'oneOf',
            schema: { type: 'object', properties: { either: { anyOf: [{ type: 'string', }, { oneOf: [{ type: 'null', },], },], }, }, },
            path: 'root.either.anyOf[1]',
          },
        ];
        for (const { keyword, schema, path, } of cases) {
          /**
           The failure the schema is refused with.
           */
          let caught: unknown;
          try {
            claudeSchemaOf({ schema, },);
          }
          catch (error) {
            caught = error;
          }
          expect(caught,).toBeInstanceOf(Error,);
          expect((caught as Error).name,).toBe('ClaudeSchemaKeywordError',);
          expect((caught as Error & { readonly messageNamesOnly?: boolean; }).messageNamesOnly,).toBe(true,);
          expect((caught as Error).message,).toContain(`"${keyword}"`,);
          expect((caught as Error).message,).toContain(path,);
        }
      },
    },),

    it({
      name: 'REFUSES NOTHING THE FEATURE SUPPORTS OR THE SDKS STRIP (R10): every keyword on the allowlist passes, and '
        + 'a member named oneOf, or an enum value that spells a refused keyword, is data and not a keyword',
      fn: async () => {
        expect(() =>
          claudeSchemaOf({
            schema: {
              type: 'object',
              title: 'a cat',
              description: 'one cat',
              properties: {
                oneOf: { type: 'string', enum: ['not', 'pattern',], default: 'not', },
                at: { type: 'string', format: 'date-time', },
                kind: { const: 'tabby', },
                both: { allOf: [{ type: 'string', },], },
                nap: { anyOf: [{ type: 'string', }, { type: 'null', },], },
                bowl: { $ref: '#/$defs/bowl', },
              },
              required: ['oneOf',],
              $defs: { bowl: { type: 'string', }, },
              definitions: { dish: { type: 'string', }, },
            },
          },)).not.toThrow();
      },
    },),

    it({
      name: 'SENDS A PATTERN, WHICH THE STRUCTURED OUTPUTS PAGE LISTS AS SUPPORTED (F7), and a keyed call of 2026-10-22 '
        + 'accepted: it stays on the node beside its type and gains no description',
      fn: async () => {
        expect(claudeSchemaOf({
          schema: { type: 'object', properties: { name: { type: 'string', pattern: '^[a-z]+(\\d{1,3})?$', }, }, },
        },),).toEqual({
          type: 'object',
          properties: { name: { type: 'string', pattern: '^[a-z]+(\\d{1,3})?$', }, },
          additionalProperties: false,
        },);
      },
    },),

    it({
      name: 'REFUSES A PATTERN WRITTEN WITH A CONSTRUCT THE PAGE LISTS AS NOT SUPPORTED (F7): a backreference, a '
        + 'lookahead, a lookbehind and a word boundary, named by a ClaudeSchemaKeywordError at the node, and leaves a '
        + 'pattern that spells them as data (an escaped backslash, a character class)',
      fn: async () => {
        /**
         Patterns the page refuses, each with the text the error must carry.
         */
        const refused: readonly (readonly [string, string])[] = [
          ['^(a)\\1$', 'backreference',],
          ['^a(?=b)', 'lookahead',],
          ['^a(?!b)', 'lookahead',],
          ['(?<=a)b', 'lookbehind',],
          ['(?<!a)b', 'lookbehind',],
          ['\\bcat\\b', 'word boundary',],
          ['\\Bcat', 'word boundary',],
        ];
        refused.forEach(function refuses([pattern, construct,],): void {
          /**
           Failure the schema is refused with.
           */
          const failure = (function refusal(): unknown {
            try {
              claudeSchemaOf({ schema: { type: 'object', properties: { name: { type: 'string', pattern, }, }, }, },);
              return undefined;
            }
            catch (error) {
              return error;
            }
          })();
          expect(failure,).toBeInstanceOf(Error,);
          expect((failure as Error).name,).toBe('ClaudeSchemaKeywordError',);
          expect((failure as Error).message,).toContain(construct,);
          expect((failure as Error).message,).toContain('root.name',);
        },);
        expect(() =>
          claudeSchemaOf({
            schema: {
              type: 'object',
              properties: { name: { type: 'string', pattern: '^[\\b]\\\\1(?:a|b)(?<kind>c)$', }, },
            },
          },)).not.toThrow();
      },
    },),

    it({
      name: 'KEEPS minItems OF 0 OR 1, WHICH THE PAGE LISTS AS SUPPORTED, AND TELLS THE MODEL ANY OTHER (F7)',
      fn: async () => {
        expect(claudeSchemaOf({
          schema: {
            type: 'object',
            properties: {
              some: { type: 'array', items: { type: 'string', }, minItems: 1, },
              any: { type: 'array', items: { type: 'string', }, minItems: 0, },
              pair: { type: 'array', items: { type: 'string', }, minItems: 2, },
            },
          },
        },).properties,).toEqual({
          some: { type: 'array', items: { type: 'string', }, minItems: 1, },
          any: { type: 'array', items: { type: 'string', }, minItems: 0, },
          pair: { type: 'array', items: { type: 'string', }, description: '{minItems: 2}', },
        },);
      },
    },),

    it({
      name: 'KEEPS A format ON THE PAGE\'S LIST OF TEN AND TELLS THE MODEL ANY OTHER (F7), as the SDKs filter it',
      fn: async () => {
        expect(claudeSchemaOf({
          schema: {
            type: 'object',
            properties: {
              at: { type: 'string', format: 'date-time', },
              id: { type: 'string', format: 'uuid', },
              tint: { type: 'string', format: 'color', },
            },
          },
        },).properties,).toEqual({
          at: { type: 'string', format: 'date-time', },
          id: { type: 'string', format: 'uuid', },
          tint: { type: 'string', description: '{format: "color"}', },
        },);
      },
    },),

    it({
      name: 'LEAVES THE CALLER\'S SCHEMA UNTOUCHED, returns a schema that shares no object with it, and passes a '
        + 'boolean schema through',
      fn: async () => {
        /**
         Schema the caller wrote, with a bound and an open object.
         */
        const written = { type: 'object', properties: { age: { type: 'integer', minimum: 1, }, }, };
        /**
         The same schema, to compare after the call.
         */
        const copy = structuredClone(written,);
        const sent = claudeSchemaOf({ schema: written, },);
        expect(written,).toEqual(copy,);
        expect(sent,).not.toBe(written,);
        expect((sent.properties as Record<string, unknown>).age,).not.toBe(written.properties.age,);
        expect(claudeSchemaOf({ schema: { type: 'object', properties: { any: true, }, }, },).properties,).toEqual({ any: true, },);
      },
    },),
  ],
},);
