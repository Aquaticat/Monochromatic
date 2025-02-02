console.log((function negative(num: number): string {
  let result = '/* @__NO_SIDE_EFFECTS__ */ export type Negative<T extends number> = \n';

  for (let t = -num; t <= num; t++) {
    result += `T extends ${t}\n? ${-t}:`;
  }
  result += 'T;';

  return result;
})(
  // Max dprint can handle
  48,
));
