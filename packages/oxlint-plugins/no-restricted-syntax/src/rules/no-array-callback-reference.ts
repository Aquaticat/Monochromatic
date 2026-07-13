import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts';

import {
  getStaticCallMemberName,
  getStaticMemberName,
  NO_STATIC_MEMBER_NAME,
} from './ast-shared.ts';
import { isKnownUnaryFunctionExpression, } from './no-array-callback-reference.arity.ts';

//region Constants

/**
 * Array iterator methods whose first argument is a callback.
 */
const ARRAY_CALLBACK_METHODS = [
  'every',
  'filter',
  'find',
  'findLast',
  'findIndex',
  'findLastIndex',
  'flatMap',
  'forEach',
  'map',
  'reduce',
  'reduceRight',
  'some',
] as const;

/**
 * Built-in constructor callbacks accepted because their arity is intentional.
 */
const ALLOWED_BUILTIN_CALLBACKS = [
  'String',
  'Number',
  'Boolean',
  'Symbol',
  'BigInt',
  'RegExp',
  'Date',
  'Array',
  'Object',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Promise',
  'Error',
  'AggregateError',
  'EvalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
  'DataView',
  'ArrayBuffer',
  'SharedArrayBuffer',
] as const;

/**
 * Receiver identifiers known to expose array-like helper methods.
 */
const IGNORED_RECEIVER_NAMES = [
  'Promise',
  'lodash',
  'underscore',
  '_',
  'React',
  'Vue',
  'Async',
  'async',
  '$',
  'jQuery',
  'Children',
  'types',
] as const;

/**
 * Callback wrapper names allowed because this repo owns their arity-capping semantics.
 */
const ALLOWED_CALLBACK_WRAPPER_NAMES = [
  'unary',
  'binary',
] as const;

/**
 * Sentinel returned when a call expression has no ordinary callback argument.
 */
const NO_CALLBACK_ARGUMENT: unique symbol = Symbol('array callback argument absent or spread');

/**
 * Diagnostic identifier used by {@link noArrayCallbackReference}.
 */
const MESSAGE_ID = 'directReference';

//endregion Constants

//region Static-shape helpers

/**
 * Returns expression with transparent wrappers removed.
 *
 * @param expression - Expression that may be wrapped by parentheses or TS-only casts.
 *
 * @returns Runtime expression inside transparent wrappers.
 *
 * @example
 * ```ts
 * unwrapExpression({ expression: callback });
 * ```
 */
function unwrapExpression(
  { expression, }: ForeignBorrowed<{ readonly expression: ESTree.Expression; }>,
): ESTree.Expression {
  if (expression.type === 'ParenthesizedExpression')
    return unwrapExpression({ expression: expression.expression, },);
  if (expression.type === 'TSAsExpression')
    return unwrapExpression({ expression: expression.expression, },);
  if (expression.type === 'TSSatisfiesExpression')
    return unwrapExpression({ expression: expression.expression, },);
  if (expression.type === 'TSTypeAssertion')
    return unwrapExpression({ expression: expression.expression, },);
  if (expression.type === 'TSNonNullExpression')
    return unwrapExpression({ expression: expression.expression, },);
  if (expression.type === 'TSInstantiationExpression')
    return unwrapExpression({ expression: expression.expression, },);
  return expression;
}

/**
 * Reports whether `name` is an allowed built-in callback.
 *
 * @param name - Identifier name supplied as callback.
 *
 * @returns Whether callback reference is exempt.
 *
 * @example
 * ```ts
 * isAllowedBuiltinCallback({ name: 'Number' });
 * ```
 */
function isAllowedBuiltinCallback({ name, }: { readonly name: string; },): boolean {
  return ALLOWED_BUILTIN_CALLBACKS.some(
    function isAllowedBuiltinCandidate(candidate,): boolean {
      return candidate === name;
    },
  );
}

/**
 * Reports whether `name` is a receiver whose callback-like method is not an Array iterator.
 *
 * @param name - Static receiver identifier.
 *
 * @returns Whether receiver should be skipped.
 *
 * @example
 * ```ts
 * isIgnoredReceiverName({ name: 'Promise' });
 * ```
 */
function isIgnoredReceiverName({ name, }: { readonly name: string; },): boolean {
  return IGNORED_RECEIVER_NAMES.some(
    function isIgnoredReceiverCandidate(candidate,): boolean {
      return candidate === name;
    },
  );
}

/**
 * Reports whether call target name is one of the array callback methods.
 *
 * @param name - Static method name.
 *
 * @returns Whether method's first argument is an array callback.
 *
 * @example
 * ```ts
 * isArrayCallbackMethod({ name: 'findIndex' });
 * ```
 */
function isArrayCallbackMethod({ name, }: { readonly name: string; },): boolean {
  return ARRAY_CALLBACK_METHODS.some(
    function isArrayCallbackMethodCandidate(candidate,): boolean {
      return candidate === name;
    },
  );
}

/**
 * Reports whether `name` is an allowed arity wrapper callee.
 *
 * @param name - Identifier name supplied as callback wrapper callee.
 *
 * @returns Whether callee is a known arity wrapper.
 *
 * @example
 * ```ts
 * isAllowedCallbackWrapperName({ name: 'unary' });
 * ```
 */
