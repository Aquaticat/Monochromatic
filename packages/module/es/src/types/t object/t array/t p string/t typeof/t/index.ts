/** Discriminated union type representing detailed type information for JavaScript values */
export type $ =
  /** Represents the `undefined` primitive type */
  | 'undefined'
  /** Represents the `bigint` primitive type with sign information */
  | ['bigint', { sign: 0 | 'negative' | 'positive'; },]
  /** Represents the `boolean` primitive type with truthiness information */
  | ['boolean', { true: boolean; },]
  /** Represents function types with generator and async flags */
  | ['function', { generator: boolean; async: boolean; },]
  /** Represents the `number` primitive type with sign and float information */
  | ['number', { sign: 0 | 'negative' | 'positive'; float: boolean; },]
  /** Represents object types with prototype information */
  | ['object', {
    prototype:
      /** Represents `null` values (special object case) */
      // > Object.prototype.toString.call(null)
      // '[object Null]'
      | 'Null'
      /** Represents array objects */
      // > Object.prototype.toString.call([])
      // '[object Array]'
      | 'Array'
      /** Represents plain objects with iterability flag */
      // > Object.prototype.toString.call({*[Symbol.iterator]() {}})
      // '[object Object]'
      // > Object.prototype.toString.call({})
      // '[object Object]'
      // > Object.prototype.toString.call(new Proxy({},{}))
      // '[object Object]'
      // > Object.prototype.toString.call({a: 1})
      // '[object Object]'
      | ['Object', { iterable: boolean; },]
      /** Represents Date objects */
      // > Object.prototype.toString.call(new Date())
      // '[object Date]'
      | 'Date'
      /** Represents Map objects */
      // > Object.prototype.toString.call(new Map())
      // '[object Map]'
      | 'Map'
      /** Represents Set objects */
      // > Object.prototype.toString.call(new Set())
      // '[object Set]'
      | 'Set'
      /** Represents Promise objects */
      // > Object.prototype.toString.call(new Promise(() => {}))
      // '[object Promise]'
      | 'Promise'
      /** Represents RegExp objects with global flag */
      // > Object.prototype.toString.call(new RegExp())
      // '[object RegExp]'
      | ['RegExp', { global: boolean; },];
  },]
  /** Represents string types with emptiness and character information */
  | ['string',
    | { empty: true; }
    | { empty: [false, { char:
      | false
      | [true, 'uppercaseLetter' | 'lowercaseLetter' | 'nonLetter',]; },]; },]
  | 'symbol';
