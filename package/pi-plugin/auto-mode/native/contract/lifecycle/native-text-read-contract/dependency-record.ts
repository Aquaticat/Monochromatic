/**
 Original dependency membership rejects foreign values before any retained record is read. @module
 */
import { DependencyHandleOwnershipError } from '../external-dependency-controls/errors.ts';

//region Only object and function identities can have been published by the original owner.
/**
 Require the exact original dependency record while preserving foreign primitive rejection.

 @param handles - original owner map containing only issued opaque object handles

 @param handle - caller-supplied candidate identity

 @returns original retained record by reference

 @throws DependencyHandleOwnershipError when the candidate has no original record

 @example requireDependencyRecord({ handles, handle });
 */
export function requireDependencyRecord<const Record extends object>({
  handles,
  handle
}: Readonly<{
  handles: Pick<WeakMap<object, Record>, 'get'>;
  handle: unknown;
}>): Record {
  if ((((typeof handle) !== 'object') || (handle === null)) && ((typeof handle) !== 'function'))
    throw new DependencyHandleOwnershipError();
  /**
   Native weak membership retains original record identity for issued handles.
   */
  const prepared = handles.get(handle);
  if (prepared === undefined) throw new DependencyHandleOwnershipError();
  return prepared;
}
//endregion
