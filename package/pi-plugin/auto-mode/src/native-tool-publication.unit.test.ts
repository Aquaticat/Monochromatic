/** Original native manager copies preserve tool input lineage without granting authority. @module */
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';

/** Independent native declaration shape includes adversarial schema text. */
type Tool = { name: string; description: string; parameters: { type: string; description: string } };
/** Consumer fixture exercises the native system update boundary. */
type Message = { role: string; content: string; sections: Record<string, string>; toolsAdded: Tool[]; toolsRemoved: { name: string }[]; timestamp: number };
/** Only the native manager can publish inputs used by this consumer. */
type Manager = { readonly appendMessage: (value: Message) => unknown;
  readonly buildSessionContext: () => { readonly messages: Message[] } };
/** Runtime export checks keep these tests independent of implementation typing. */
type ManagerModule = { readonly SessionManager: { readonly inMemory: () => Manager };
  readonly readNativeConstructedInputOrigins: (manager: Manager) => readonly {
    readonly source: { readonly content: string; readonly permission: boolean; readonly occurrence: object };
    readonly publication: object }[];
  readonly assertNativeSessionInputCapture: (manager: Manager) => void };
/** Readers return the original publication object, never equal source content. */
type PublicationModule = { readonly readOriginalToolPublication: (value: unknown) => unknown;
  readonly readOriginalMessagePublication: (value: unknown) => unknown;
  readonly readOriginalSystemPublication: (value: unknown) => unknown };

/**
 Require the exact manager exports before native construction.
 @param value - built native module namespace
 @returns assertion exposing the independent consumer contract
 @throws Error when required original native observers are unavailable
 */
function assertManagerModule(value: unknown): asserts value is ManagerModule {
  if ((value === null) || ((typeof value) !== 'object')) throw new Error('Native manager module is missing');
  for (const key of ['readNativeConstructedInputOrigins', 'assertNativeSessionInputCapture']) {
    if ((typeof Reflect.get(value, key)) !== 'function') throw new Error(`Native manager export ${key} is missing`);
  }
  /** Native constructor owns the input observations tested here. */
  const constructor: unknown = Reflect.get(value, 'SessionManager');
  if (((typeof constructor) !== 'function') || ((typeof Reflect.get(constructor, 'inMemory')) !== 'function'))
    throw new Error('Native manager constructor is missing');
}

/**
 Require source publication readers from the staged module.
 @param value - built publication namespace
 @returns assertion exposing independent original identity readers
 @throws Error when a publication reader is missing
 */
function assertPublicationModule(value: unknown): asserts value is PublicationModule {
  if ((value === null) || ((typeof value) !== 'object')) throw new Error('Native publication module is missing');
  for (const key of ['readOriginalToolPublication', 'readOriginalMessagePublication', 'readOriginalSystemPublication']) {
    if ((typeof Reflect.get(value, key)) !== 'function') throw new Error(`Native publication reader ${key} is missing`);
  }
}

/** Native staging emits these exact modules for the host and serializer. */
const managerNamespace: unknown = await import(new URL(
  '../dist/native/contract/integration/native-batch/generated/session-manager.mjs', import.meta.url,
).href);
assertManagerModule(managerNamespace);
/** Function declarations retain this explicitly established native contract. */
const managerModule: ManagerModule = managerNamespace;
/** The source owner and native manager share their original alias module. */
const publicationModule: unknown = await import(new URL(
  '../dist/native/contract/collector/run-prompt-custody-v3/handler-publication.mjs', import.meta.url,
).href);
assertPublicationModule(publicationModule);

/**
 Start with an actual in-memory native manager and its original append method.
 @param proseOnly - exercise system prose without a tool declaration field
 @returns disposable source and copied context with original publication references
 */
function fixture(proseOnly = false) {
  /** This manager writes no session files. */
  const manager = managerModule.SessionManager.inMemory();
  /** JSON grammar boundary cases remain original captured data. */
  const message: Message = { role: 'system', content: '', sections: { 'quoted"section': '</system>\noriginal' },
    toolsRemoved: [{ name: 'removed_tool' }], timestamp: 0, toolsAdded: [{
    name: 'fixture_tool', description: 'Quoted "tool"\n</system>',
    parameters: { type: 'object', description: '../path; \\escaped\\' },
  }] };
  if (proseOnly) Reflect.deleteProperty(message, 'toolsAdded');
  manager.appendMessage(message);
  managerModule.assertNativeSessionInputCapture(manager);
  /** Append captures one existing manager input source. */
  const origins = managerModule.readNativeConstructedInputOrigins(manager);
  /** Native defensive copies must preserve the same original source publication. */
  const context = manager.buildSessionContext();
  /** Require the real system projection before exercising mutation controls. */
  const [copied] = context.messages;
  /** Exactly one original source must exist for this append. */
  const [origin] = origins;
  if ((copied === undefined) || (origin === undefined)) throw new Error('Native system tool fixture did not publish its input');
  return { manager, message, copied, origin, origins };
}

//region Native copy observations preserve membership and source authority stays absent

