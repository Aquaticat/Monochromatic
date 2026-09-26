/**
 Validation and resolution of policy `inputs` declarations.

 A static declaration is validated when its plugin is registered;
 a function declaration is called once with the policy's parsed options,
 after option validation,
 and its result validated the same way.
 Either failure is a config failure.

 @module
 */
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import * as v from 'valibot';
import type {
  PolicyInputs,
  PolicyInputsDeclaration,
} from '../api/policy-input-types.ts';
import type { RuntimePolicyInputs, } from '../policy-engine/types.ts';
import { ConfigValidationError, } from './config-validation-error.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Whether text carries no NUL, which no path, pathspec, revision, or variable name may hold.

 @param text - candidate text

 @returns whether text is NUL-free

 @example
 ```ts
 hasNoNul('a.txt'); // true
 ```
 */
function hasNoNul(text: string,): boolean {
  return !text.includes('\0',);
}

/**
 Whether a revision can be named on one line of `git cat-file --batch-check` input without being read as an option.

 @param rev - candidate revision

 @returns whether the revision is one safe line

 @example
 ```ts
 isSingleLineRevision('HEAD'); // true
 ```
 */
function isSingleLineRevision(rev: string,): boolean {
  return hasNoNul(rev,) && (!rev.includes('\n',))
    && (!rev.includes('\r',))
    && (!rev.startsWith('-',));
}

/**
 Whether text names an environment variable.

 @param name - candidate name

 @returns whether the name holds no `=` or NUL

 @example
 ```ts
 isEnvironmentName('PATH'); // true
 ```
 */
function isEnvironmentName(name: string,): boolean {
  return hasNoNul(name,) && (!name.includes('=',));
}

/**
 Non-empty NUL-free string.
 */
const TEXT_SCHEMA = v.pipe(
  v.string(),
  v.nonEmpty('must be non-empty',),
  v.check(
    hasNoNul,
    'must not contain NUL',
  ),
);

/**
 One external input.
 */
const POLICY_INPUT_SCHEMA = v.variant(
  'kind',
  [
    v.strictObject({
      kind: v.literal('worktree',),
      pathspecs: v.pipe(
        v.array(TEXT_SCHEMA,),
        v.minLength(
          1,
          'worktree pathspecs must be non-empty',
        ),
      ),
    },),
    v.strictObject({
      kind: v.literal('executable',),
      path: TEXT_SCHEMA,
    },),
    v.strictObject({
      kind: v.literal('revision',),
      rev: v.pipe(
        TEXT_SCHEMA,
        v.check(
          isSingleLineRevision,
          'revision must be one line and must not start with -',
        ),
      ),
    },),
    v.strictObject({
      kind: v.literal('env',),
      name: v.pipe(
        TEXT_SCHEMA,
        v.check(
          isEnvironmentName,
          'variable name must not contain =',
        ),
      ),
    },),
  ],
  'unknown input kind',
);

/**
 Resolved `inputs` value other than `'unrestricted'`,
 validated on its own so an issue names the failing input rather than the whole union.

 @example
 ```ts
 v.parse(EXTERNAL_INPUTS_SCHEMA, { external: [] });
 ```
 */
const EXTERNAL_INPUTS_SCHEMA = v.strictObject(
  { external: v.array(POLICY_INPUT_SCHEMA,), },
  'inputs must be \'unrestricted\' or { external: [...] }',
);

/**
 Validates a resolved `inputs` value into an engine-owned copy.

 @param value - untrusted value

 @param effectiveId - policy ID named in the diagnostic

 @returns validated copy

 @throws {@link ConfigValidationError} when the value is not a valid `inputs` value

 @example
 ```ts
 parsePolicyInputs({ value: { external: [] }, effectiveId: 'mono/check' });
 ```
 */
