/**
 Independent built consumers for original governing-source bindings and source-set ownership. @module
 */
import { createHash } from 'node:crypto';

/**
 Fixture occurrence identity is independently owned even when source text repeats.
 */
export type FixtureGoverningSource = Readonly<{
  content: string;
  sha256: string;
  occurrence: object
}>;

/**
 Consumers distinguish ordinary clauses, retained spans, and contextual-heading aggregates.
 */
export type FixtureGoverningProjection = Readonly<{
  sourceOccurrence: unknown;
  sourceSHA256: string;
  sourceOrdinal?: number;
  code?: string;
  kind?: string;
  nodeType?: string;
  start?: number;
  end?: number;
  text?: string;
  textSHA256?: string;
  headings: readonly unknown[];
  authorityEstablishedByIndex: false;
  semanticQualification: 'not-established';
}>;

/**
 Retained source diagnostics remain available independently of current candidate eligibility.
 */
export type FixtureGoverningSnapshot = Readonly<{
  retainedOnly: true;
  stale: boolean;
  failure: unknown;
  sourceSHA256: string;
  sourceOrdinal?: number;
  sourceOccurrence?: unknown;
  codes: readonly string[];
  unclassified: readonly Readonly<{
    candidate: object;
    start: number;
    end: number;
    text: string;
    type: string
  }>[];
  instructionCandidates: readonly object[];
  contextualHeadings: readonly Readonly<{
    start: number;
    end: number;
    text: string;
    depth: number
  }>[];
  headingContextCandidate?: object;
  structuralCoverage: string;
  authorityEstablishedByIndex: false;
  semanticQualification: 'not-established';
}>;

/**
 Source and set consumers share original membership selection operations.
 */
type CandidateOperations = Readonly<{
  select: (code: unknown) => object;
  read: (handle: unknown) => FixtureGoverningProjection;
  indexedCandidates: () => readonly object[];
  indexedInstructionCandidates: () => readonly object[];
  indexedHeadingContextCandidates: () => readonly object[];
}>;

/**
 The single-source consumer can inspect retained diagnostics after invalidation.
 */
export type FixtureGoverningBindings = CandidateOperations & Readonly<{ inspect: () => FixtureGoverningSnapshot }>;

/**
 Set inspection additionally authenticates the original source-list lifetime.
 */
export type FixtureGoverningSet = CandidateOperations & Readonly<{ inspect: () => readonly FixtureGoverningSnapshot[] }>;

/**
 Built parser results remain opaque to the fixture; the original binding validates their structural index.
 */
export type FixturePolicyParser = (input: Readonly<{
  source: string;
  mdx: boolean
}>) => unknown;

/**
 Independent consumer signature deliberately permits runtime malformed source and parser inputs.
 */
type GoverningBindingsModule = Readonly<{
  createGoverningRuleBindings: (input: Readonly<{
    readSource: unknown;
    parse: unknown
  }>) => FixtureGoverningBindings;
  GoverningRuleBindingError: new (message: string, options?: ErrorOptions) => Error;
}>;

/**
 Source-list admission is tested through the original exported constructor.
 */
type GoverningSetModule = Readonly<{
  createGoverningRuleSet: (input: Readonly<{
    readSources: () => unknown;
    parse: unknown
  }>) => FixtureGoverningSet;
}>;

/**
 Parser qualification is exercised through the existing built adapter.
 */
type ParserModule = Readonly<{
  createNativeMarkdownParser: (input: Readonly<{ expectedVersion: string }>) => Promise<Readonly<{ parse: FixturePolicyParser }>>;
}>;

/**
 Require the original source-binding factory before supplying fixture capabilities.

 @param value - unknown built namespace

 @returns assertion exposing the original consumer boundary

 @throws Error for an absent built source-binding export
 */
function assertBindingsModule(value: unknown): asserts value is GoverningBindingsModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('createGoverningRuleBindings' in value))
    || ((typeof value.createGoverningRuleBindings) !== 'function')
    || (!('GoverningRuleBindingError' in value))
    || ((typeof value.GoverningRuleBindingError) !== 'function')) throw new Error('Built governing-source binding export is unavailable');
}

/**
 Require the original source-set factory before supplying fixture membership.

 @param value - unknown built namespace

 @returns assertion exposing the original consumer boundary

 @throws Error for an absent built source-set export
 */
function assertSetModule(value: unknown): asserts value is GoverningSetModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('createGoverningRuleSet' in value))
    || ((typeof value.createGoverningRuleSet) !== 'function')) throw new Error('Built governing-source set export is unavailable');
}

/**
 Require the existing qualified Markdown parser factory.

 @param value - unknown built namespace

 @returns assertion exposing the incumbent parser factory

 @throws Error for an absent built native parser export
 */
function assertParserModule(value: unknown): asserts value is ParserModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('createNativeMarkdownParser' in value))
    || ((typeof value.createNativeMarkdownParser) !== 'function')) throw new Error('Built native Markdown parser export is unavailable');
}

/**
 Tests consume the original native entry paths after the owned artifact is rebuilt.
 */
const loaded: readonly unknown[] = await Promise.all([
  import(new URL(
    '../dist/native/contract/lifecycle/governing-rule-candidates/bindings.mjs',
    import.meta.url
  ).href),
  import(new URL(
    '../dist/native/contract/lifecycle/governing-rule-candidates/set.mjs',
    import.meta.url
  ).href),
  import(new URL(
    '../dist/native/contract/native-index/native-parser.ts',
    import.meta.url
  ).href),
]);
/**
 Original source-binding, source-set, and parser namespaces await runtime export admission.
 */
const [bindingModule, setModule, parserModule] = loaded;
assertBindingsModule(bindingModule);
assertSetModule(setModule);
assertParserModule(parserModule);
/**
 Named test helpers retain the admitted source-binding callable.
 */
export const createGoverningBindings: GoverningBindingsModule['createGoverningRuleBindings'] = bindingModule.createGoverningRuleBindings;
/**
 Original error construction retains message, cause, and derived constructor names.
 */
export const GoverningBindingError: GoverningBindingsModule['GoverningRuleBindingError'] = bindingModule.GoverningRuleBindingError;
/**
 Named test helpers retain the admitted source-set callable.
 */
export const createGoverningSet: GoverningSetModule['createGoverningRuleSet'] = setModule.createGoverningRuleSet;
/**
 Tests use the same qualified original Markdown parsing path as native policy consumers.
 */
export const governingParser: Readonly<{ parse: FixturePolicyParser }> = await parserModule.createNativeMarkdownParser({ expectedVersion: '0.10.5' });

/**
 Create original immutable source bytes and an independently owned occurrence identity.

 @param content - exact fixture source text

 @returns immutable source record with the original byte digest

 @example createGoverningSource('AAA: Original clause');
 */
export function createGoverningSource(content: string): FixtureGoverningSource {
  return Object.freeze({
    content,
    sha256: createHash('sha256').update(content).digest('hex'),
    occurrence: Object.freeze({})
  });
}

/**
 Distinguish the original binding guard from an incidental exception.

 @param message - exact expected original binding diagnostic

 @returns predicate accepting only that emitted source-binding error

 @example governingBindingError('Original governing source list changed');
 */
export function governingBindingError(message: string): (error: unknown) => boolean {
  return function originalBindingDiagnostic(error: unknown): boolean {
    return Error.isError(error) && (error.name === 'GoverningRuleBindingError')
      && (error.message === message);
  };
}
