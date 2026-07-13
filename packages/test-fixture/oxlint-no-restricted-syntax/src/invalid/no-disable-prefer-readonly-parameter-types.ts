// oxlint-disable-next-line prefer-readonly-parameter-type/prefer-readonly-parameter-types -- invalid line fixture.
export function bypassReadonlyEffectLine(state: { value: string; },): string {
  return state.value;
}

/* oxlint-disable prefer-readonly-parameter-type/prefer-readonly-parameter-types -- invalid block fixture. */
export function bypassReadonlyEffectBlock(state: { value: string; },): string {
  return state.value;
}
/* oxlint-enable prefer-readonly-parameter-type/prefer-readonly-parameter-types */

// oxlint-disable-next-line no-unused-vars, prefer-readonly-parameter-type/prefer-readonly-parameter-types -- invalid mixed-list fixture.
export function bypassReadonlyEffectList(state: { value: string; },): string {
  return state.value;
}