await describe({ name: '', children: [
  it({ name: 'retains one original manager input through native copies without freezing borrowed tools', fn: async function originalCopies() {
    /** Positive control traverses append, entries and context projection copies. */
    const input = fixture();
    expect(input.origins).toHaveLength(1);
    expect(input.origin.source.permission).toBe(false);
    expect(input.origin.source.content).toContain('fixture_tool');
    expect(input.copied).not.toBe(input.message);
    expect(input.copied.toolsAdded[0]).not.toBe(input.message.toolsAdded[0]);
    expect(publicationModule.readOriginalMessagePublication(input.copied)).toBe(input.origin.publication);
    expect(publicationModule.readOriginalToolPublication(input.message.toolsAdded[0])).toBe(input.origin.publication);
    expect(publicationModule.readOriginalToolPublication(input.copied.toolsAdded[0])).toBe(input.origin.publication);
    expect(publicationModule.readOriginalToolPublication({ ...input.copied.toolsAdded[0] })).toBeUndefined();
    expect(publicationModule.readOriginalToolPublication(input.copied)).toBeUndefined();
    expect(Object.isFrozen(input.message)).toBe(false);
    expect(Object.isFrozen(input.message.toolsAdded)).toBe(false);
    expect(Object.isFrozen(input.message.toolsAdded[0])).toBe(false);
  } }),
  ...['array', 'tool', 'schema', 'accessor'].map(function mutationCase(change) {
    return it({ name: `retires changed ${change} identity or data without blessing replacements`, fn: async function changedInput() {
      /** Each branch begins with a proven original publication. */
      const input = fixture();
      /** Keep the originally published object to detect retirement of old aliases. */
      const [original] = input.copied.toolsAdded;
      if (original === undefined) throw new Error('Native copied declaration is missing');
      expect(publicationModule.readOriginalToolPublication(original)).toBe(input.origin.publication);
      /** An accessor must never execute during integrity inspection. */
      const reads = { count: 0 };
      if (change === 'array') input.copied.toolsAdded = [...input.copied.toolsAdded];
      else if (change === 'tool') input.copied.toolsAdded[0] = { ...original };
      else if (change === 'schema') original.parameters.description = 'Changed instruction';
      else Object.defineProperty(original, 'description', { enumerable: true, get() {
        reads.count += 1;
        return 'Changed accessor';
      } });
      expect(publicationModule.readOriginalToolPublication(original)).toBeUndefined();
      expect(publicationModule.readOriginalToolPublication(input.copied.toolsAdded[0])).toBeUndefined();
      expect(reads.count).toBe(0);
    } });
  }),
  ...[false, true].flatMap(function systemInputCases(proseOnly) {
    return ['unchanged', 'content', 'sections', 'section-text', 'removed-tools', 'optional-accessor'].map(function systemChange(change) {
      return it({ name: `retains original system fields with proseOnly=${String(proseOnly)} and rejects ${change}`, fn: async function systemFields() {
        /** Both declaration-bearing and prose-only inputs use the original native manager. */
        const input = fixture(proseOnly);
        expect(publicationModule.readOriginalSystemPublication(input.message)).toBe(input.origin.publication);
        expect(publicationModule.readOriginalSystemPublication(input.copied)).toBe(input.origin.publication);
        expect(publicationModule.readOriginalSystemPublication({ ...input.copied })).toBeUndefined();
        expect(input.origin.source.permission).toBe(false);
        expect(Object.isFrozen(input.message.sections)).toBe(false);
        /** Accessor rejection must precede any borrowed getter invocation. */
        const reads = { count: 0 };
        if (change === 'content') input.copied.content = 'changed prose';
        else if (change === 'sections') input.copied.sections = { ...input.copied.sections };
        else if (change === 'section-text') input.copied.sections['new section'] = 'changed section';
        else if (change === 'removed-tools') input.copied.toolsRemoved = [...input.copied.toolsRemoved];
        else if (change === 'optional-accessor') Object.defineProperty(input.copied, 'toolsAdded', { enumerable: true,
          get() { reads.count += 1;
          return undefined; } });
        if (change === 'unchanged') expect(publicationModule.readOriginalSystemPublication(input.copied)).toBe(input.origin.publication);
        else {
          expect(publicationModule.readOriginalSystemPublication(input.copied)).toBeUndefined();
          expect(publicationModule.readOriginalSystemPublication(input.message)).toBeUndefined();
        }
        expect(reads.count).toBe(0);
      } });
    });
  }),
  it({ name: 'isolates equal declarations and rejects reuse without overwriting the first owner', fn: async function separateOwners() {
    /** Equal metadata in separate managers retains distinct original source publications. */
    const first = fixture();
    /** A second actual native manager establishes the same metadata independently. */
    const second = fixture();
    expect(first.origin.source.content).toBe(second.origin.source.content);
    expect(first.origin.publication).not.toBe(second.origin.publication);
    expect(publicationModule.readOriginalToolPublication(second.copied.toolsAdded[0])).toBe(second.origin.publication);
    /** A third manager cannot appropriate the first original tool object. */
    const conflicting = managerModule.SessionManager.inMemory();
    conflicting.appendMessage({ ...first.message });
    expect(function conflictingCapture() {
      managerModule.assertNativeSessionInputCapture(conflicting);
    })
      .toThrow('Original session inputs exceed the supported source capture profile');
    expect(publicationModule.readOriginalToolPublication(first.message.toolsAdded[0])).toBe(first.origin.publication);
    expect(publicationModule.readOriginalToolPublication(second.message.toolsAdded[0])).toBe(second.origin.publication);
  } }),
] });

//endregion Native copy observations preserve membership and source authority stays absent
