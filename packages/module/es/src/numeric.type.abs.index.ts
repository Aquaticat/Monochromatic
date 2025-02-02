console.log((function abs(num: number): string {
  let result = '/* @__NO_SIDE_EFFECTS__ */ export type Abs<T extends number> = \n';

  for (let t = -num; t < 0; t++) {
    result += `T extends ${t}\n? ${Math.abs(t)}\n:`;
  }
  result += 'T;';

  return result;
})(
  // Max dprint can handle
  48,
));
