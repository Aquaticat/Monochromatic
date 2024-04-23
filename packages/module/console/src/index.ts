export const isDirSpecial = () => {
  if (
    typeof process === 'undefined'
    || typeof process.release === 'undefined'
    || typeof process.release.name === 'undefined'
  ) {
    return false;
  }

  // Node and Deno's console.dir needs {depth: null} for printing full object.
  return process.release.name === 'node' || process.release.name === 'deno';
};

const _dir = (...args) => {
  if (isDirSpecial()) {
    args.forEach((arg) => {
      console.dir(arg, { depth: null });
    });
  } else {
    args.forEach((arg) => {
      /* fix for "sometimes c.log()" outputs quotes around strings.
         We don't want it to output quotes around strings ever. */
      if (typeof arg === 'string') {
        console.log(arg);
      } else {
        console.dir(arg);
      }
    });
  }
};
export const assert = (assertion: boolean, ...objs) => {
  if (!assertion) {
    console.log('ASSERT:');
    console.trace();
    _dir(objs);
  }
  return assertion;
};

export function debug<T1,>(arg1: T1): T1;
export function debug<T2,>(...arg2plus: T2[]): T2[];
export function debug<T1, T2,>(arg1: T1, ...arg2plus: T2[]): T1 | T2[] {
  // TODO: Migrate to import.meta.env.MODE
  if (import.meta.env.DEV) {
    console.debug('DEBUG:');
    console.trace();
    _dir(arg1, ...arg2plus);
  }
  return arguments.length === 1 ? arg1 : arg2plus;
}

export function info<T1,>(arg1: T1): T1;
export function info<T2,>(...arg2plus: T2[]): T2[];
export function info<T1, T2,>(arg1: T1, ...arg2plus: T2[]): T1 | T2[] {
  if (import.meta.env.DEV) {
    console.info('INFO:');
    console.trace();
    _dir(arg1, ...arg2plus);
  }
  return arg2plus.length === 0 ? arg1 : arg2plus;
}

export function warn<T1,>(arg1: T1): T1;
export function warn<T2,>(...arg2plus: T2[]): T2[];
export function warn<T1, T2,>(arg1: T1, ...arg2plus: T2[]): T1 | T2[] {
  console.warn('WARN:');
  console.trace();
  _dir(arg1, ...arg2plus);
  return arg2plus.length === 0 ? arg1 : arg2plus;
}

export function error<T1,>(arg1: T1): T1;
export function error<T2,>(...arg2plus: T2[]): T2[];
export function error<T1, T2,>(arg1: T1, ...arg2plus: T2[]): T1 | T2[] {
  console.error('ERROR:');
  if (process.exitCode === 0) {
    process.exitCode = 1;
  }
  console.trace();
  _dir(arg1, ...arg2plus);
  return arg2plus.length === 0 ? arg1 : arg2plus;
}

export function log<T1,>(arg1: T1): T1;
export function log<T2,>(...arg2plus: T2[]): T2[];
export function log<T1, T2,>(arg1: T1, ...arg2plus: T2[]): T1 | T2[] {
  _dir(arg1, ...arg2plus);
  return arg2plus.length === 0 ? arg1 : arg2plus;
}

export default Object.freeze({ assert, debug, info, warn, error, log });
