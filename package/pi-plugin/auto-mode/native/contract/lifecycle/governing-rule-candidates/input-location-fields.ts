/**
 Native slot membership narrows the original discriminator without changing source read order. @module
 */
import type {
  MetadataInputField,
  IndexedMetadataInputField
} from './input-location-types.ts';

/**
 Original constructed-message and callback slot names.
 */
const metadataFields: readonly string[] = [
  'queuedMessages',
  'customMessage',
  'inputEvent',
  'uninterceptedInput',
  'transformedInput',
  'commandInput',
  'callInput',
  'agentInput',
  'managerInput',
  'customTools',
  'extensionTool',
  'toolLoadoutOutput',
  'toolLoadoutInput',
  'toolLoadoutQuery',
  'handlerResult',
  'contextHandler',
  'eventHandler',
  'resourceCallback',
] satisfies readonly MetadataInputField[];

/**
 Identify native named-text input slots.

 @param field - untrusted native field discriminator

 @returns whether the original field names a named-text slot

 @example isNamedInputField('sections');
 */
export function isNamedInputField(field: unknown): field is 'toolSnippets' | 'sections' {
  return (field === 'toolSnippets') || (field === 'sections');
}

/**
 Identify native scalar prompt slots.

 @param field - untrusted native field discriminator

 @returns whether the original field needs no companion position values

 @example isScalarInputField('expandedPrompt');
 */
export function isScalarInputField(field: unknown): field is 'customPrompt' | 'appendSystemPrompt' | 'expandedPrompt' {
  return (field === 'customPrompt') || (field === 'appendSystemPrompt')
    || (field === 'expandedPrompt');
}

/**
 Identify original constructed-message and callback slots.

 @param field - untrusted native field discriminator

 @returns whether the original field carries serialized companion metadata

 @example isMetadataInputField('managerInput');
 */
export function isMetadataInputField(field: unknown): field is MetadataInputField {
  return ((typeof field) === 'string') && metadataFields.includes(field);
}

/**
 Identify original ordered message and handler-option slots.

 @param field - untrusted native field discriminator

 @returns whether the original field carries an ordinal and companion metadata

 @example isIndexedMetadataInputField('sessionMessages');
 */
export function isIndexedMetadataInputField(field: unknown): field is Exclude<IndexedMetadataInputField, 'skills'> {
  return (field === 'emitterMessages') || (field === 'sessionMessages')
    || (field === 'handlerOptions');
}
