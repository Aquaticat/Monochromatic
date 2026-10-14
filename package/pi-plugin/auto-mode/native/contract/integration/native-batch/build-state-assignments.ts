/**
 Qualify native message assignments from executable syntax before adding ownership observations.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { type Node, parse } from 'yuku-parser';
import { walkNativeSyntax } from './build-syntax.ts';

//region Assignment targets retain their original native owner path

/**
 Native state source drift remains a build failure, never a policy decision.
 */
export class NativeStateBuildError extends Error {
  /**
   Distinguish original assignment qualification from runtime state failures.
   */
  override readonly name = 'NativeStateBuildError';
}

/**
 State assignment checks retain their own diagnostic boundary.
 */
const l = tagged({ tag: 'auto-mode-native-build-state-assignments' });

/**
 Match property access from its leaf back to the original native instance.

 @param node - original assignment target whose access chain is checked

 @param properties - expected names ordered from leaf to instance

 @returns whether all original member names terminate at this
 */
function isNativeTarget({ node, properties }: {
  readonly node: Node;
  readonly properties: readonly string[];
}): boolean {
  /**
   Only this cursor changes; the original assignment nodes remain unchanged.
   */
  let current = node;
  for (const property of properties) {
    if (current.type !== 'MemberExpression') return false;
    /**
     Source escapes and literal computed access have the same decoded member identity.
     */
    const name = current.computed
      ? current.property.type === 'Literal' ? current.property.value : undefined
      : current.property.type === 'Identifier' ? current.property.name : undefined;
    if (name !== property) return false;
    current = current.object;
  }
  return current.type === 'ThisExpression';
}

/**
 Require exactly one original direct message assignment before instrumenting the qualified source.

 @param source - original native source whose executable assignments must be enumerated

 @param owner - native class selecting the qualified message target

 @throws NativeStateBuildError when parsing fails or assignment membership changes

 @example
 ```ts
 assertNativeMessageAssignment({ source: originalAgent, owner: 'Agent' });
 ```
 */
export function assertNativeMessageAssignment({ source, owner }: {
  readonly source: string;
  readonly owner: 'Agent' | 'Session';
}): void {
  /**
   Diagnostics identify the original owner whose source requires qualification.
   */
  const rl = tagged({ tag: assertNativeMessageAssignment.name, l });
  rl.debug(`checking original ${owner} message assignments`);
  /**
   Source shape is established before counting assignments or emitting changes.
   */
  const parsed = parse(source, { sourceType: 'module' });
  if (parsed.diagnostics.length > 0) throw new NativeStateBuildError(`Cannot parse native ${owner} assignment source`);
  /**
   Native Agent and Session expose different original instance paths.
   */
  const properties = owner === 'Agent' ? ['messages', '_state'] : ['messages', 'state', 'agent'];
  /**
   One linear traversal counts executable writes without matching comments or string contents.
   */
  let assignments = 0;
  for (const node of walkNativeSyntax(parsed.program)) {
    if (node.type === 'AssignmentExpression' && isNativeTarget({ node: node.left, properties })) assignments++;
  }
  if (assignments !== 1) throw new NativeStateBuildError(`Revalidate native ${owner} message assignments: expected 1, observed ${assignments}`);
  rl.debug(`qualified original ${owner} message assignment`);
}

//endregion Assignment targets retain their original native owner path
