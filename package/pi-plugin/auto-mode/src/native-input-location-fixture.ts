/**
 Independent built consumer contract and representative original native input slots. @module
 */

/**
 Consumer calls intentionally admit malformed values to verify the runtime boundary.
 */
type InputLocationModule = Readonly<{
  sourceInputLocation: (source: unknown) => { inputLocation?: Record<string, unknown> };
  SourceInputLocationError: new (message: string) => Error;
}>;

/**
 Require the original input-location exports before exercising representation behavior.

 @param value - unknown built namespace

 @returns assertion exposing the independently declared consumer contract

 @throws Error for an unavailable native source position export
 */
function assertInputLocationModule(value: unknown): asserts value is InputLocationModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('sourceInputLocation' in value)) || ((typeof value.sourceInputLocation) !== 'function')
    || (!('SourceInputLocationError' in value)) || ((typeof value.SourceInputLocationError) !== 'function')) throw new Error('Built source input location exports are unavailable');
}

/**
 Tests use the original public entry after the maintained native artifact is rebuilt.
 */
const loaded: unknown = await import(new URL('../dist/native/contract/lifecycle/governing-rule-candidates/input-location.mjs', import.meta.url).href);
assertInputLocationModule(loaded);
/**
 Original position-copying callable with an independent runtime-testing input contract.
 */
export const sourceInputLocation: InputLocationModule['sourceInputLocation'] = loaded.sourceInputLocation;
/**
 Stable native position failure category remains observable through the original export.
 */
export const InputLocationError: InputLocationModule['SourceInputLocationError'] = loaded.SourceInputLocationError;

/**
 Every supported native slot has its own independently authored input sample.
 */
export const inputLocationCases: readonly Readonly<Record<string, unknown>>[] = [
  { field: 'toolGuidelines', toolName: 'tool', ordinal: 0 },
  ...['toolSnippets', 'sections'].map(function namedText(field) { return { field, key: 'original-key' }; }),
  ...['customPrompt', 'appendSystemPrompt', 'expandedPrompt'].map(function scalarPrompt(field) { return { field }; }),
  { field: 'contextFiles', ordinal: 0, path: '../original/context.md' },
  { field: 'skills', ordinal: 0, metadataJSON: '{"original":true}' },
  ...[
    'queuedMessages', 'customMessage', 'inputEvent', 'uninterceptedInput', 'transformedInput',
    'commandInput', 'callInput', 'agentInput', 'managerInput', 'customTools', 'extensionTool',
    'toolLoadoutOutput', 'toolLoadoutInput', 'toolLoadoutQuery', 'handlerResult', 'contextHandler',
    'eventHandler', 'resourceCallback',
  ].map(function constructedMessage(field) { return { field, metadataJSON: '{"original":true}' }; }),
  ...['emitterMessages', 'sessionMessages', 'handlerOptions'].map(function orderedMessage(field) { return { field, ordinal: 0, metadataJSON: '{"original":true}' }; }),
  { field: 'nativePromptBuilder', ordinal: 0, slot: 'original-slot' },
];

/**
 Reject incidental exceptions when asserting a specific native position boundary.

 @param message - expected original operation diagnostic

 @returns predicate accepting only the intended source position failure

 @example inputLocationFailure('Source input location requires a data property');
 */
export function inputLocationFailure(message: string): (error: unknown) => boolean {
  return function matchesLocationFailure(error: unknown): boolean {
    return Error.isError(error) && (error.name === 'SourceInputLocationError') && (error.message === message);
  };
}
