export default async <T_i,>(
  predicate: (i: T_i) => Promise<boolean>,
  iterable: T_i[]|AsyncIterable<T_i> | Iterable<T_i>,
): Promise<[T_i[], T_i[]]> => {
  const yes: T_i[] = [];
  const no: T_i[] = [];

  for await (const i of iterable) {
    if (await predicate(i)) {
      yes.push(i);
    } else {
      no.push(i);
    }
  }

  return [yes, no];
};
