/**
 Represent declared native fields without inspecting executable cancellation state.

 @module
 */
import { types } from 'node:util';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type { NativeEventInput } from '../../integration/native-batch/event-observer-types.ts';
import { SourceCollectionError } from '../errors.ts';
import {projectNativeCompactionFilePaths} from './compaction-file-paths.ts';

//region Native control references belong to one original event emission

/**
 Platform compatibility does not authenticate a constructor or grant source authority.
 */
const nativeSignalPrototype: object = AbortSignal.prototype;

/**
 Diagnostics retain module ownership without retaining native control values.
 */
const l = tagged({ tag: 'auto-mode-native-event-controls' });

/**
 Keep a declared native control field while leaving ordinary data validation to its existing owner.

 @returns synchronous projection scoped to one original emission

 @throws SourceCollectionError when a declared control field cannot retain an opaque reference
 */
export function createNativeEventInputProjection(): (
  input: Pick<NativeEventInput, 'kind' | 'phase' | 'value'>
) => unknown {
  /**
   Weak keys identify repeated handles without extending their runtime lifetime.
   */
  const references = new WeakMap<object, number>();
  /**
   Ordinals distinguish replacement handles within this emission only.
   */
  const state = { next: 0 };
  /**
   Emission diagnostics inherit module ownership.
   */
  const rl = tagged({ tag: createNativeEventInputProjection.name, l });
  rl.debug('created original native event control projection');

  /**
   Preserve every original event descriptor while replacing only its declared cancellation handle.

   @param kind - original native dispatch selects the control-field contract
   @param phase - extension outputs retain the ordinary-data profile
   @param value - borrowed input remains untouched for the original callbacks
   @returns original value or descriptor-preserving control projection for the strict copier
   @throws SourceCollectionError when a native control field is unsupported
   */
  function project({ kind, phase, value:borrowed }: Pick<NativeEventInput, 'kind' | 'phase' | 'value'>): unknown {
    /**
     Capture diagnostics retain the emission's logger tags.
     */
    const pl = tagged({ tag: project.name, l: rl });
    pl.debug(`projecting original ${kind} event ${phase} value`);
    if ((phase !== 'input' && phase !== 'after')
      || (kind !== 'session_before_tree' && kind !== 'session_before_compact')) {
      pl.debug('native value retains the ordinary-data profile');
      return borrowed;
    }
    const value=kind==='session_before_compact'?projectNativeCompactionFilePaths(borrowed):borrowed;
    if (value === null || typeof value !== 'object' || types.isProxy(value)
      || Object.getPrototypeOf(value) !== Object.prototype) {
      pl.debug('non-record input retains its existing data validation');
      return value;
    }
    /**
     Descriptor access never invokes an event's signal getter.
     */
    const field = Object.getOwnPropertyDescriptor(value, 'signal');
    if (!field) {
      pl.debug('original event has no cancellation control field');
      return value;
    }
    if (!Object.hasOwn(field, 'value'))
      throw new SourceCollectionError(`${kind} event signal requires an own data property`);
    /**
     The platform object remains opaque, including its reason, listeners, accessors and symbols.
     */
    const signal: unknown = field.value;
    if (types.isProxy(signal))
      throw new SourceCollectionError(`${kind} event signal requires a non-proxy platform-compatible control`);
    if (signal === null || typeof signal !== 'object'
      || Object.getPrototypeOf(signal) !== nativeSignalPrototype) {
      pl.debug('non-control field retains its existing data validation');
      return value;
    }
    /**
     An equal ordinal establishes handle continuity within this emission, never permission.
     */
    const previous = references.get(signal);
    /**
     Existing handles reuse their occurrence ordinal even after another handle replaces them.
     */
    const reference = previous ?? state.next;
    if (previous === undefined) {
      references.set(signal, reference);
      state.next++;
      pl.debug('retained a distinct original cancellation control reference');
    }
    /**
     Intrinsic descriptor copying preserves hidden data and syntax-boundary property names.
     */
    const descriptors = Object.getOwnPropertyDescriptors(value);
    descriptors.signal = {
      ...field,
      value: Object.freeze({ nativeControl: 'cancellation-signal', reference })
    };
    /**
     The existing ordinary-data copier owns recursive validation and freezing after projection.
     */
    const projected: unknown = Object.create(Object.prototype, descriptors);
    return projected;
  }
  return project;
}

//endregion Native control references belong to one original event emission
