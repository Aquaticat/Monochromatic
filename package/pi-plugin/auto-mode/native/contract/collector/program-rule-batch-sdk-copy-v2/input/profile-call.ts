/**
 Original call inspection retains parser identity and exact source spans. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type { DeclaredProgramSite } from './program-declaration-types.ts';
import type { ProfileCallInput } from './profile-call-types.ts';

/**
 Inspection diagnostics omit source text and argument values.
 */
const l = tagged({ tag: 'auto-mode-profile-call' });

//region Validate original call shape before delegating argument ownership.
/**
 Inspect an original direct tool call without granting execution authority.

 @param call - parser-owned syntax to inspect

 @param group - original group position

 @param ordinal - original member position

 @param bindingName - optional earlier immutable result binding

 @param allowed - original callable-name membership

 @param source - original unwrapped source text

 @param prefix - parser wrapper excluded from published spans

 @param readPattern - original argument decoder retaining private ownership

 @param ResultProgramProfileError - original profile diagnostic constructor

 @returns frozen callsite with original pattern and exact callee source span

 @throws Error for unsupported call shapes, source bounds, or argument patterns

 @example inspectProfileCall({ call, group, ordinal, allowed, source, prefix, readPattern, ResultProgramProfileError });
 */
export function inspectProfileCall({
  call,
  group,
  ordinal,
  bindingName,
  allowed,
  source,
  prefix,
  readPattern,
  ResultProgramProfileError,
}: ProfileCallInput): DeclaredProgramSite {
  /**
   Tracing observes only the inspection boundary.
   */
  const cl = tagged({
    tag: inspectProfileCall.name,
    l
  });
  cl.debug('inspecting original tool call');
  if ((call?.type !== 'CallExpression') || call.optional || (call.arguments.length !== 1)) {
    throw new ResultProgramProfileError('direct single-argument call required');
  }
  /**
   Original callee access follows direct-call admission.
   */
  const { callee } = call;
  if ((callee.type !== 'MemberExpression') || callee.computed || callee.optional
    || (callee.object.type !== 'Identifier') || (callee.object.name !== 'tools')
    || (callee.property.type !== 'Identifier') || (!allowed.has(callee.property.name))) {
    throw new ResultProgramProfileError('owned tool identifier required');
  }
  /**
   Original start excludes the parser wrapper.
   */
  const start = callee.start - prefix.length;
  /**
   Original end retains the original predicate without an added integer check.
   */
  const end = callee.end - prefix.length;
  if (!(Number.isSafeInteger(start) && start >= 0
    && end > start
    && end <= source.length)) {
    throw new ResultProgramProfileError('callee source span');
  }
  return Object.freeze({
    group,
    ordinal,
    name: callee.property
      .name,
    pattern: readPattern({
      node: call.arguments[0],
      bindingName
    }),
    callee: Object.freeze({
      start,
      end,
      text: source.slice(start, end)
    }),
    alias: `__owned_flow_${group}_${ordinal}`,
  });
}
//endregion
