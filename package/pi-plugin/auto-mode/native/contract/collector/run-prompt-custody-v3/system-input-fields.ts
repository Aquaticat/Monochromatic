/**
 Read selected system fields without executing borrowed accessors. @module
 */
import { types } from 'node:util';

/**
 Original selected fields share the manager input's existing capture budget.
 */
export type SystemInputFields = {
  readonly content: unknown;
  readonly sections: unknown;
  readonly toolsAdded: unknown;
  readonly toolsRemoved: unknown;
};

//region Native system data selection preserves original borrowed identities

/**
 Select only fields already retained by the manager's original input owner.
 
 @param value - original or natively copied system message
 
 @param InputError - original source owner's failure constructor
 
 @returns borrowed fields for bounded integrity comparison
 
 @throws SourceCollectionError when selected fields are not ordinary native data
 
 @example
 ```ts
 const fields = readSystemInputFields({ value, InputError });
 ```
 */
export function readSystemInputFields({
  value,
  InputError
}: {
  readonly value: object;
  readonly InputError: new (message: string) => Error;
}): SystemInputFields {
  if (types.isProxy(value) || (Object.getPrototypeOf(value) !== Object.prototype)
    || ('toJSON' in value))
    throw new InputError('Native system input requires an ordinary message');
  /**
   Even optional fields must reject accessors instead of treating them as absence.
   
   @param key - selected native field
   
   @returns original data value without invoking accessors
   
   @throws SourceCollectionError when selected property has an unsupported descriptor
   */
  function field(key: string): unknown {
    /**
     Descriptor inspection precedes every selected data read.
     */
    const property = Object.getOwnPropertyDescriptor(
      value,
      key
    );
    if ((property !== undefined) && ((property.enumerable !== true) || (!Object.hasOwn(
      property,
      'value'
    ))))
      throw new InputError(`Native system input field ${key} requires an enumerable data property`);
    return property?.value;
  }
  if (field('role') !== 'system') throw new InputError('Native system input requires its original system role');
  return {
    content: field('content'),
    sections: field('sections'),
    toolsAdded: field('toolsAdded'),
    toolsRemoved: field('toolsRemoved')
  };
}

//endregion Native system data selection preserves original borrowed identities
