import { ProducerInputRunError, } from './producer-input-error.ts';
import { strings, } from './producer-input-inspect-fields.ts';

/**
 Native user-namespace mapping rows contain origin, destination and extent.
 */
const MAPPING_FIELDS = 3;
/**
 Checks the pinned rootless mapping's caller row without treating its intermediate namespace IDs as host UIDs.
 
 @param value - native UID or GID mapping rows
 
 @param caller - independently captured caller ID
 
 @param name - fixed mapping field label
 
 @throws ProducerInputRunError when the caller is not mapped uniquely to the rootless namespace owner
 
 @example
 ```ts
 callerMapping({ value, caller: host.run.uid, name: 'UidMap' });
 ```
 */
export function callerMapping({
  value,
  caller,
  name,
}: {
  readonly value: unknown;
  readonly caller: number;
  readonly name: string
},): void {
  /**
   Native metadata uses container:intermediate-namespace:extent rows in this measured profile.
   */
  const rows = strings({
    value,
    name
  });
  /**
   The rootless owner maps only this caller coordinate, not a whole user range, to namespace zero.
   */
  const wanted = `${caller}:0:1`;
  if (rows.filter(function owner(row): boolean {
    return row === wanted;
  })
    .length
    !== 1)
    throw new ProducerInputRunError({
      operation: 'launch-container',
      locator: `container mapping ${name}`,
    });
  for (const row of rows) {
    /**
     Every other range must exclude both the caller coordinate and namespace owner zero.
     */
    const parts = row.split(':');
    /**
     Native range fields are kept separate from filesystem or caller authorization.
     */
    const [containerText, namespaceText, extentText] = parts;
    /**
     Exact numeric conversion refuses rounding and alternate spellings.
     */
    const container = Number(containerText);
    /**
     This coordinate is not asserted to be a host-account UID.
     */
    const namespace = Number(namespaceText);
    /**
     Extent is validated before it is used for membership.
     */
    const extent = Number(extentText);
    if ((parts.length !== MAPPING_FIELDS) || (!Number.isSafeInteger(container))
      || (container < 0)
      || (String(container) !== containerText)
      || (!Number.isSafeInteger(namespace))
      || (namespace < 0)
      || (String(namespace) !== namespaceText)
      || (!Number.isSafeInteger(extent))
      || (extent <= 0)
      || (String(extent) !== extentText)
      || (!Number.isSafeInteger(container + extent))
      || ((row !== wanted)
      && ((namespace === 0) || ((container <= caller)
        && (caller < (container
          + extent))))))
      throw new ProducerInputRunError({
        operation: 'launch-container',
        locator: `container mapping ${name}`,
      });
  }
}
