import type { $ as jsonc, } from '../../unnamed/index.ts';

// FIXME: We can't directly strip whitespace from a json that may contain inline comments, so this fn need to be restructured.

export function $({ value, }: { value: jsonc; },): jsonc {
  const matches = Array.from(value.matchAll(/\s/g,),);
}
