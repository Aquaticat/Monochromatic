/**
 * Union of extended typeof string literals including `'null'`, `'NaN'`, `'array'`, `'date'`, `'set'`, `'map'`.
 */
export type $ =
  | 'null'
  | 'undefined'
  | 'NaN'
  | 'number'
  | 'boolean'
  | 'bigint'
  | 'symbol'
  | 'string'
  | 'array'
  | 'date'
  | 'set'
  | 'map'
  | 'object';
