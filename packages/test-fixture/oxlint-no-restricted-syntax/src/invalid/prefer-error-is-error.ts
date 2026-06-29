// Fixture: legacy Error detection should be banned in favor of Error.isError.
// Expected violation: no-restricted-syntax(prefer-error-is-error)

import util from 'node:util';
import { types, } from 'node:util';
import * as utilTypes from 'node:util/types';
import { isNativeError, } from 'node:util/types';

function detections(error: unknown,): readonly boolean[] {
  return [
    error instanceof Error,
    error instanceof globalThis.Error,
    Object.prototype.toString.call(error,) === '[object Error]',
    '[object Error]' !== Object.prototype.toString.call(error,),
    Object.prototype.toString.call(error,).slice(8, -1,) === 'Error',
    'Error' !== Object.prototype.toString.call(error,).slice(8, -1,),
    Object.prototype.toString.call(error,).endsWith(' Error]',),
    error.constructor === Error,
    Error === error.constructor,
    util.types.isNativeError(error,),
    types.isNativeError(error,),
    utilTypes.isNativeError(error,),
    isNativeError(error,),
  ];
}

void detections;

export {};
