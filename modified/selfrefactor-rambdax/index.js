import {
  adjust as rAdjust,
  ap as rAp,
  aperture as rAperture,
  append as rAppend,
  apply as rApply,
  applyDiff as rApplyDiff,
  applySpec as rApplySpec,
  applyTo as rApplyTo,
  ascend as rAscend,
  assoc as rAssoc,
  assocPath as rAssocPath,
  pipe as rPipe,
  piped as rPiped,
} from 'rambdax';

export function oF(value) {
  if (value && typeof value === 'object' && !ArrayBuffer.isView(value)) {
    return Object.freeze(value);
  }
  return value;
}

export function pipe(...args) {
  const result = rPipe(...args);
  oF(result);
  return result;
}

export function adjust(...args) {
  const result = rAdjust(...args);
  oF(result);
  return result;
}

export function ap(...args) {
  const result = rAp(...args);
  oF(result);
  return result;
}

export function aperture(...args) {
  const result = rAperture(...args);
  oF(result);
  return result;
}
export function append(...args) {
  const result = rAppend(...args);
  oF(result);
  return result;
}

export function adjust(...args) {
  const result = rAdjust(...args);
  oF(result);
  return result;
}

export function ap(...args) {
  const result = rAp(...args);
  oF(result);
  return result;
}

export function aperture(...args) {
  const result = rAperture(...args);
  oF(result);
  return result;
}
export function pipe(...args) {
  const result = rPipe(...args);
  oF(result);
  return result;
}

export function adjust(...args) {
  const result = rAdjust(...args);
  oF(result);
  return result;
}

export function ap(...args) {
  const result = rAp(...args);
  oF(result);
  return result;
}

export function aperture(...args) {
  const result = rAperture(...args);
  oF(result);
  return result;
}
export function pipe(...args) {
  const result = rPipe(...args);
  oF(result);
  return result;
}

export function adjust(...args) {
  const result = rAdjust(...args);
  oF(result);
  return result;
}

export function ap(...args) {
  const result = rAp(...args);
  oF(result);
  return result;
}

export function aperture(...args) {
  const result = rAperture(...args);
  oF(result);
  return result;
}
export function pipe(...args) {
  const result = rPipe(...args);
  oF(result);
  return result;
}

export function adjust(...args) {
  const result = rAdjust(...args);
  oF(result);
  return result;
}

export function ap(...args) {
  const result = rAp(...args);
  oF(result);
  return result;
}

export function aperture(...args) {
  const result = rAperture(...args);
  oF(result);
  return result;
}

export {
  add,
  addIndex,
  addIndexRight,
  all,
  allFalse,
  allPass,
  allTrue,
  allType,
  always,
  and,
  any,
  anyFalse,
  anyPass,
  anyTrue,
  anyType,
  binary,
  bind,
  both,
  clamp,
} from 'rambdax';
