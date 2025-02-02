/**
 @remarks
 Compared to built-in Array.of 's definition in TypeScript, actually accepts mixed types.

 @param elements - Elements used to create the array.
 */
/* @__NO_SIDE_EFFECTS__ */ export function arrayOf<const T_elements extends any[],>(
  ...elements: T_elements
): T_elements {
  return elements;
}

/* @__NO_SIDE_EFFECTS__ */ export function* genOf<const T_elements extends any[],>(
  ...elements: T_elements
): Generator<T_elements[number]> {
  for (const element of elements) {
    yield element;
  }
}
