/**
 Copy native source positions without interpreting their authority or applicability. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { SourceInputLocationError } from './input-location-error.ts';
import {
  assertInputLocationRecord,
  inputLocationShape,
  isInputLocationInteger
} from './input-location-record.ts';
import { isNamedInputField, isScalarInputField, isMetadataInputField, isIndexedMetadataInputField } from './input-location-fields.ts';
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
  const sl = tagged({
    tag: sourceInputLocation.name,
    l
  });
  sl.debug('copying original native source input position');
  /**
   Only an original own data property can describe a retained position.
   */
  const descriptor = Object.getOwnPropertyDescriptor(
    source,
    'inputLocation'
  );
  if (descriptor === undefined) return {};
  if (!Object.hasOwn(
    descriptor,
    'value'
  )) throw new SourceInputLocationError('Source input location requires a data property');
  /**
   Descriptor values remain untrusted until their ordinary record shape is established.
   */
  const location: unknown = descriptor.value;
  assertInputLocationRecord(location);
  /**
   Exact original own keys distinguish every supported native slot representation.
   */
  const shape = inputLocationShape(location);
  if (location.field === 'toolGuidelines') {
      if ((shape !== 'field,ordinal,toolName') || ((typeof location.toolName) !== 'string')
        || (!isInputLocationInteger(location.ordinal)) || (location.ordinal < 0)) throw new SourceInputLocationError('Source input location differs from the native tool-guideline slot');
      return { inputLocation: {
        field: location.field,
        toolName: location.toolName,
        ordinal: location.ordinal
      } };
    }
  if (isNamedInputField(location.field)) {
      if ((shape !== 'field,key') || ((typeof location.key) !== 'string')) throw new SourceInputLocationError('Source input location differs from the native named-text slot');
      return { inputLocation: {
        field: location.field,
        key: location.key
      } };
    }
  if (isScalarInputField(location.field)) {
      if (shape !== 'field') throw new SourceInputLocationError('Scalar prompt location accepts only its native field');
      return { inputLocation: { field: location.field } };
    }
  if (location.field === 'contextFiles') {
      if ((shape !== 'field,ordinal,path') || (!isInputLocationInteger(location.ordinal)) || (location.ordinal < 0)
        || ((typeof location.path) !== 'string')) throw new SourceInputLocationError('Context input location requires its native ordinal and path');
      return { inputLocation: {
        field: location.field,
        ordinal: location.ordinal,
        path: location.path
      } };
    }
  if (location.field === 'skills') {
      if ((shape !== 'field,metadataJSON,ordinal') || (!isInputLocationInteger(location.ordinal)) || (location.ordinal < 0)
        || ((typeof location.metadataJSON) !== 'string')) throw new SourceInputLocationError('Skill input location requires its native ordinal and serialized companion metadata');
      return { inputLocation: {
        field: location.field,
        ordinal: location.ordinal,
        metadataJSON: location.metadataJSON
      } };
    }
  if (isMetadataInputField(location.field)) {
      if ((shape !== 'field,metadataJSON') || ((typeof location.metadataJSON) !== 'string')) throw new SourceInputLocationError('Constructed message input location requires serialized native metadata');
      return { inputLocation: {
        field: location.field,
        metadataJSON: location.metadataJSON
      } };
    }
  if (isIndexedMetadataInputField(location.field)) {
      if ((shape !== 'field,metadataJSON,ordinal') || (!isInputLocationInteger(location.ordinal)) || (location.ordinal < 0)
        || ((typeof location.metadataJSON) !== 'string')) throw new SourceInputLocationError('Message input location requires its original ordinal and serialized metadata');
      return { inputLocation: {
        field: location.field,
        ordinal: location.ordinal,
        metadataJSON: location.metadataJSON
      } };
    }
  if (location.field === 'nativePromptBuilder') {
      if ((shape !== 'field,ordinal,slot') || (!isInputLocationInteger(location.ordinal)) || (location.ordinal < 0)
        || ((typeof location.slot) !== 'string')) throw new SourceInputLocationError('Built-in input location requires its original construction ordinal and slot');
      return { inputLocation: {
        field: location.field,
        ordinal: location.ordinal,
        slot: location.slot
      } };
    }
  throw new SourceInputLocationError('Source input location names an unsupported native field');
}
//endregion
