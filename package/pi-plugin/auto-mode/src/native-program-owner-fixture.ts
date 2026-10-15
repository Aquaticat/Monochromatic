/**
 Disposable native program owners exercise the built original source decoder and ownership entry. @module
 */
import assert from 'node:assert/strict';
import type {
  FixtureProgramDeclaration,
  FixtureProgramModule,
  FixtureProgramRecord,
  FixtureProgramState,
  ProgramOwnerFixture
} from './native-program-owner-fixture-types.ts';

/**
 Admit the original built program owner before independently supplying its host capabilities.

 @param value - unknown built module namespace

 @returns assertion exposing the original native owner
 */
function assertProgramModule(value: unknown): asserts value is FixtureProgramModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('createJudgmentPrograms' in value))
    || ((typeof value.createJudgmentPrograms) !== 'function')) throw new Error('Built native program owner is unavailable');
}

/**
 Native decoder remains the original runtime authority for source declaration membership.
 */
type FixtureProgramDecoder = Readonly<{
  declareResultProgram: (input: Readonly<{
    source: string;
    toolNames: readonly string[]
  }>) => FixtureProgramDeclaration;
}>;

/**
 Admit the original built decoder without reconstructing its declaration records.

 @param value - unknown built module namespace

 @returns assertion exposing original source declaration
 */
function assertProgramDecoder(value: unknown): asserts value is FixtureProgramDecoder {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('declareResultProgram' in value))
    || ((typeof value.declareResultProgram) !== 'function')) throw new Error('Built native program decoder is unavailable');
}

/**
 The runtime facade consumed by the real judgment supplies the owner under test.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/judgment-programs.mjs',
  import.meta.url
).href);
assertProgramModule(loaded);
/**
 Tests can construct independent owners with the exact same fixed fixture capabilities.
 */
export const createFixtureProgramOwner: FixtureProgramModule['createJudgmentPrograms'] = loaded.createJudgmentPrograms;
/**
 Source membership always comes from the rebuilt original decoder.
 */
const decoded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/program-profile.mjs',
  import.meta.url
).href);
assertProgramDecoder(decoded);
/**
 Consumers can distinguish equal copied declarations from newly decoded original occurrences.
 */
export const declareFixtureProgram: FixtureProgramDecoder['declareResultProgram'] = decoded.declareResultProgram;

/**
 Original fixture program binds producer text into a complete native parallel successor group.
 */
export const PROGRAM_OWNER_SOURCE = 'const result = await tools.read({ path: "source.txt" }); return await Promise.all([tools.write({ text: result }), tools.read({ path: result })]);';

//region Each owner has independent source, parent, prepared members, and failure controls.
/**
 Construct independently controlled original host capabilities for the built program owner.

 @param source - original inspected source bytes

 @returns disposable original owner and its independently controlled host records

 @example createProgramOwnerFixture();
 */
export function createProgramOwnerFixture({ source = PROGRAM_OWNER_SOURCE }: Readonly<{ source?: string }> = {}): ProgramOwnerFixture {
  const events: string[] = [];
  const state: FixtureProgramState = {};
  const controller = new AbortController();
  const parent = new AbortController();
  const member = Object.freeze({});
  const record: FixtureProgramRecord = {
    prepared: Object.freeze({
      id: 'root',
      name: 'code',
      input: Object.freeze({ code: source })
    }),
    effectiveSignal: controller.signal,
  };
  const bindings = new WeakMap<object, FixtureProgramRecord>([[
    member,
    record
  ]]);
  const executions = new WeakMap<object, FixtureProgramRecord>();
  const childGroups: object[] = [];
  const judgment = Object.freeze({});
  const response = Object.freeze({});
  const stream = Object.freeze({});
  const declaration = declareFixtureProgram({
    source,
    toolNames: [
      'read',
      'write'
    ]
  });
  /**
   Source inspection retains its original independently failing tool dependency reader.
   */
  function assertCurrent(): void {
    events.push('tools');
    if (state.toolFailure) throw state.toolFailure;
  }
  /**
   Program views retain the original enclosing judgment occurrence.

   @returns original fixture judgment
   */
  function readJudgment(): object { events.push('judgment');
  if (state.judgmentFailure) throw state.judgmentFailure;
  return judgment; }
  /**
   Known member lookup authenticates exact original handles before reading state.

   @param handle - original prepared member candidate

   @returns fixture-owned original record
   */
  function knownMember(handle: unknown): FixtureProgramRecord {
    events.push('member');
    if ((handle === null) || ((typeof handle) !== 'object')) throw new Error('Fixture member is foreign');
    const value = bindings.get(handle);
    if (!value) throw new Error('Fixture member is foreign');
    return value;
  }
  /**
   Known execution lookup authenticates the reserved original parent token.

   @param token - original execution candidate

   @returns original parent record
   */
  function knownExecution(token: object): FixtureProgramRecord {
    events.push('execution');
    const value = executions.get(token);
    if ((!value) || (value.execution
      ?.token
      !== token)) throw new Error('Fixture execution is foreign');
    return value;
  }
  /**
   Original lifetime can fail independently of dependency eligibility.
   */
  function ready(): void { events.push('ready');
  if (state.readyFailure) throw state.readyFailure; }
  /**
   Source preparation invokes the exact original captured tool reader.

   @param check - original source dependency check
   */
  function dependencyCheck(check: () => void): void { events.push('dependency-check');
  check(); }
  /**
   Live program use requires original source dependencies to remain current.
   */
  function assertDependenciesCurrent(): void { events.push('dependencies');
  if (state.dependencyFailure) throw state.dependencyFailure; }
  /**
   Entry checks preserve the original prepared member's effective cancellation signal.

   @param original - fixture-owned original record
   */
  function parentCurrent(original: FixtureProgramRecord): void { events.push('parent');
  original.effectiveSignal
    .throwIfAborted(); }
  /**
   Synchronous operation callbacks retain their original names and result identity.

   @param run - original owner callback

   @returns original callback result
   */
  function operation<Result>(run: () => Result): Result {
    events.push(`operation:${run.name}`);
    if (state.operationFailure
      ?.callback
      === run.name) throw state.operationFailure
        .error;
    return run();
  }
  const input = {
    readJudgment,
    response,
    stream,
    signal: controller.signal,
    knownMember,
    knownExecution,
    ready,
    dependencyCheck,
    assertDependenciesCurrent,
    parentCurrent,
    bindings,
    childGroups,
    operation
  };
  const owner = createFixtureProgramOwner(input);
  assert.equal(
    events.length,
    0
  );
  /**
   Original parent entry is controlled independently from prepared source inspection.

   @returns original parent token
   */
  function begin(): object {
    const token = Object.freeze({});
    record.execution = {
      token,
      state: 'active',
      origin: Object.freeze({ signal: parent.signal })
    };
    executions.set(
      token,
      record
    );
    return token;
  }
  /**
   Open the original declaration through its real prepared and active-parent boundaries.

   @returns original program handle
   */
  function open(): object {
    owner.bindPreparedProgram({
      member,
      declaration,
      assertCurrent
    });
    return owner.openProgram({
      parentToken: begin(),
      toolNames: [
        'read',
        'write'
      ]
    });
  }
  return {
    owner,
    input,
    declaration,
    member,
    record,
    judgment,
    response,
    stream,
    parent,
    controller,
    state,
    events,
    bindings,
    childGroups,
    assertCurrent,
    begin,
    open
  };
}
//endregion
