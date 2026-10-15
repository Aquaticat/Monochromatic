/**
 Native source positions identify representation slots without establishing instruction authority. @module
 */

/**
 Original message and callback inputs retain their serialized native companion metadata.
 */
export type MetadataInputField = 'queuedMessages' | 'customMessage' | 'inputEvent'
  | 'uninterceptedInput' | 'transformedInput' | 'commandInput' | 'callInput' | 'agentInput'
  | 'managerInput' | 'customTools' | 'extensionTool' | 'toolLoadoutOutput' | 'toolLoadoutInput'
  | 'toolLoadoutQuery' | 'handlerResult' | 'contextHandler' | 'eventHandler' | 'resourceCallback';

/**
 Indexed message and option inputs retain original occurrence order beside their metadata.
 */
export type IndexedMetadataInputField = 'skills' | 'emitterMessages' | 'sessionMessages' | 'handlerOptions';

/**
 Source positions copy only the original native slot fields admitted by the wire boundary.
 */
export type SourceInputPosition =
  | { field: 'toolGuidelines'; toolName: string; ordinal: number }
  | { field: 'toolSnippets' | 'sections'; key: string }
  | { field: 'customPrompt' | 'appendSystemPrompt' | 'expandedPrompt' }
  | { field: 'contextFiles'; ordinal: number; path: string }
  | { field: IndexedMetadataInputField; ordinal: number; metadataJSON: string }
  | { field: MetadataInputField; metadataJSON: string }
  | { field: 'nativePromptBuilder'; ordinal: number; slot: string };

/**
 Absent source position remains an omitted property rather than an invented native slot.
 */
export type SourceInputLocation = { inputLocation?: SourceInputPosition };
