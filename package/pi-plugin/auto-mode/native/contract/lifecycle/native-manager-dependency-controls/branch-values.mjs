import { NativeManagerObservationShapeError } from './errors.ts';

//region Preserve native entry values without retaining borrowed SDK objects.
const expectedKeys = [
  'id',
  'message',
  'parentId',
  'timestamp',
  'type'
];
/** Immutable strings retain complete native entries, including actual timestamps. */
export function captureBranchValues(branch) {
  if ((!Array.isArray(branch)) || (branch.length > 2)) throw new NativeManagerObservationShapeError('Native selected branch is outside the declared two-entry qualification scope');
  const values = [];
  for (const entry of branch) {
    if ((entry === null) || ((typeof entry) !== 'object')) throw new NativeManagerObservationShapeError('Native selected branch contains an unsupported entry');
    const keys = Reflect.ownKeys(entry);
    if (keys.some(function isNonStringBranchKey(key) { return ( (typeof key) !== 'string'); }) || (JSON.stringify(keys.toSorted(function compareBranchKeys(left,right){
      if(typeof left!=='string'||typeof right!=='string')throw new NativeManagerObservationShapeError('Native selected entry keys require string field names');
      return left<right?-1:left>right?1:0;
    })) !== JSON.stringify(expectedKeys))) throw new NativeManagerObservationShapeError('Native selected entry keys differ from the declared message shape');
    if ((entry.type !== 'message') || ((typeof entry.id) !== 'string')
      || (entry.id
        .length
        === 0)
      ||
        ((entry.parentId !== null) && ((typeof entry.parentId) !== 'string'))
      ||
        ((typeof entry.timestamp) !== 'string')
      || (!Number.isFinite(Date.parse(entry.timestamp)))
      ||
        (new Date(entry.timestamp).toISOString() !== entry.timestamp)) throw new NativeManagerObservationShapeError('Native selected entry identity, parent, or timestamp differs from the declared shape');
    const value = JSON.stringify(entry);
    if ((typeof value) !== 'string') throw new NativeManagerObservationShapeError('Native selected entry could not be retained as an independent value');
    values.push(value);
  }
  return Object.freeze(values);
}
//endregion
