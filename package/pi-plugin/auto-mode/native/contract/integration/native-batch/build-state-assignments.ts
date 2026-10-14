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
  /** Original discriminant distinguishes an access from the owning instance. */
  readonly type: string;
  /** Member receiver is another readonly node in the same original tree. */
  readonly object?: NativeTarget;
  /** Computed access requires decoding its literal property. */
  readonly computed?: boolean;
  /** Member identity alone is observed; no parser field is changed. */
  readonly property?: {
    /** Distinguish original literal and identifier properties. */
    readonly type: string;
    /** Literal values remain unknown until compared with a qualified property name. */
    readonly value?: unknown;
    /** Identifier spelling has already been decoded by the parser. */
    readonly name?: string;
  };
};

/**
 Match property access from its leaf back to the original native instance.

 @param node - original assignment target whose access chain is checked

 @param properties - expected names ordered from leaf to instance

 @returns original owning expression when every property matches, or undefined for another target
 */
function findNativeTargetOwner({
  node,
  properties
}: {
  readonly node: NativeTarget;
  readonly properties: readonly string[];
}): NativeTarget | undefined {
  /**
   Only this cursor changes; the original assignment nodes remain unchanged.
   */
  let current: NativeTarget | undefined = node;
  for (const property of properties) {
    if (current?.type !== 'MemberExpression') return undefined;
    /**
     Source escapes and literal computed access have the same decoded member identity.
     */
    const name = current.computed
      ? current.property?.type === 'Literal' ? current.property.value : undefined
      : current.property?.type === 'Identifier' ? current.property.name : undefined;
    if (name !== property) return undefined;
    current = current.object;
  }
  return current;
}

/**
 Count qualified writes with one accumulator confined to the original tree traversal.

 @param root - original parsed tree

 @param properties - qualified member sequence from message leaf to native instance

 @returns number of executable assignments to that original instance path
 */
function countNativeMessageAssignments({ root, properties }: {
  readonly root: Node;
  readonly properties: readonly string[];
}): number {
  /**
   Assignment membership is measured once across the original syntax.
   */
  let assignments = 0;
  for (const node of walkNativeSyntax(root)) {
    if (node.type === 'AssignmentExpression'
      && findNativeTargetOwner({ node: node.left, properties })?.type === 'ThisExpression') assignments++;
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
   Native Agent and Session expose different original instance paths.
   */
  const properties = owner === 'Agent' ? [
    'messages',
    '_state'
  ] : [
    'messages',
    'state',
    'agent'
  ];
  /**
   One linear traversal counts executable writes without matching comments or string contents.
   */
  const assignments = countNativeMessageAssignments({ root: parsed.program, properties });
  if (assignments !== 1) throw new NativeStateBuildError(`Revalidate native ${owner} message assignments: expected 1, observed ${assignments}`);
  rl.debug(`qualified original ${owner} message assignment`);
}

//endregion Assignment targets retain their original native owner path
