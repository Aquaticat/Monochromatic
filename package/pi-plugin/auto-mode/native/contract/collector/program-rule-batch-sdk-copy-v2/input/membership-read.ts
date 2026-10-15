/**
 Original weak membership queries accept foreign values without publishing new keys. @module
 */

/**
 Native weak-map reads return absent membership for primitive queries;
 publication remains restricted to original object handles.
 */
export type OriginalMembershipRead<Record extends object> = Readonly<{
  get: (handle: unknown) => ReturnType<WeakMap<object, Record>['get']>;
}>;
