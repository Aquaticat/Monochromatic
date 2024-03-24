const D = (() => {
  if (
    typeof import.meta === 'undefined' ||
    typeof import.meta.env === 'undefined' ||
    typeof import.meta.env.MODE === 'undefined'
  ) {
    if (
      typeof process === 'undefined' ||
      typeof process.env === 'undefined' ||
      typeof process.env.NODE_ENV === 'undefined'
    ) {
      return false;
    }
    return process.env.NODE_ENV === 'development';
  }
  return import.meta.env.MODE === 'development';
})();

const isDirSpecial = (() => {
  if (
    typeof process === 'undefined' ||
    typeof process.release === 'undefined' ||
    typeof process.release.name === 'undefined'
  ) {
    return false;
  }

  // Node and Deno's console.dir needs {depth: null} for printing full object.
  return process.release.name === 'node' || process.release.name === 'deno';
})();

const _dir = (...args) => {
  if (isDirSpecial) {
    args.forEach((arg) => {
      console.dir(arg, { depth: null });
    });
  } else {
    args.forEach((arg) => {
      console.dir(arg);
    });
  }
};
const assert = (assertion: boolean, ...objs) => {
  if (!assertion) {
    console.log('ASSERT:');
    console.trace();
    _dir(objs);
  }
  return assertion;
};

function debug<T1>(arg1: T1): T1;
function debug<T2>(...arg2plus: T2[]): T2[];
function debug<T1, T2>(arg1: T1, ...arg2plus: T2[]): T1 | T2[] {
  if (D) {
    console.debug('DEBUG:');
    console.trace();
    _dir(arg1, ...arg2plus);
  }
  return arguments.length === 1 ? arg1 : arg2plus;
}

function info<T1>(arg1: T1): T1;
function info<T2>(...arg2plus: T2[]): T2[];
function info<T1, T2>(arg1: T1, ...arg2plus: T2[]): T1 | T2[] {
  if (D) {
    console.info('INFO:');
    console.trace();
    _dir(arg1, ...arg2plus);
  }
  return arg2plus.length === 0 ? arg1 : arg2plus;
}

function warn<T1>(arg1: T1): T1;
function warn<T2>(...arg2plus: T2[]): T2[];
function warn<T1, T2>(arg1: T1, ...arg2plus: T2[]): T1 | T2[] {
  console.warn('WARN:');
  console.trace();
  _dir(arg1, ...arg2plus);
  return arg2plus.length === 0 ? arg1 : arg2plus;
}

function error<T1>(arg1: T1): T1;
function error<T2>(...arg2plus: T2[]): T2[];
function error<T1, T2>(arg1: T1, ...arg2plus: T2[]): T1 | T2[] {
  console.error('ERROR:');
  if (process.exitCode === 0) {
    process.exitCode = 1;
  }
  console.trace();
  _dir(arg1, ...arg2plus);
  return arg2plus.length === 0 ? arg1 : arg2plus;
}

function log<T1>(arg1: T1): T1;
function log<T2>(...arg2plus: T2[]): T2[];
function log<T1, T2>(arg1: T1, ...arg2plus: T2[]): T1 | T2[] {
  console.log('LOG:');
  console.trace();
  _dir(arg1, ...arg2plus);
  return arg2plus.length === 0 ? arg1 : arg2plus;
}

export default Object.freeze({ assert, debug, info, warn, error, log });