export function parsePolicyInputs({
  value,
  effectiveId,
}: Readonly<{
  value: unknown;
  effectiveId: string;
}>,): PolicyInputs {
  if (value === 'unrestricted')
    return value;
  /**
   Valibot outcome.
   */
  const parsed = v.safeParse(
    EXTERNAL_INPUTS_SCHEMA,
    value,
  );
  if (!parsed.success)
    throw new ConfigValidationError(`Policy ${effectiveId} has invalid inputs: ${v.summarize(parsed.issues,)
      .replaceAll(
        '\n',
        '; ',
      )}`,);
  return parsed.output;
}

/**
 A policy declaration without `inputs`, which means `'unrestricted'`.

 @example
 ```ts
 if (declaration === INPUTS_UNDECLARED) return 'unrestricted';
 ```
 */
export const INPUTS_UNDECLARED: unique symbol = Symbol('policy declares no inputs',);

/**
 Narrows an untrusted declaration member to a callable.

 @param value - untrusted member

 @returns whether the member is a function to call with parsed options

 @example
 ```ts
 isInputsFunction(() => 'unrestricted'); // true
 ```
 */
function isInputsFunction(value: unknown,): value is (options: unknown) => PolicyInputs {
  return (typeof value) === 'function';
}

/**
 Validates the `inputs` member of a policy declaration.

 @param value - untrusted member, possibly absent

 @param effectiveId - policy ID named in diagnostics

 @returns {@link INPUTS_UNDECLARED} when absent, a function to call with parsed options, or a validated static value

 @throws {@link ConfigValidationError} when a static value is invalid

 @example
 ```ts
 validateInputsDeclaration({ value: 'unrestricted', effectiveId: 'mono/check' });
 ```
 */
export function validateInputsDeclaration({
  value,
  effectiveId,
}: Readonly<{
  value: unknown;
  effectiveId: string;
}>,): PolicyInputsDeclaration<unknown> | typeof INPUTS_UNDECLARED {
  if (value === undefined)
    return INPUTS_UNDECLARED;
  if (isInputsFunction(value,))
    return value;
  return parsePolicyInputs({
    value,
    effectiveId,
  },);
}

/**
 Calls a declared inputs function, converting a throw into a config failure.

 @param declaration - declared function

 @param options - parsed policy options

 @param effectiveId - policy ID named in diagnostics

 @returns untrusted result

 @throws {@link ConfigValidationError} when the function throws

 @example
 ```ts
 callInputsFunction({ declaration: () => 'unrestricted', options: undefined, effectiveId: 'mono/check' });
 ```
 */
function callInputsFunction({
  declaration,
  options,
  effectiveId,
}: Readonly<{
  declaration: (options: unknown) => PolicyInputs;
  options: unknown;
  effectiveId: string;
}>,): unknown {
  try {
    return declaration(options,);
  }
  catch (error: unknown) {
    throw new ConfigValidationError(`Policy ${effectiveId} inputs function threw: ${caughtValueText(error,)}`,);
  }
}

/**
 Resolves a policy's declaration against its parsed options.

 @param declaration - validated declaration, absent for `'unrestricted'`

 @param options - parsed policy options

 @param effectiveId - policy ID named in diagnostics

 @returns validated inputs

 @throws {@link ConfigValidationError} when a function throws or returns an invalid value

 @example
 ```ts
 resolvePolicyInputs({ declaration: { external: [] }, options: undefined, effectiveId: 'mono/check' });
 ```
 */
export function resolvePolicyInputs({
  declaration,
  options,
  effectiveId,
}: Readonly<{
  declaration?: RuntimePolicyInputs;
  options: unknown;
  effectiveId: string;
}>,): PolicyInputs {
  if (declaration === undefined)
    return 'unrestricted';
  /**
   Validated static value or function result.
   */
  const resolved = parsePolicyInputs({
    value: isInputsFunction(declaration,)
      ? callInputsFunction({
        declaration,
        options,
        effectiveId,
      },)
      : declaration,
    effectiveId,
  },);
  tagged({
    tag: resolvePolicyInputs.name,
    l,
  },)
    .debug(`resolved ${effectiveId} inputs: ${JSON.stringify(resolved,)}`,);
  return resolved;
}
