/**
 Copy native source positions without interpreting their authority or applicability. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { SourceInputLocationError } from './input-location-error.ts';
import { assertInputLocationRecord, inputLocationShape, isInputLocationOrdinal } from './input-location-record.ts';
import type { SourceInputLocation } from './input-location-types.ts';

/**
 Source-position diagnostics omit original paths, prompts, and serialized metadata.
 */
const l = tagged({ tag: 'auto-mode-source-input-location' });

//region Native slot admission preserves exact field shapes without normalizing source identity.
/**
 Preserve native input position as representation data, never authority or applicability.
 Original source/run owners authenticate the record; this copier only checks its wire shape.

 @param source - original source record whose optional own location is copied

 @returns fresh supported position projection or an empty record when no position exists

 @throws SourceInputLocationError for unsupported source position representation

 @example sourceInputLocation(source);
 */
export function sourceInputLocation(source: object): SourceInputLocation {
  /**
   Diagnostics mark the wire boundary without exposing source position content.
   */
  const sl = tagged({ tag: sourceInputLocation.name, l });
  sl.debug('copying original native source input position');
  /**
   Only an original own data property can describe a retained position.
   */
  const descriptor = Object.getOwnPropertyDescriptor(source, 'inputLocation');
  if (descriptor === undefined) return {};
  if (!Object.hasOwn(descriptor, 'value')) throw new SourceInputLocationError('Source input location requires a data property');
  /**
   Descriptor values remain untrusted until their ordinary record shape is established.
   */
  const location: unknown = descriptor.value;
  assertInputLocationRecord(location);
  /**
   Exact original own keys distinguish every supported native slot representation.
   */
  const shape = inputLocationShape(location);
  switch (location.field) {
    case 'toolGuidelines': {
      if ((shape !== 'field,ordinal,toolName') || ((typeof location.toolName) !== 'string')
        || (!isInputLocationOrdinal(location.ordinal))) throw new SourceInputLocationError('Source input location differs from the native tool-guideline slot');
      return { inputLocation: { field: location.field, toolName: location.toolName, ordinal: location.ordinal } };
    }
    case 'toolSnippets':
    case 'sections': {
      if ((shape !== 'field,key') || ((typeof location.key) !== 'string')) throw new SourceInputLocationError('Source input location differs from the native named-text slot');
      return { inputLocation: { field: location.field, key: location.key } };
    }
    case 'customPrompt':
    case 'appendSystemPrompt':
    case 'expandedPrompt': {
      if (shape !== 'field') throw new SourceInputLocationError('Scalar prompt location accepts only its native field');
      return { inputLocation: { field: location.field } };
    }
    case 'contextFiles': {
      if ((shape !== 'field,ordinal,path') || (!isInputLocationOrdinal(location.ordinal))
        || ((typeof location.path) !== 'string')) throw new SourceInputLocationError('Context input location requires its native ordinal and path');
      return { inputLocation: { field: location.field, ordinal: location.ordinal, path: location.path } };
    }
    case 'skills': {
      if ((shape !== 'field,metadataJSON,ordinal') || (!isInputLocationOrdinal(location.ordinal))
        || ((typeof location.metadataJSON) !== 'string')) throw new SourceInputLocationError('Skill input location requires its native ordinal and serialized companion metadata');
      return { inputLocation: { field: location.field, ordinal: location.ordinal, metadataJSON: location.metadataJSON } };
    }
    case 'queuedMessages':
    case 'customMessage':
    case 'inputEvent':
    case 'uninterceptedInput':
    case 'transformedInput':
    case 'commandInput':
    case 'callInput':
    case 'agentInput':
    case 'managerInput':
    case 'customTools':
    case 'extensionTool':
    case 'toolLoadoutOutput':
    case 'toolLoadoutInput':
    case 'toolLoadoutQuery':
    case 'handlerResult':
    case 'contextHandler':
    case 'eventHandler':
    case 'resourceCallback': {
      if ((shape !== 'field,metadataJSON') || ((typeof location.metadataJSON) !== 'string')) throw new SourceInputLocationError('Constructed message input location requires serialized native metadata');
      return { inputLocation: { field: location.field, metadataJSON: location.metadataJSON } };
    }
    case 'emitterMessages':
    case 'sessionMessages':
    case 'handlerOptions': {
      if ((shape !== 'field,metadataJSON,ordinal') || (!isInputLocationOrdinal(location.ordinal))
        || ((typeof location.metadataJSON) !== 'string')) throw new SourceInputLocationError('Message input location requires its original ordinal and serialized metadata');
      return { inputLocation: { field: location.field, ordinal: location.ordinal, metadataJSON: location.metadataJSON } };
    }
    case 'nativePromptBuilder': {
      if ((shape !== 'field,ordinal,slot') || (!isInputLocationOrdinal(location.ordinal))
        || ((typeof location.slot) !== 'string')) throw new SourceInputLocationError('Built-in input location requires its original construction ordinal and slot');
      return { inputLocation: { field: location.field, ordinal: location.ordinal, slot: location.slot } };
    }
    default: throw new SourceInputLocationError('Source input location names an unsupported native field');
  }
}
//endregion