function isAllowedCallbackWrapperName({ name, }: { readonly name: string; },): boolean {
  return ALLOWED_CALLBACK_WRAPPER_NAMES.some(
    function isAllowedCallbackWrapperCandidate(candidate,): boolean {
      return candidate === name;
    },
  );
}

/**
 * Reports whether receiver is a jQuery object-producing call.
 *
 * @param call - Receiver expression shaped as a call expression.
 *
 * @returns Whether receiver is `$()` or `jQuery()`.
 *
 * @example
 * ```ts
 * isJqueryReceiverCall({ call: receiver });
 * ```
 */
function isJqueryReceiverCall({ call, }: ForeignBorrowed<{ readonly call: ESTree.CallExpression; }>,): boolean {
  /**
   * Callee expression with transparent wrappers removed.
   */
  const callee = unwrapExpression({ expression: call.callee, },);
  if (callee.type !== 'Identifier')
    return false;
  return (callee.name === '$') || (callee.name === 'jQuery');
}

/**
 * Reports whether receiver is known not to be an Array instance.
 *
 * @param receiver - Object expression for the method call.
 *
 * @returns Whether receiver should be skipped.
 *
 * @example
 * ```ts
 * isIgnoredReceiver({ receiver: call.callee.object });
 * ```
 */
function isIgnoredReceiver({ receiver, }: ForeignBorrowed<{ readonly receiver: ESTree.Expression; }>,): boolean {
  /**
   * Receiver with transparent wrappers removed.
   */
  const unwrappedReceiver = unwrapExpression({ expression: receiver, },);
  if (unwrappedReceiver.type === 'Identifier')
    return isIgnoredReceiverName({ name: unwrappedReceiver.name, },);
  if (unwrappedReceiver.type === 'CallExpression')
    return isJqueryReceiverCall({ call: unwrappedReceiver, },);
  if (unwrappedReceiver.type !== 'MemberExpression')
    return false;

  /**
   * Static property name for member receiver.
   */
  const propertyName = getStaticMemberName({ member: unwrappedReceiver, },);
  if (propertyName === NO_STATIC_MEMBER_NAME)
    return false;
  /**
   * Object expression for member receiver.
   */
  const { object, } = unwrappedReceiver;
  if (object.type !== 'Identifier')
    return false;
  return (object.name === 'React') && (propertyName === 'Children');
}

/**
 * Reports whether argument count can represent an array callback plus optional second parameter.
 *
 * @param call - Candidate array method call.
 *
 * @returns Whether call has one or two arguments.
 *
 * @example
 * ```ts
 * hasCallbackArity({ call });
 * ```
 */
function hasCallbackArity({ call, }: ForeignBorrowed<{ readonly call: ESTree.CallExpression; }>,): boolean {
  /**
   * Arguments supplied to candidate call.
   */
  const callArguments = call.arguments;
  /**
   * Number of supplied arguments.
   */
  const argumentCount = callArguments.length;
  return (argumentCount === 1) || (argumentCount === 2);
}

/**
 * Returns first ordinary expression argument from a call expression.
 *
 * @param call - Call expression being inspected.
 *
 * @returns First expression argument, or sentinel for no argument or spread.
 *
 * @example
 * ```ts
 * const callback = firstExpressionArgument({ call });
 * ```
 */
function firstExpressionArgument(
  { call, }: ForeignBorrowed<{ readonly call: ESTree.CallExpression; }>,
): ESTree.Expression | typeof NO_CALLBACK_ARGUMENT {
  /**
   * Arguments supplied to candidate call.
   */
  const callArguments = call.arguments;
  /**
   * First call argument, when present.
   */
  const [argument,] = callArguments;
  if (argument === undefined)
    return NO_CALLBACK_ARGUMENT;
  if (argument.type === 'SpreadElement')
    return NO_CALLBACK_ARGUMENT;
  return argument;
}

/**
 * Reports whether call expression is an array iterator call this rule owns.
 *
 * @param call - Call expression being inspected.
 *
 * @returns Whether call's first argument should be checked as callback.
 *
 * @example
 * ```ts
 * isRelevantArrayCallbackCall({ call });
 * ```
 */
function isRelevantArrayCallbackCall(
  { call, }: ForeignBorrowed<{ readonly call: ESTree.CallExpression; }>,
): boolean {
  if (!hasCallbackArity({ call, },))
    return false;
  /**
   * Static method name for candidate call.
   */
  const methodName = getStaticCallMemberName({ call, },);
  if (methodName === NO_STATIC_MEMBER_NAME)
    return false;
  if (!isArrayCallbackMethod({ name: methodName, },))
    return false;
  /**
   * Callee expression for candidate call.
   */
  const { callee, } = call;
  if (callee.type !== 'MemberExpression')
    return false;
  /**
   * Method receiver expression.
   */
  const receiver = unwrapExpression({ expression: callee.object, },);
  if (isIgnoredReceiver({ receiver, },))
    return false;
  return receiver.type !== 'MemberExpression';
}

