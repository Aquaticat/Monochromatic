/**
 Qualify native message assignments from executable syntax before adding ownership observations.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import {
  type Node,
  parse
} from 'yuku-parser';
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
 Only the readonly member chain is needed from the parser's wider mutable node types.
 */
type NativeTarget = {
  /**
   Original discriminant distinguishes an access from the owning instance.
   */
  readonly type: string;
  /**
   Member receiver is another readonly node in the same original tree.
   */
  readonly object?: NativeTarget;
  /**
   Computed access requires decoding its literal property.
   */
  readonly computed?: boolean;
  /**
   Member identity alone is observed; no parser field is changed.
   */
  readonly property?: {
    /**
     Distinguish original literal and identifier properties.
     */
    readonly type: string;
    /**
     Literal values remain unknown until compared with a qualified property name.
     */
    readonly value?: unknown;
    /**
     Identifier spelling has already been decoded by the parser.
     */
    readonly name?: string;
  };
};

/**
 Match a decoded property without mutating original parser nodes.

 @param node - original assignment target whose access chain is checked

 @param name - qualified original member name

 @returns whether the original access selects that named member
 */
function hasNativeMember({
  node,
  name
}: {
  readonly node: NativeTarget;
  readonly name: string;
}): boolean {
  if (node.type !== 'MemberExpression') return false;
  if (node.computed === true) return node.property?.type === 'Literal' && node.property.value === name;
  return node.property?.type === 'Identifier' && node.property.name === name;
}

/**
 Identify the fixed original message path belonging to the native class.

 @param node - original executable assignment target

 @param owner - native class whose instance owns the message state

 @returns whether the original access terminates at that native instance
 */
function isNativeMessageTarget({ node, owner }: {
  readonly node: NativeTarget;
  readonly owner: 'Agent' | 'Session';
}): boolean {
  if (!hasNativeMember({ node, name: 'messages' }) || node.object === undefined) return false;
  /**
   The original message receiver is checked without following unrelated parser fields.
   */
  const state = node.object;
  if (owner === 'Agent') return hasNativeMember({ node: state, name: '_state' }) && state.object?.type === 'ThisExpression';
  if (!hasNativeMember({ node: state, name: 'state' }) || state.object === undefined) return false;
  /**
   Sessions reach their state through the original Agent instance field.
   */
  const agent = state.object;
  return hasNativeMember({ node: agent, name: 'agent' }) && agent.object?.type === 'ThisExpression';
}

/**
 Count qualified writes with one accumulator confined to the original tree traversal.

 @param root - original parsed tree

 @param owner - native class selecting its qualified message path

 @returns number of executable assignments to that original instance path
 */
function countNativeMessageAssignments({
  root,
  owner
}: {
  readonly root: Node;
  readonly owner: 'Agent' | 'Session';
}): number {
  /**
   Assignment membership is measured once across the original syntax.
   */
  let assignments = 0;
  for (const node of walkNativeSyntax(root)) {
    if ((node.type === 'AssignmentExpression')
      && isNativeMessageTarget({
        node: node.left,
        owner
      })) assignments++;
  }
  return assignments;
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
export function assertNativeMessageAssignment({
  source,
  owner
}: {
  readonly source: string;
  readonly owner: 'Agent' | 'Session';
}): void {
  /**
   Diagnostics identify the original owner whose source requires qualification.
   */
  const rl = tagged({
    tag: assertNativeMessageAssignment.name,
    l
  });
  rl.debug(`checking original ${owner} message assignments`);
  /**
   Source shape is established before counting assignments or emitting changes.
   */
  const parsed = parse(
    source,
    { sourceType: 'module' }
  );
  if (parsed.diagnostics
    .length
    > 0) throw new NativeStateBuildError(`Cannot parse native ${owner} assignment source`);
  /**
   One linear traversal counts executable writes without matching comments or string contents.
   */
  const assignments = countNativeMessageAssignments({
    root: parsed.program,
    owner
  });
  if (assignments !== 1) throw new NativeStateBuildError(`Revalidate native ${owner} message assignments: expected 1, observed ${assignments}`);
  rl.debug(`qualified original ${owner} message assignment`);
}

//endregion Assignment targets retain their original native owner path
