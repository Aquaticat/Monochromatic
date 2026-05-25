/**
 * Advisor tool parameter schema and argument normalization.
 *
 * @module
 */

import {
  type TObject,
  type TOptional,
  type TString,
  Type,
} from 'typebox';
import type { AdvisorToolParams, } from './types.ts';

//region Schema

/** TypeBox object builder aliased to satisfy constructor-style lint. */
const typeObject = Type.Object;

/** TypeBox optional builder aliased to satisfy constructor-style lint. */
const typeOptional = Type.Optional;

/** TypeBox string builder aliased to satisfy constructor-style lint. */
const typeString = Type.String;

/** TypeBox schema for Advisor tool parameters. */
export const AdvisorToolParametersSchema: TObject<{
  model: TOptional<TString>;
}> = typeObject(
  {
    model: typeOptional(typeString({
      description:
        'Optional scoped model slug. Use provider/model for canonical slugs. Empty params select the highest expected-cost scoped model.',
    },),),
  },
  { additionalProperties: false, },
);

//endregion Schema

//region Argument normalization

/**
 * Normalize raw tool arguments before TypeBox validation.
 *
 * @param args - raw tool-call arguments from the model
 *
 * @returns normalized Advisor params
 *
 * @throws when non-empty args are malformed
 *
 * @example
 * ```typescript
 * prepareAdvisorArguments('anthropic/claude-sonnet');
 * ```
 */
export function prepareAdvisorArguments(
  args: unknown,
): AdvisorToolParams {
  if ((args === undefined) || (args === null))
    return {};
  if ((typeof args) === 'string')
    return args.trim()
      === '' ? {} : { model: args, };
  if ((typeof args) !== 'object')
    throw new Error('advisor: arguments must be an object with optional model field',);

  /** Unknown fields not accepted by public tool contract. */
  const extraKeys = Object
    .keys(args,)
    .filter(function isExtraKey(key,) {
    return key !== 'model';
  },);
  if (extraKeys.length
    > 0)
    throw new Error(`advisor: unsupported argument fields: ${extraKeys.join(', ',)}`,);

  if ((!('model' in args)) || (args.model
    === undefined))
    return {};
  if ((typeof args.model) !== 'string')
    throw new Error('advisor: model must be a string when provided',);
  return args.model
    .trim()
    === '' ? {} : { model: args.model, };
}

//endregion Argument normalization
