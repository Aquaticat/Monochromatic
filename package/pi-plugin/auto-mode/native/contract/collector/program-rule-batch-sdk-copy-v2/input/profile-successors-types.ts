/**
 Original successor inspection borrows parser identities and call inspection. @module
 */
import type { Node } from 'yuku-parser';
import type { DeclaredProgramGroup, DeclaredProgramSite } from './program-declaration-types.ts';

/**
 Caller-established return and binding shapes retain their original parser objects.
 */
export type ProfileSuccessorsInput = Readonly<{
  returned: Readonly<{ argument: Readonly<{ argument: Node }> }>;
  declaration: Readonly<{ id: Readonly<{ name: string }> }>;
  producer: DeclaredProgramSite;
  allowed: ReadonlySet<string>;
  source: string;
  prefix: string;
  inspectCall: (input: Readonly<{
    call: unknown;
    group: number;
    ordinal: number;
    bindingName: string;
    allowed: ReadonlySet<string>;
    source: string;
    prefix: string;
  }>) => DeclaredProgramSite;
  ResultProgramProfileError: new (message: string) => Error;
}>;

/**
 Original unfrozen declaration parts remain available to the outer declaration owner.
 */
export type ProfileSuccessors = Readonly<{
  bindingName: string;
  groups: readonly DeclaredProgramGroup[];
  sites: readonly DeclaredProgramSite[];
  profile: 'awaited-string-result-then-literal-parallel';
}>;

/**
 Original combinator admission establishes a static member and single argument.
 */
export type NativeParallelCall = Extract<Node, { type: 'CallExpression' }> & Readonly<{
  callee: Readonly<{ property: Readonly<{ name: 'all' | 'allSettled' }> }>;
  arguments: readonly [Node];
}>;
