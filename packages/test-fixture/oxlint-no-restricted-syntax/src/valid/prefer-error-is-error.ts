// Fixture: preferred Error detection and non-Node lookalikes should pass.
// Expected: zero no-restricted-syntax(prefer-error-is-error) violations.

import { types as nonNodeTypes, } from 'not-node-util';
import * as nonNodeUtilTypes from 'not-node-util/types';

function detections(error: unknown,): readonly boolean[] {
  return [
    Error.isError(error,),
    Object.prototype.toString.call(error,).endsWith(' Promise]',),
    nonNodeTypes.isNativeError(error,),
    nonNodeUtilTypes.isNativeError(error,),
  ];
}

void detections;

export {};
