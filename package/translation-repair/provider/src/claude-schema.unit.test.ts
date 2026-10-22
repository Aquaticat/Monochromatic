/**
 Tests for the schema the Claude body sends (`claude-schema.ts`). Anthropic's structured outputs take a narrower
 JSON Schema than the stages write: `additionalProperties: false` is required on every object, and the numeric,
 string and array bounds are not supported (the bundled API skill, `shared/tool-use-concepts.md`, "JSON Schema
 Limitations"; the official SDKs strip the bounds and check them client-side, and this client is raw HTTP). The
 sanitiser is the one place the narrowing happens, so every case here reads what it returns and what it leaves alone.
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
  name: 'claudeSchemaOf',
  children: [
    it({
      name: 'CLOSES EVERY OBJECT, whether it sits under properties, items, anyOf or a definition, and whether it '
        + 'declares properties or only a type, and replaces an additionalProperties that allows more with false',
      fn: () => {
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
      fn: () => {
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
            age: { type: 'integer', },
            name: { type: 'string', description: 'what the cat answers to', },
            toys: { type: 'array', items: { type: 'string', enum: ['yarn', 'mouse',], }, },
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
      fn: () => {
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
            maxLength: { type: 'integer', },
            pick: { type: 'string', enum: ['minimum', 'uniqueItems',], },
          },
          required: ['minimum',],
          additionalProperties: false,
        },);
      },
    },),

    it({
      name: 'LEAVES THE CALLER\'S SCHEMA UNTOUCHED, returns a schema that shares no object with it, and passes a '
        + 'boolean schema through',
      fn: () => {
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
