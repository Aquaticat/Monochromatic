import {
  equal,
  equalAsync,
} from '@monochromatic-dev/module-es/ts';

/* @__NO_SIDE_EFFECTS__ */ export function equals(equalTo: any): (input: any) => boolean {
  return function(input: any) {
    return equal(input, equalTo);
  };
}

/* @__NO_SIDE_EFFECTS__ */ export function equalsAsync(
  equalTo: any,
): (input: any) => Promise<boolean> {
  return async function(input: any): Promise<boolean> {
    return await equalAsync(input, equalTo);
  };
}

/* @__NO_SIDE_EFFECTS__ */ export function equalsOrThrow<T_input,>(
  equalTo: any,
): (input: T_input) => T_input {
  return function(input: T_input) {
    if (equal(input, equalTo)) {
      return input;
    }

    throw new Error(`input ${input} isn't equal to ${equalTo}`);
  };
}

/* @__NO_SIDE_EFFECTS__ */ export function equalsAsyncOrThrow<T_input,>(
  equalTo: any,
): (input: T_input) => Promise<T_input> {
  return async function(input: T_input) {
    if (await equalAsync(input, equalTo)) {
      return input;
    }

    throw new Error(`input ${input} isn't equal to ${equalTo}`);
  };
}
