import { expect, } from '@monochromatic-dev/module-test/ts';

//region Reason order fixture
// Reads the order a ballot's reply schema and its sheet's reply instruction
// declare their fields in, so a case can require the reason to come before the
// choice without asking the schema builder for the expected answer (owner,
// 2026-10-21, "Reason first everywhere", extending the ruling of 2026-09-27,
// "Reason before vote").

/**
 Property names of a response format's object schema, in declared order.

 @param format - response format as a stage hands it to the client

 @returns Names of the top-level properties, in declaration order

 @throws Error - when the format carries no object schema with properties

 @example
 ```ts
 const names = propertyOrderOf({ format: CANDIDATE_SELECT_RESPONSE_FORMAT, },);
 ```
 */
export function propertyOrderOf({ format, }: { readonly format: unknown; },): readonly string[] {
  /**
   The properties record, read off the schema without trusting its type.
   */
  const properties = ((format as {
    readonly json_schema?: { readonly schema?: { readonly properties?: Record<string, unknown>; }; };
  }).json_schema?.schema?.properties);
  if (properties === undefined)
    throw new Error('the response format carries no object schema with properties',);
  return Object.keys(properties,);
}

/**
 Required names of a response format's object schema, in declared order.

 @param format - response format as a stage hands it to the client

 @returns Names the schema requires, in declaration order

 @throws Error - when the format carries no required list

 @example
 ```ts
 const names = requiredOrderOf({ format: CANDIDATE_SELECT_RESPONSE_FORMAT, },);
 ```
 */
export function requiredOrderOf({ format, }: { readonly format: unknown; },): readonly string[] {
  /**
   The required list, read off the schema without trusting its type.
   */
  const required = ((format as {
    readonly json_schema?: { readonly schema?: { readonly required?: readonly string[]; }; };
  }).json_schema?.schema?.required);
  if (required === undefined)
    throw new Error('the response format carries no required list',);
  return required;
}

/**
 Requires a schema to declare, and to require, the reason first and before
 the vote.

 @param format - response format as a stage hands it to the client

 @param reason - name of the reason field

 @param vote - name of the choice field the reason must precede

 @example
 ```ts
 expectReasonFirstInSchema({ format, reason: 'reason', vote: 'best', },);
 ```
 */
export function expectReasonFirstInSchema(
  {
    format,
    reason,
    vote,
  }: {
    readonly format: unknown;
    readonly reason: string;
    readonly vote: string;
  },
): void {
  for (const names of [propertyOrderOf({ format, },), requiredOrderOf({ format, },),]) {
    expect(names.includes(reason,),).toBe(true,);
    expect(names.includes(vote,),).toBe(true,);
    expect(names.indexOf(reason,),).toBeLessThan(names.indexOf(vote,),);
    expect(names.indexOf(reason,),).toBe(0,);
  }
}

/**
 Requires a sheet's reply instruction to name the reason before the vote.

 @param text - the instruction, or the sheet it closes

 @param reason - phrase naming the reason field in the instruction

 @param vote - phrase naming the choice field in the instruction

 @example
 ```ts
 expectReasonBeforeVoteInText({ text: user, reason: 'reason one sentence', vote: 'choice one of', },);
 ```
 */
export function expectReasonBeforeVoteInText(
  {
    text,
    reason,
    vote,
  }: {
    readonly text: string;
    readonly reason: string;
    readonly vote: string;
  },
): void {
  expect(text.includes(reason,),).toBe(true,);
  expect(text.includes(vote,),).toBe(true,);
  expect(text.indexOf(reason,),).toBeLessThan(text.indexOf(vote,),);
}

//endregion Reason order fixture
