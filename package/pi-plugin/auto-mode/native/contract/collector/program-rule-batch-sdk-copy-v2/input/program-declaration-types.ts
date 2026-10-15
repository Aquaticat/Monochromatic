/**
 Original source declarations describe bounded callsites without granting execution permission. @module
 */

/**
 Source-owned callsites retain their parser-owned argument pattern and original text span.
 */
export type DeclaredProgramSite = Readonly<{
  group: number;
  ordinal: number;
  name: string;
  pattern: object;
  callee: Readonly<{
    start: number;
    end: number;
    text: string
  }>;
  alias: string;
}>;

/**
 Original group order distinguishes the producer from any native parallel successors.
 */
export type DeclaredProgramGroup = Readonly<{
  ordinal: number;
  kind: 'awaited-single' | 'awaited-producer' | 'all' | 'allSettled';
  members: readonly DeclaredProgramSite[];
}>;

/**
 Parser-owned declaration keeps original and compiled source identities together.
 */
export type DeclaredResultProgram = Readonly<{
  source: string;
  sourceSHA256: string;
  compiledSource: string;
  compiledSHA256: string;
  bindingName?: string;
  groups: readonly DeclaredProgramGroup[];
  sites: readonly DeclaredProgramSite[];
  profile: 'awaited-literal-single-call' | 'awaited-string-result-then-literal-parallel';
  effectQualification: 'not-established';
  instructionAuthority: 'not-established';
}>;

/**
 Prepared native members retain their exact frozen input object.
 */
export type ProgramPreparedMember = Readonly<{
  id: string;
  name: string;
  input: Readonly<Record<string, unknown>>;
}>;

/**
 Materialized callsites retain the exact serialized input used for native call comparison.
 */
export type ReachedProgramSite = DeclaredProgramSite & Readonly<{
  args: unknown;
  argsJSON: string;
}>;

/**
 Reached-group views carry original source and complete argument materialization.
 */
export type ReachedProgramView = Readonly<{
  handle: object;
  ordinal: number;
  declaration: DeclaredResultProgram;
  members: readonly ReachedProgramSite[];
}>;

/**
 Prepared inspection publishes original ownership while explicitly withholding permission.
 */
export type PreparedProgramView = Readonly<{
  kind: 'original-prepared-program-inspection';
  member: object;
  prepared: ProgramPreparedMember;
  declaration: DeclaredResultProgram;
  permission: false;
}>;

/**
 Open program views retain original enclosing execution identities.
 */
export type OriginalProgramView = Readonly<{
  declaration: DeclaredResultProgram;
  parent: object;
  judgment: object;
  response: object;
  stream: object;
  permission: 'not-established';
}>;