//endregion Static-shape helpers

//region Callback classification

/**
 * Reports whether call expression is an allowed explicit arity wrapper.
 *
 * @param call - Callback-position call expression being inspected.
 *
 * @returns Whether call is a known single-argument arity wrapper call.
 *
 * @example
 * ```ts
 * isAllowedCallbackWrapperCall({ call: unary(callback) });
 * ```
 */
function isAllowedCallbackWrapperCall(
  { call, }: ForeignBorrowed<{ readonly call: ESTree.CallExpression; }>,
): boolean {
  /**
   * Arguments supplied to the wrapper call.
   */
  const callArguments = call.arguments;
  if (callArguments.length !== 1)
    return false;
  /**
   * Sole argument supplied to the wrapper call.
   */
  const [argument,] = callArguments;
  if (argument === undefined)
    return false;
  if (argument.type === 'SpreadElement')
    return false;
  /**
   * Wrapper callee with transparent wrappers removed.
   */
  const callee = unwrapExpression({ expression: call.callee, },);
  if (callee.type !== 'Identifier')
    return false;
  return isAllowedCallbackWrapperName({ name: callee.name, },);
}

/**
 * Reports whether callback expression is a direct reference needing wrapping.
 *
 * Call expressions are reported unless they are allowlisted explicit arity
 * wrappers. Identifier and local object-member references short-circuit when
 * their resolved function declaration has exactly one non-rest parameter.
 *
 * @param context - Oxlint rule context.
 *
 * @param callback - First argument supplied to an array iterator method.
 *
 * @returns Whether callback expression should be reported.
 *
 * @example
 * ```ts
 * shouldReportCallback({ context, callback: firstArgument });
 * ```
 */
function shouldReportCallback(
  {
    context,
    callback,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly callback: ESTree.Expression;
  }>,
): boolean {
  /**
   * Callback expression with transparent wrappers removed.
   */
  const expression = unwrapExpression({ expression: callback, },);
  if (isKnownUnaryFunctionExpression({
    context,
    expression,
  },))
    return false;
  if (expression.type === 'Identifier')
    return !isAllowedBuiltinCallback({ name: expression.name, },);
  if (expression.type === 'ConditionalExpression')
    return shouldReportCallback({
      context,
      callback: expression.consequent,
    },)
      || shouldReportCallback({
        context,
        callback: expression.alternate,
      },);
  if (expression.type === 'SequenceExpression') {
    /**
     * Expressions inside sequence expression.
     */
    const { expressions, } = expression;
    /**
     * Last sequence expression, which becomes the callback value.
     */
    const lastExpression = expressions.at(-1,);
    if (lastExpression === undefined)
      return false;
    return shouldReportCallback({
      context,
      callback: lastExpression,
    },);
  }
  if (expression.type === 'CallExpression')
    return !isAllowedCallbackWrapperCall({ call: expression, },);
  if (expression.type === 'MemberExpression')
    return true;
  return (expression.type === 'YieldExpression')
    || (expression.type === 'AssignmentExpression')
    || (expression.type === 'LogicalExpression')
    || (expression.type === 'BinaryExpression')
    || (expression.type === 'UnaryExpression')
    || (expression.type === 'UpdateExpression')
    || (expression.type === 'NewExpression');
}

//endregion Callback classification

/**
 * Flags direct callback references passed to array iterator methods.
 *
 * This project-owned replacement for `unicorn/no-array-callback-reference`
 * keeps the arity-footgun guard for multi-argument bare references such as
 * `items.map(fn,)` while allowing statically-known unary callbacks and explicit
 * unary()/binary() wrapper calls such as `items.findIndex(unary(fn,),)`.
 *
 * @example
 * ```ts
 * items.map(callback,); // reported
 * items.map(unary(callback,),); // accepted
 * ```
 */
export const noArrayCallbackReference: CreateOnceRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow direct callback references in array iterator methods.',
      recommended: true,
    },
    messages: {
      [MESSAGE_ID]: 'Avoid passing a multi-argument or unknown-arity function reference directly to iterator methods. Use a known unary function, an inline named function expression, or unary()/binary() to make callback arity explicit.',
    },
  },
  /**
   * Handles foreign Oxlint callback.
   *
   * @param context - Foreign rule context receiving diagnostics.
   *
   * @mutates context - Emits Oxlint diagnostics through foreign rule context.
   *
   * @example
   * ```ts
   * createOnce(context);
   * ```
   */
  createOnce(context: ForeignBorrowed<Context>,): VisitorWithHooks {
    return {
      CallExpression(node: ForeignBorrowed<ESTree.CallExpression>,): void {
        if (!isRelevantArrayCallbackCall({ call: node, },))
          return;
        /**
         * Candidate callback argument.
         */
        const callback = firstExpressionArgument({ call: node, },);
        if (callback === NO_CALLBACK_ARGUMENT)
          return;
        if (!shouldReportCallback({
          context,
          callback,
        },))
          return;
        context.report({
          node: callback,
          messageId: MESSAGE_ID,
        },);
      },
    };
  },
};
