/**
 Original prepared inspection and program reservation precede reached-group execution. @module
 */
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { assertDeclaredProgram } from './program-profile.mjs';
import { JudgmentConstructionError } from './judgment-error.ts';
import type { PreparedProgramView } from './program-declaration-types.ts';
import type {
  PreparedProgramLookup,
  ProgramOpening
} from './program-api.ts';
import type {
  BindPreparedProgramInput,
  ProgramContext
} from './program-operation-types.ts';
import type { ProgramOwnership } from './program-ownership.ts';
import type {
  ProgramGroup,
  ProgramScope
} from './program-state-types.ts';

//region Original declarations are reserved once and construction failures remain terminal.
/**
 Bind original source inspection and program opening to one judgment owner.

 @param input - original judgment capabilities

 @param state - original private custody maps

 @param ownership - original identity and currentness readers

 @returns original prepared and open-program operations

 @example createProgramOpening({ input, state, ownership });
 */
export function createProgramOpening({
  input,
  state,
  ownership
}: ProgramContext & Readonly<{ ownership: ProgramOwnership }>): ProgramOpening {
  const {
    readJudgment,
    response,
    stream,
    knownMember,
    knownExecution,
    ready,
    dependencyCheck,
    assertDependenciesCurrent,
    parentCurrent
  } = input;
  const {
    programs,
    groups
  } = state;
  const { currentProgram } = ownership;
  /**
   Publish source inspection only after original source and dependency checks succeed.

   @param member - original prepared root member

   @param declaration - source decoder's original declaration

   @param assertCurrent - original tool-dependency reader

   @returns immutable original inspection without permission
   */
  function bindPreparedProgram({
    member,
    declaration,
    assertCurrent
  }: BindPreparedProgramInput): PreparedProgramView {
    const record = knownMember(member);
    if ((record.parent !== undefined) || record.execution) throw new JudgmentConstructionError('Prepared program inspection requires an unentered original root member');
    if (record.preparedProgram) throw new JudgmentConstructionError('Original prepared program inspection is already bound');
    if ((typeof assertCurrent) !== 'function') throw new JudgmentConstructionError('Prepared program requires its original tool-dependency reader');
    assertDeclaredProgram(declaration);
    if (declaration.source
      !== record.prepared
      .input
      .code) throw new JudgmentConstructionError('Inspected program differs from the original prepared source');
    ready();
    dependencyCheck(assertCurrent);
    ready();
    const view: PreparedProgramView = Object.freeze({
      kind: 'original-prepared-program-inspection',
      member,
      prepared: record.prepared,
      declaration,
      permission: false
    });
    record.preparedProgram = {
      view,
      assertCurrent
    };
    return view;
  }
  /**
   Read retained inspection only after original dependency and parent-entry checks.

   @param member - original prepared member

   @returns original inspection when bound
   */
  function preparedProgramFor(member: object): PreparedProgramLookup {
    const record = knownMember(member);
    assertDependenciesCurrent();
    parentCurrent(record);
    return record.preparedProgram
      ?.view;
  }
  /**
   Reserve the program before validating its original prepared declaration.

   @param parentToken - original active parent execution

   @param toolNames - runtime callable names

   @returns original opaque program handle
   */
  function openProgram({
    parentToken,
    toolNames
  }: Readonly<{
    parentToken: object;
    toolNames: readonly string[]
  }>): object {
    const record = knownExecution(parentToken);
    if (record.execution
      .state
      !== 'active') throw new JudgmentConstructionError('Program parent execution has returned');
    assertDependenciesCurrent();
    record.execution
      .origin
      .signal
      .throwIfAborted();
    if (record.program) throw new JudgmentConstructionError('Parent execution already reserved its program declaration');
    const program = Object.freeze({});
    const scope: ProgramScope = {
      handle: program,
      status: 'opening',
      groups: [],
      guardFailures: [],
      seenGuards: new WeakSet()
    };
    record.program = scope;
    programs.set(
      program,
      record
    );
    try {
      const declaration = record.preparedProgram
        ?.view
        .declaration;
      if (!declaration) throw new JudgmentConstructionError('Native program requires its original declaration captured before policy review');
      if ((!Array.isArray(toolNames))
        || declaration.sites
        .some(function isUnknownToolSite(site) { return !toolNames.includes(site.name); })) throw new JudgmentConstructionError('Runtime callables differ from the original prepared program');
      currentProgram(program);
      scope.groups = declaration.groups
        .map(function createUnreachedGroup(definition): ProgramGroup {
        const group: ProgramGroup = { handle: Object.freeze({}), program, definition, state: 'unreached', slots: [] };
        groups.set(group.handle, group);
        return group;
      });
      scope.declaration = declaration;
      scope.view = Object.freeze({
        declaration,
        parent: parentToken,
        judgment: readJudgment(),
        response,
        stream,
        permission: 'not-established'
      });
      scope.status = 'open';
      return program;
    } catch (error) {
      scope.status = 'failed';
      scope.failure = error;
      throw error;
    }
  }
  /**
   Live program views retain the original opening publication.

   @param program - original opaque program handle

   @returns original view when published
   */
  function programFor(program: object): ProgramScope['view'] {
    return nonNullishOrThrow(currentProgram(program).program)
      .view;
  }
  return {
    bindPreparedProgram,
    preparedProgramFor,
    openProgram,
    programFor
  };
}
//endregion
