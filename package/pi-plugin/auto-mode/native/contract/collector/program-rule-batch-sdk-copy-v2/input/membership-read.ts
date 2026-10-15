/**
 Original weak membership queries accept foreign values without publishing new keys. @module
 */

/**
 Query original object-keyed membership while retaining native absence for primitive inputs.

 @param records - original constructor-owned weak membership records

 @param handle - caller value whose original object membership is being queried

 @returns original record or native absent-membership result

 @example readOriginalMembership({ records, handle });
 */
export function readOriginalMembership<Record extends object>({ records, handle }: Readonly<{
  records: Pick<WeakMap<object, Record>, 'get'>;
  handle: unknown;
}>): ReturnType<WeakMap<object, Record>['get']> {
  if ((((typeof handle) === 'object') && (handle !== null)) || ((typeof handle) === 'function'))
    return records.get(handle);
  return undefined;
}
