export function toStringIterable(iterable: Iterable<string>): string {
  const formatter = new Intl.ListFormat(undefined, { style: 'narrow', type: 'unit' });

  return formatter.format(iterable);
}

// TODO: Write async version.
