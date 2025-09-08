export type $ =
  | ['undefined',]
  | ['bigint', { sign: 0 | 'negative' | 'positive'; },]
  | ['boolean', { true: boolean; },]
  | ['function', { generator: boolean; async: boolean; },]
  | ['number', { sign: 0 | 'negative' | 'positive'; float: boolean; },]
  | ['object', {
    prototype:
      // > Object.prototype.toString.call(null)
      // '[object Null]'
      | 'Null'
      // > Object.prototype.toString.call([])
      // '[object Array]'
      | 'Array'
      // > Object.prototype.toString.call({*[Symbol.iterator]() {}})
      // '[object Object]'
      // > Object.prototype.toString.call({})
      // '[object Object]'
      // > Object.prototype.toString.call(new Proxy({},{}))
      // '[object Object]'
      // > Object.prototype.toString.call({a: 1})
      // '[object Object]'
      | ['Object', {iterable: boolean}]
      // > Object.prototype.toString.call(new Date())
      // '[object Date]'
      | 'Date'
      // > Object.prototype.toString.call(new Map())
      // '[object Map]'
      | 'Map'
      // > Object.prototype.toString.call(new Set())
      // '[object Set]'
      | 'Set'
      // > Object.prototype.toString.call(new Promise(() => {}))
      // '[object Promise]'
      | 'Promise'
      // > Object.prototype.toString.call(new RegExp())
      // '[object RegExp]'
      | ['RegExp', { global: boolean; },];
  },]
  | ['string',
    | { empty: true; }
    | { empty: [false, { char:
      | false
      | [true, 'uppercaseLetter' | 'lowercaseLetter' | 'nonLetter',]; },]; },];
