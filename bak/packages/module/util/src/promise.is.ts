/* @__NO_SIDE_EFFECTS__ */ export function isPromise(value: any): value is Promise<any> {
  return typeof value?.then === 'function';
}
